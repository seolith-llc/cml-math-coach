import { describe, expect, it } from 'vitest';
import { THINK_SECONDS, helpState, maxTriesFor } from '../src/core/thinkFirst';

describe('think before help (step083)', () => {
  it('opens the hint after one wrong try or 30 seconds', () => {
    expect(helpState({ tries: 0, hintsUsed: 0, hintCount: 2, elapsedMs: 5000 })).toEqual({ hintOpen: false, answerOpen: false, hintIn: 25 });
    expect(helpState({ tries: 0, hintsUsed: 0, hintCount: 2, elapsedMs: THINK_SECONDS * 1000 }).hintOpen).toBe(true);
    expect(helpState({ tries: 1, hintsUsed: 0, hintCount: 2, elapsedMs: 1000 }).hintOpen).toBe(true);
  });
  it('opens the answer only after 2 wrong tries and every hint (3 on the Big Puzzle)', () => {
    expect(helpState({ tries: 2, hintsUsed: 1, hintCount: 2, elapsedMs: 0 }).answerOpen).toBe(false);
    expect(helpState({ tries: 1, hintsUsed: 2, hintCount: 2, elapsedMs: 0 }).answerOpen).toBe(false);
    expect(helpState({ tries: 2, hintsUsed: 2, hintCount: 2, elapsedMs: 0 }).answerOpen).toBe(true);
    expect(helpState({ tries: 2, hintsUsed: 2, hintCount: 2, elapsedMs: 0, big: true }).answerOpen).toBe(false);
    expect(helpState({ tries: 3, hintsUsed: 2, hintCount: 2, elapsedMs: 0, big: true }).answerOpen).toBe(true);
  });
  it('gives typed answers 3 tries, choices 2, the Big Puzzle no limit', () => {
    expect(maxTriesFor({ kind: 'number', value: 3 })).toBe(3);
    expect(maxTriesFor({ kind: 'choice', value: 'a', options: [] } as never)).toBe(2);
    expect(maxTriesFor({ kind: 'number', value: 3 }, true)).toBe(Infinity);
  });
});

describe('desirable difficulty: about 70% first try (step083)', async () => {
  const { levelFor, LEVEL_UP } = await import('../src/core/mastery');
  const { STAR_RULES, starsFor } = await import('../src/core/progress');
  const st = (mastery: number, attempts: number) => ({ stats: { '2': { t: { attempts, correct: 0, mastery, streak: 0, lastSeen: 0 } } } }) as never;
  it('moves up a level at 45% and to the hardest at 70%', () => {
    expect(levelFor(st(0.44, 3), 2, 't')).toBe(1);
    expect(levelFor(st(0.45, 3), 2, 't')).toBe(2);
    expect(levelFor(st(0.7, 3), 2, 't')).toBe(2); // not enough tries yet
    expect(levelFor(st(0.7, 4), 2, 't')).toBe(3);
  });
  it('stars follow the same thresholds; ★★★ needs a long run', () => {
    expect(STAR_RULES[0]).toEqual(LEVEL_UP.two);
    expect(STAR_RULES[1]).toEqual(LEVEL_UP.three);
    expect(starsFor({ mastery: 0.8, attempts: 20 })).toBe(2);
    expect(starsFor({ mastery: 0.86, attempts: 8 })).toBe(3);
  });
});
