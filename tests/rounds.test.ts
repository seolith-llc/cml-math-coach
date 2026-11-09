import { describe, expect, it } from 'vitest';
import { defaultState, lastRound, saveRound } from '../src/core/storage';
import { keepRound, restoreRound } from '../src/ui/roundEnd';
import { TOPICS, makeProblem } from '../src/content/topics';

describe('saved rounds', () => {
  it('keeps the last round per grade and kind, and restores the same problems', () => {
    const state = defaultState();
    const cogat = TOPICS.find((t) => t.id === 'cogat-paper-folding')!;
    const p1 = makeProblem(cogat, 2, 1, 11), p2 = makeProblem(cogat, 2, 2, 22);
    keepRound(state, 2, 'cogat', [{ problem: p1, ok: true }, { problem: p2, ok: false, answer: 'b' }], 1000);
    const saved = lastRound(state, 2, 'cogat')!;
    expect(saved.items).toEqual([{ problemId: p1.id, ok: true }, { problemId: p2.id, ok: false, answer: 'b' }]);
    expect(lastRound(state, 3, 'cogat')).toBeUndefined();
    expect(lastRound(state, 2, 'cml')).toBeUndefined();

    const items = restoreRound(saved);
    expect(items.map((i) => i.problem.text)).toEqual([p1.text, p2.text]);
    // a fix on a second try is saved too
    items[1].fixed = true;
    keepRound(state, 2, 'cogat', items, saved.at);
    expect(lastRound(state, 2, 'cogat')).toMatchObject({ at: 1000, items: [{ ok: true }, { ok: false, fixed: true }] });
  });

  it('a newer round of the same kind replaces the old one; unknown problems are skipped', () => {
    const state = defaultState();
    saveRound(state, { kind: 'cml', grade: 3, at: 1, items: [{ problemId: 'nope:3:1:1', ok: true }] });
    saveRound(state, { kind: 'cml', grade: 3, at: 2, items: [{ problemId: 'nope:3:1:2', ok: false }] });
    expect(lastRound(state, 3, 'cml')!.at).toBe(2);
    expect(restoreRound(lastRound(state, 3, 'cml')!)).toEqual([]);
  });
});
