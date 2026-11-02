/**
 * Parent-dashboard backend logic, shared by the Pages Functions in functions/api/.
 * Kept free of Cloudflare-specific globals so it can be unit-tested against SQLite.
 *
 * Security model
 * - The child's device creates a random 144-bit `familyId` and a parent PIN. The server stores only
 *   sha256(familyId) and a PBKDF2 hash of the PIN.
 * - Writing (sync) requires the familyId. Reading or deleting requires the familyId AND the PIN.
 * - Five wrong PINs lock the family for 15 minutes.
 */

export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface DB {
  prepare(sql: string): Stmt;
  batch(statements: Stmt[]): Promise<unknown[]>;
}

export interface AttemptIn {
  ts: number;
  problemId: string;
  topicId: string;
  grade: number;
  level: number;
  correct: boolean;
  firstTry: boolean;
  skipped?: boolean;
  hints?: number;
  seconds?: number;
  answer?: string;
  mode?: string;
}

export const LIMITS = { attemptsPerSync: 500, snapshotBytes: 200_000, maxFailures: 5, lockMs: 15 * 60_000, readDays: 120 };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const validFamilyId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{22,64}$/.test(id);
export const validPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4,8}$/.test(pin);

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : null);
const int = (v: unknown, lo: number, hi: number, dflt = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

interface FamilyRow {
  key: string;
  pin_salt: string;
  pin_hash: string;
  child_name: string | null;
  grade: number | null;
  snapshot: string | null;
  last_sync: number | null;
  failed_attempts: number;
  locked_until: number;
}

/** POST /api/sync: the child's device uploads new attempts plus a progress snapshot. */
export async function sync(db: DB, body: Record<string, unknown>, now = Date.now()) {
  const { familyId, pin } = body;
  if (!validFamilyId(familyId)) throw new HttpError(400, 'Bad family id');
  const key = await sha256Hex('family:' + familyId);
  const attempts = Array.isArray(body.attempts) ? (body.attempts as AttemptIn[]) : [];
  if (attempts.length > LIMITS.attemptsPerSync) throw new HttpError(413, 'Too many attempts in one sync');
  const snapshot = body.snapshot === undefined ? null : JSON.stringify(body.snapshot);
  if (snapshot && snapshot.length > LIMITS.snapshotBytes) throw new HttpError(413, 'Snapshot too large');
  const child = (body.child ?? {}) as { name?: unknown; grade?: unknown };

  const existing = await db.prepare('SELECT key FROM families WHERE key = ?').bind(key).first();
  if (!existing) {
    if (!validPin(pin)) throw new HttpError(400, 'A 4–8 digit PIN is needed to set up the parent dashboard');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
    await db
      .prepare('INSERT INTO families (key, pin_salt, pin_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(key, salt, await hashPin(pin, salt), now)
      .run();
  }

  const stmts: Stmt[] = [
    db
      .prepare(
        'UPDATE families SET child_name = COALESCE(?, child_name), grade = COALESCE(?, grade), snapshot = COALESCE(?, snapshot), last_sync = ? WHERE key = ?'
      )
      .bind(clip(child.name, 40), child.grade === undefined ? null : int(child.grade, 2, 3, 2), snapshot, now, key)
  ];
  for (const a of attempts) {
    if (!a || typeof a.problemId !== 'string' || typeof a.topicId !== 'string') continue;
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO attempts (family, ts, problem_id, topic, grade, level, correct, first_try, skipped, hints, seconds, answer, mode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          key,
          int(a.ts, 0, now + 86_400_000),
          a.problemId.slice(0, 80),
          a.topicId.slice(0, 40),
          int(a.grade, 2, 3, 2),
          int(a.level, 1, 3, 1),
          a.correct ? 1 : 0,
          a.firstTry ? 1 : 0,
          a.skipped ? 1 : 0,
          int(a.hints, 0, 20),
          int(a.seconds, 0, 3600),
          clip(a.answer, 60),
          ['practice', 'review', 'meet'].includes(String(a.mode)) ? String(a.mode) : 'practice'
        )
    );
  }
  await db.batch(stmts);
  return { ok: true, received: attempts.length, created: !existing };
}

/** Checks the PIN with lockout. Returns the family row. */
async function authorize(db: DB, body: Record<string, unknown>, now: number): Promise<FamilyRow> {
  const { familyId, pin } = body;
  // Same message for unknown family and wrong PIN, so nothing can be learned by guessing ids.
  if (!validFamilyId(familyId) || !validPin(pin)) throw new HttpError(401, 'Wrong link or PIN');
  const key = await sha256Hex('family:' + familyId);
  const row = await db.prepare('SELECT * FROM families WHERE key = ?').bind(key).first<FamilyRow>();
  if (!row) throw new HttpError(401, 'Wrong link or PIN');
  if (row.locked_until > now) {
    throw new HttpError(429, `Too many wrong PINs. Try again in ${Math.ceil((row.locked_until - now) / 60_000)} minutes.`);
  }
  if (!safeEqual(await hashPin(pin, row.pin_salt), row.pin_hash)) {
    const failures = row.failed_attempts + 1;
    const lock = failures >= LIMITS.maxFailures;
    await db
      .prepare('UPDATE families SET failed_attempts = ?, locked_until = ? WHERE key = ?')
      .bind(lock ? 0 : failures, lock ? now + LIMITS.lockMs : 0, key)
      .run();
    throw new HttpError(lock ? 429 : 401, lock ? 'Too many wrong PINs. Try again in 15 minutes.' : 'Wrong link or PIN');
  }
  if (row.failed_attempts) await db.prepare('UPDATE families SET failed_attempts = 0 WHERE key = ?').bind(key).run();
  return row;
}

/** POST /api/parent: read the dashboard data. */
export async function readDashboard(db: DB, body: Record<string, unknown>, now = Date.now()) {
  const row = await authorize(db, body, now);
  const since = now - LIMITS.readDays * 86_400_000;
  const { results } = await db
    .prepare(
      `SELECT ts, problem_id, topic, grade, level, correct, first_try, skipped, hints, seconds, answer, mode
       FROM attempts WHERE family = ? AND ts >= ? ORDER BY ts DESC LIMIT 5000`
    )
    .bind(row.key, since)
    .all<Record<string, unknown>>();
  return {
    child: { name: row.child_name ?? '', grade: row.grade ?? 2 },
    lastSync: row.last_sync,
    snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
    attempts: results.map((r) => ({
      ts: Number(r.ts),
      problemId: String(r.problem_id),
      topicId: String(r.topic),
      grade: Number(r.grade),
      level: Number(r.level),
      correct: !!r.correct,
      firstTry: !!r.first_try,
      skipped: !!r.skipped,
      hints: Number(r.hints),
      seconds: Number(r.seconds),
      answer: (r.answer as string | null) ?? undefined,
      mode: String(r.mode)
    }))
  };
}

/** POST /api/parent with action "delete": erase everything for this family. */
export async function deleteFamily(db: DB, body: Record<string, unknown>, now = Date.now()) {
  const row = await authorize(db, body, now);
  await db.batch([
    db.prepare('DELETE FROM attempts WHERE family = ?').bind(row.key),
    db.prepare('DELETE FROM families WHERE key = ?').bind(row.key)
  ]);
  return { ok: true, deleted: true };
}

/* ---------------- HTTP helpers for the Pages Functions ---------------- */

export function sameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const ref = request.headers.get('origin') ?? request.headers.get('referer');
  if (!ref) return true;
  try {
    return new URL(ref).host === url.host;
  } catch {
    return false;
  }
}

export async function readJson(request: Request, maxBytes = 400_000): Promise<Record<string, unknown>> {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'Request too large');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Wraps a handler: same-origin check, DB presence, JSON parsing and error mapping. */
export async function handle(request: Request, db: DB | undefined, fn: (db: DB, body: Record<string, unknown>) => Promise<unknown>): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: 'Forbidden' });
  if (!db) return json(503, { error: 'Parent dashboard storage is not set up yet' });
  try {
    return json(200, await fn(db, await readJson(request)));
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    return json(500, { error: 'Something went wrong' });
  }
}
