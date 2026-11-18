/**
 * Capacity guard (docs/REDESIGN.md, phase 5, step085). The app runs on free plans; their daily limits are per
 * Cloudflare account (shared with other projects). Every hour CI reads today's account-wide usage
 * (scripts/capacity.mjs) and posts it here. Above PAUSE_AT of any limit, new families pause and new natural-voice
 * clips stop (the app falls back to the device voice); existing families keep playing. It resumes below RESUME_AT.
 */
import type { DB } from './parent';

/** Free-plan daily limits (UTC day). CI may pass other limits (a paid plan). */
export const FREE_LIMITS = { requests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000, neurons: 10_000 };
export type Limits = typeof FREE_LIMITS;
export type Usage = Partial<Record<keyof Limits, number>>;
export const PAUSE_AT = 0.8;
export const RESUME_AT = 0.6;

export interface Capacity {
  paused: boolean;
  /** The busiest measure, as a share of its limit (0–1+). */
  worst: { key: keyof Limits; share: number } | null;
  usage: Usage;
  at: number;
}

/** Pause above 80% of any limit; once paused, stay paused until everything is under 60% (no flapping). */
export function decide(usage: Usage, wasPaused: boolean, limits: Limits = FREE_LIMITS): Pick<Capacity, 'paused' | 'worst'> {
  let worst: Capacity['worst'] = null;
  for (const key of Object.keys(limits) as (keyof Limits)[]) {
    const v = usage[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const share = v / limits[key];
    if (!worst || share > worst.share) worst = { key, share };
  }
  if (!worst) return { paused: wasPaused, worst };
  return { paused: wasPaused ? worst.share >= RESUME_AT : worst.share >= PAUSE_AT, worst };
}

export async function getCapacity(db: DB): Promise<Capacity> {
  const row = await db.prepare("SELECT v FROM kv WHERE k = 'capacity'").first<{ v: string }>().catch(() => null);
  try {
    if (row) return JSON.parse(row.v) as Capacity;
  } catch { /* a broken value counts as not paused */ }
  return { paused: false, worst: null, usage: {}, at: 0 };
}

export const capacityPaused = async (db: DB) => (await getCapacity(db)).paused;

/** POST /api/admin/capacity (bearer): today's usage from CI; stores and returns the decision. */
export async function setCapacity(db: DB, body: Record<string, unknown>, now = Date.now()): Promise<Capacity> {
  const raw = (body.usage ?? {}) as Record<string, unknown>;
  const usage: Usage = {};
  for (const k of Object.keys(FREE_LIMITS) as (keyof Limits)[]) if (typeof raw[k] === 'number' && Number.isFinite(raw[k] as number)) usage[k] = raw[k] as number;
  const limits = { ...FREE_LIMITS, ...((body.limits ?? {}) as Partial<Limits>) };
  const before = await getCapacity(db);
  const next: Capacity = { ...decide(usage, before.paused, limits), usage, at: now };
  await db.prepare("INSERT OR REPLACE INTO kv (k, v) VALUES ('capacity', ?)").bind(JSON.stringify(next)).run();
  return next;
}
