/**
 * Moving a device's progress from the old address to the new one (step080). Browsers keep saved progress per address,
 * so the old address uploads it under a one-time code and redirects; the new address takes it once. 30 minutes, then gone.
 */
import { HttpError, sha256Hex, type DB } from './parent';

export const HANDOFF = { minutes: 30, maxBytes: 400_000 };

function code(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function putHandoff(db: DB, body: Record<string, unknown>, now = Date.now()) {
  const state = typeof body.state === 'string' ? body.state : '';
  if (!state || state.length > HANDOFF.maxBytes) throw new HttpError(400, 'Nothing to move');
  try {
    JSON.parse(state);
  } catch {
    throw new HttpError(400, 'Nothing to move');
  }
  const c = code();
  await db.prepare('INSERT INTO handoffs (code_hash, state, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256Hex(c), state, now, now + HANDOFF.minutes * 60_000).run();
  return { code: c };
}

export async function takeHandoff(db: DB, body: Record<string, unknown>, now = Date.now()) {
  const c = typeof body.code === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(body.code) ? body.code : '';
  if (!c) throw new HttpError(404, 'This link has expired');
  const hash = await sha256Hex(c);
  const row = await db.prepare('SELECT state, expires_at FROM handoffs WHERE code_hash = ?').bind(hash).first<{ state: string; expires_at: number }>();
  await db.prepare('DELETE FROM handoffs WHERE code_hash = ?').bind(hash).run();
  if (!row || row.expires_at <= now) throw new HttpError(404, 'This link has expired');
  return { state: row.state };
}

/** Hourly: drop anything not taken in time. */
export async function sweepHandoffs(db: DB, now = Date.now()) {
  const r = await db.prepare('DELETE FROM handoffs WHERE expires_at <= ?').bind(now).run();
  return { deleted: (r as { meta?: { changes?: number }; changes?: number }).meta?.changes ?? (r as { changes?: number }).changes ?? 0 };
}
