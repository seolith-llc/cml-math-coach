import { describe, expect, it } from 'vitest';
import { BIG_FAMILIES, bigPuzzleId } from '../src/core/bigPuzzle';
import { problemFromId, topicsForGrade } from '../src/content/topics';
import { defaultState, saveBig } from '../src/core/storage';

describe('the daily Big Puzzle (step083)', () => {
  it('is the same all day, at the hardest level, and a real puzzle for both grades', () => {
    for (const g of [2, 3] as const) {
      const id = bigPuzzleId('2026-11-18', g);
      expect(bigPuzzleId('2026-11-18', g)).toBe(id);
      const p = problemFromId(id)!;
      expect(p.level).toBe(3);
      expect(p.grade).toBe(g);
      expect(BIG_FAMILIES).toContain(p.topicId);
    }
  });
  it('changes family every day and visits every family the grade has', () => {
    for (const g of [2, 3] as const) {
      const seen = new Set<string>();
      const have = new Set(topicsForGrade(g).map((t) => t.id));
      for (let d = 0; d < 40; d++) {
        const day = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
        const next = new Date(Date.UTC(2026, 10, 2 + d)).toISOString().slice(0, 10);
        expect(bigPuzzleId(day, g).split(':')[0]).not.toBe(bigPuzzleId(next, g).split(':')[0]);
        seen.add(bigPuzzleId(day, g).split(':')[0]);
        expect(problemFromId(bigPuzzleId(day, g))).toBeDefined();
      }
      expect(seen).toEqual(new Set(BIG_FAMILIES.filter((f) => have.has(f))));
    }
  });
  it('keeps the last 60 days of results', () => {
    const s = defaultState();
    const stub = globalThis.localStorage;
    for (let d = 0; d < 70; d++) saveBig(s, new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10), 2, { solved: true, seconds: 60, hints: 0, at: d });
    expect(Object.keys(s.big!)).toHaveLength(60);
    expect(Object.keys(s.big!).sort()[0]).toBe('2026-01-11:2');
    expect(stub).toBe(globalThis.localStorage);
  });
});
