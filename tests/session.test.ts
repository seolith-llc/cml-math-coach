import { describe, expect, it } from 'vitest';
import { Countdown, DEFAULT_TEST, clockSeconds, formatClock, formatDuration, normalizeTest, summary, warnAt } from '../src/core/session';
import { makeMeet } from '../src/content/topics';
import type { Grade } from '../src/core/types';

describe('test config', () => {
  it('defaults to a CML meet and snaps values to the allowed lists', () => {
    expect(normalizeTest(undefined)).toEqual(DEFAULT_TEST);
    expect(normalizeTest({ count: 9, totalMinutes: 27, eachSeconds: 100, feedback: 'learn', clock: 'each' }))
      .toEqual({ count: 10, feedback: 'learn', clock: 'each', totalMinutes: 30, eachSeconds: 90 });
    expect(normalizeTest({ count: 'x' as never, clock: 'weird' as never }).count).toBe(6);
    expect(normalizeTest({ clock: 'weird' as never }).clock).toBe('total');
  });
  it('covers the four modes: unlimited, whole-test clock, per-question clock, learning', () => {
    expect(clockSeconds({ ...DEFAULT_TEST, clock: 'off' })).toBeNull();
    expect(clockSeconds({ ...DEFAULT_TEST, clock: 'total', totalMinutes: 45 })).toBe(2700);
    expect(clockSeconds({ ...DEFAULT_TEST, clock: 'each', eachSeconds: 90 })).toBe(90);
    expect(summary(DEFAULT_TEST)).toBe('6 · 30 min');
    expect(summary({ ...DEFAULT_TEST, count: 10, clock: 'each', eachSeconds: 120 })).toBe('10 · 2 min each');
    expect(summary({ ...DEFAULT_TEST, clock: 'off' })).toBe('6');
    expect(summary({ ...DEFAULT_TEST, feedback: 'learn', clock: 'each', eachSeconds: 90 })).toBe('Learn · 6 · 90 s each');
  });
  it('formats clocks and durations', () => {
    expect(formatClock(1800)).toBe('30:00');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(-3)).toBe('0:00');
    expect(formatDuration(90)).toBe('90 s');
    expect(formatDuration(120)).toBe('2 min');
    expect(warnAt(1800)).toBe(60);
    expect(warnAt(30)).toBe(6);
  });
  it('counts down on wall-clock time', () => {
    const c = new Countdown(90, 1_000);
    expect(c.left(1_000)).toBe(90);
    expect(c.left(31_000)).toBe(60);
    expect(c.expired(90_999)).toBe(false);
    expect(c.expired(91_000)).toBe(true);
    expect(c.left(200_000)).toBe(0);
  });
});

describe('makeMeet with a question count', () => {
  it('returns the requested number of distinct topics, harder towards the end', () => {
    for (const g of [2, 3] as Grade[])
      for (const n of [6, 10, 15, 20])
        for (let s = 1; s < 25; s++) {
          const m = makeMeet(g, s, n);
          expect(m).toHaveLength(n);
          expect(new Set(m.map((p) => p.topicId)).size).toBe(n);
          expect(m[0].level).toBe(1);
          expect(Math.max(...m.map((p) => p.level))).toBe(g === 2 ? 2 : 3);
          expect(m.map((p) => p.level)).toEqual([...m.map((p) => p.level)].sort());
        }
  });
});
