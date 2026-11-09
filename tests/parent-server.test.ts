import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { LIMITS, deleteFamily, readDashboard, sync, type DB, type Stmt } from '../server/parent';
import { onRequestPost as syncRoute } from '../functions/api/sync';
import { onRequestPost as parentRoute } from '../functions/api/parent';

/** D1-compatible adapter over node:sqlite, running the real migration. */
export function makeDb(): DB {
  const sqlite = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter((x) => x.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`migrations/${f}`, 'utf8'));
  const stmt = (sql: string, params: unknown[] = []): Stmt => ({
    bind: (...v) => stmt(sql, v),
    first: async <T>() => (sqlite.prepare(sql).get(...(params as never[])) as T) ?? null,
    all: async <T>() => ({ results: sqlite.prepare(sql).all(...(params as never[])) as T[] }),
    run: async () => sqlite.prepare(sql).run(...(params as never[]))
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const s of list) out.push(await s.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    }
  };
}

const FAMILY = 'AbCdEfGhIjKlMnOpQrStUvWx';
const attempt = (i: number, extra: Record<string, unknown> = {}) => ({
  ts: Date.UTC(2026, 10, 1, 10, i), problemId: `calendar:2:1:${i}`, topicId: 'calendar', grade: 2, level: 1,
  correct: true, firstTry: i % 2 === 0, hints: i % 3, seconds: 30 + i, mode: 'practice', ...extra
});

describe('parent dashboard backend', () => {
  it('creates a family on first sync (PIN required) and stores attempts once', async () => {
    const db = makeDb();
    await expect(sync(db, { familyId: FAMILY, attempts: [] })).rejects.toThrow(/PIN/);
    const r = await sync(db, { familyId: FAMILY, pin: '2468', child: { name: 'Sam', grade: 3 }, snapshot: { a: 1, rounds: { '3:cogat': { kind: 'cogat', grade: 3, at: 5, items: [{ problemId: 'cogat-matrices:3:1:2', ok: false, fixed: true }] } } }, attempts: [attempt(1), attempt(2)] });
    expect(r).toMatchObject({ ok: true, received: 2, created: true });
    // re-sending the same attempts does not duplicate them; later syncs need no PIN
    await sync(db, { familyId: FAMILY, attempts: [attempt(1), attempt(2), attempt(3)] });
    const d = await readDashboard(db, { familyId: FAMILY, pin: '2468' });
    expect(d.child).toEqual({ name: 'Sam', grade: 3 });
    expect(d.snapshot).toEqual({ a: 1, rounds: { '3:cogat': { kind: 'cogat', grade: 3, at: 5, items: [{ problemId: 'cogat-matrices:3:1:2', ok: false, fixed: true }] } } });
    expect(d.attempts.map((a) => a.problemId)).toEqual(['calendar:2:1:3', 'calendar:2:1:2', 'calendar:2:1:1']);
    expect(d.attempts[1]).toMatchObject({ firstTry: true, correct: true, hints: 2, seconds: 32, mode: 'practice' });
  });

  it('never stores the raw family id or PIN', async () => {
    const db = makeDb();
    await sync(db, { familyId: FAMILY, pin: '2468', attempts: [] });
    const row = await db.prepare('SELECT * FROM families').first<Record<string, string>>();
    expect(JSON.stringify(row)).not.toContain(FAMILY);
    expect(JSON.stringify(row)).not.toContain('2468');
    expect(row!.pin_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects wrong PINs, then locks after 5 failures', async () => {
    const db = makeDb();
    const t = Date.UTC(2026, 10, 2);
    await sync(db, { familyId: FAMILY, pin: '2468', attempts: [] }, t);
    await expect(readDashboard(db, { familyId: FAMILY, pin: '0000' }, t)).rejects.toMatchObject({ status: 401 });
    await expect(readDashboard(db, { familyId: 'x'.repeat(24), pin: '2468' }, t)).rejects.toMatchObject({ status: 401 });
    for (let i = 0; i < LIMITS.maxFailures - 2; i++) await expect(readDashboard(db, { familyId: FAMILY, pin: '1111' }, t)).rejects.toMatchObject({ status: 401 });
    await expect(readDashboard(db, { familyId: FAMILY, pin: '1111' }, t)).rejects.toMatchObject({ status: 429 });
    await expect(readDashboard(db, { familyId: FAMILY, pin: '2468' }, t + 60_000)).rejects.toMatchObject({ status: 429 }); // even the right PIN
    await expect(readDashboard(db, { familyId: FAMILY, pin: '2468' }, t + LIMITS.lockMs + 1)).resolves.toBeTruthy();
  });

  it('validates input sizes and clamps values', async () => {
    const db = makeDb();
    await expect(sync(db, { familyId: 'short', pin: '2468' })).rejects.toMatchObject({ status: 400 });
    await expect(sync(db, { familyId: FAMILY, pin: '12' })).rejects.toMatchObject({ status: 400 });
    const many = Array.from({ length: LIMITS.attemptsPerSync + 1 }, (_, i) => attempt(i));
    await expect(sync(db, { familyId: FAMILY, pin: '2468', attempts: many })).rejects.toMatchObject({ status: 413 });
    await sync(db, { familyId: FAMILY, pin: '2468', attempts: [attempt(1, { seconds: 99999, hints: -4, mode: 'hack', answer: 'x'.repeat(500) })] });
    const [a] = (await readDashboard(db, { familyId: FAMILY, pin: '2468' })).attempts;
    expect(a).toMatchObject({ seconds: 3600, hints: 0, mode: 'practice' });
    expect(a.answer).toHaveLength(60);
  });

  it('deletes everything with the right PIN only', async () => {
    const db = makeDb();
    await sync(db, { familyId: FAMILY, pin: '2468', attempts: [attempt(1)] });
    await expect(deleteFamily(db, { familyId: FAMILY, pin: '9999' })).rejects.toMatchObject({ status: 401 });
    await deleteFamily(db, { familyId: FAMILY, pin: '2468' });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM attempts').first()).toEqual({ n: 0 });
    await expect(readDashboard(db, { familyId: FAMILY, pin: '2468' })).rejects.toMatchObject({ status: 401 });
  });

  it('HTTP routes: same-origin only, 503 without a database, JSON errors', async () => {
    const db = makeDb();
    const post = (path: string, body: unknown, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
      new Request(`https://cml-math-coach.seolith.com${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    expect((await syncRoute({ request: post('/api/sync', { familyId: FAMILY, pin: '2468' }), env: { DB: db } })).status).toBe(200);
    expect((await syncRoute({ request: post('/api/sync', { familyId: FAMILY }, { 'sec-fetch-site': 'cross-site' }), env: { DB: db } })).status).toBe(403);
    expect((await syncRoute({ request: post('/api/sync', { familyId: FAMILY }), env: {} })).status).toBe(503);
    const ok = await parentRoute({ request: post('/api/parent', { familyId: FAMILY, pin: '2468' }), env: { DB: db } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const bad = await parentRoute({ request: post('/api/parent', { familyId: FAMILY, pin: '0000' }), env: { DB: db } });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: 'Wrong link or PIN' });
  });
});
