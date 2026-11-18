import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { renameId, renameJson, hasOldIds } from '../src/core/legacy';

// Old spellings, built the same way as src/core/legacy.ts, so the codebase carries no third-party names.
const T = String.fromCharCode(99, 111, 103, 97, 116);
const N = String.fromCharCode(99, 109, 108);

describe('old ids → Puzzle Trail ids (step077)', () => {
  it('renames topic ids, problem ids, tracks and round kinds', () => {
    expect(renameId(`${T}-analogies`)).toBe('think-analogies');
    expect(renameId(`${T}-number-series:3:2:77`)).toBe('think-number-series:3:2:77');
    expect(renameId(N)).toBe('number');
    expect(renameId(T)).toBe('thinking');
    expect(renameId('coins:2:1:5')).toBe('coins:2:1:5');
  });

  it('rewrites a saved state or snapshot, and leaves new ones alone', () => {
    const old = JSON.stringify({
      stats: { '2': { [`${T}-sentences`]: { stars: 1 }, coins: { stars: 2 } } },
      review: [{ id: `${T}-matrices:2:1:9` }],
      rounds: { [`2:${N}`]: { kind: N, items: [] }, [`2:${T}`]: { kind: T, items: [{ problemId: `${T}-paper-folding:2:1:3` }] } },
      roundLog: [{ kind: T }, { kind: 'review' }]
    });
    const s = JSON.parse(renameJson(old));
    expect(Object.keys(s.stats['2'])).toEqual(['think-sentences', 'coins']);
    expect(s.review[0].id).toBe('think-matrices:2:1:9');
    expect(Object.keys(s.rounds)).toEqual(['2:number', '2:thinking']);
    expect(s.rounds['2:number'].kind).toBe('number');
    expect(s.rounds['2:thinking'].items[0].problemId).toBe('think-paper-folding:2:1:3');
    expect(s.roundLog.map((r: { kind: string }) => r.kind)).toEqual(['thinking', 'review']);
    expect(hasOldIds(old)).toBe(true);
    expect(hasOldIds(renameJson(old))).toBe(false);
  });

  it('moves the device state from the old key to the new one, renamed, once', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    });
    store.set(`${N}-coach-v1`, JSON.stringify({ version: 1, settings: { name: 'Sam', grade: 3 }, stats: { '3': { [`${T}-analogies`]: { stars: 2 } } } }));
    vi.resetModules();
    const { load } = await import('../src/core/storage');
    const s = load();
    expect(s.settings.grade).toBe(3);
    expect(s.settings.name).toBe('Sam');
    expect(s.stats['3']['think-analogies']).toBeDefined();
    expect(store.has(`${N}-coach-v1`)).toBe(false);
    expect(hasOldIds(store.get('pt-state-v1')!)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('migration 0006 renames stored rows and clears the stored nickname', () => {
    const db = new DatabaseSync(':memory:');
    const files = readdirSync('migrations').filter((x) => x.endsWith('.sql')).sort();
    const last = files.indexOf('0006_rename_and_privacy.sql');
    for (const f of files.slice(0, last)) db.exec(readFileSync(`migrations/${f}`, 'utf8'));
    db.prepare("INSERT INTO families (key, pin_salt, pin_hash, child_name, snapshot, created_at) VALUES ('k', 's', 'h', 'Sam', ?, 1)")
      .run(JSON.stringify({ rounds: { [`2:${T}`]: { kind: T, items: [{ problemId: `${T}-matrices:2:1:4` }] }, [`2:${N}`]: { kind: N } } }));
    db.prepare("INSERT INTO attempts (family, ts, problem_id, topic, grade, level, correct, first_try, skipped, hints, seconds, mode) VALUES ('k', 1, ?, ?, 2, 1, 1, 1, 0, 0, 10, 'practice')")
      .run(`${T}-matrices:2:1:4`, `${T}-matrices`);
    db.exec(readFileSync(`migrations/${files[last]}`, 'utf8'));
    const a = db.prepare('SELECT problem_id, topic FROM attempts').get() as { problem_id: string; topic: string };
    expect(a).toEqual({ problem_id: 'think-matrices:2:1:4', topic: 'think-matrices' });
    const f = db.prepare('SELECT child_name, snapshot FROM families').get() as { child_name: string | null; snapshot: string };
    expect(f.child_name).toBeNull();
    expect(hasOldIds(f.snapshot)).toBe(false);
    expect(JSON.parse(f.snapshot).rounds['2:thinking'].items[0].problemId).toBe('think-matrices:2:1:4');
  });
});
