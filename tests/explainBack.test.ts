import { describe, expect, it } from 'vitest';
import { reasonPool, reasonQuestion } from '../src/core/explainBack';
import { makeProblem, topicById, topicsForGrade } from '../src/content/topics';
import { Rng } from '../src/core/rng';
import { roundStickers } from '../src/content/stickers';

describe('"How did you know?" (step084)', () => {
  it('offers this puzzle’s own first step and two others, all different, for every family', () => {
    for (const g of [2, 3] as const) for (const track of ['number', 'thinking'] as const) for (const t of topicsForGrade(g, track)) {
      const p = makeProblem(t, g, 2, 11);
      const rng = new Rng(5);
      const q = reasonQuestion(p, reasonPool(p, rng, 6), rng);
      expect(q, t.id).not.toBeNull();
      expect(new Set(q!.options).size).toBe(3);
      expect(q!.options[q!.right]).toBe(p.steps[0].replace(/\*\*/g, '').trim());
      expect(q!.options.join('')).not.toContain('**');
    }
  });
  it('borrows from the same family (other numbers) and other families of the same track; each with real words', () => {
    const p = makeProblem(topicById('magic-square')!, 2, 1, 3);
    const pool = reasonPool(p, new Rng(9), 8);
    expect(pool.filter((o) => o.topicId === 'magic-square').length).toBe(3);
    for (const o of pool) expect(topicById(o.topicId)!.track ?? 'number').toBe('number');
    const q = reasonQuestion(p, pool, new Rng(2))!;
    for (const o of q.options) expect(o).toMatch(/[a-z]{3,}/i);
    expect(q.options.filter((o) => o.startsWith('A full line') || o.includes('Every line')).length).toBeGreaterThanOrEqual(1);
  });
  it('a right reason earns a Thinker sticker (within the daily cap)', () => {
    expect(roundStickers({ right: 3, fixed: 0, total: 10, starsGained: 0, goalReached: false, todayCount: 0, reasoned: 1 })).toEqual(['thinker']);
    expect(roundStickers({ right: 3, fixed: 1, total: 10, starsGained: 0, goalReached: false, todayCount: 2, reasoned: 1 })).toEqual(['fixer']);
  });
});

describe('the heavy coin and the frog (step084)', async () => {
  const { makeProblem: mk, topicById: tb } = await import('../src/content/topics');
  it('heavy coin: steps agree with the answer and never use an empty group', () => {
    for (let seed = 1; seed < 200; seed++) for (const g of [2, 3] as const) for (const l of [1, 2] as const) {
      const p = mk(tb('heavy-coin')!, g, l, seed);
      const n = Number(p.text.match(/\*\*(\d+) coins\*\*/)![1]);
      const k = (p.answer as { value: number }).value;
      expect(3 ** (k - 1)).toBeLessThan(n);
      expect(3 ** k).toBeGreaterThanOrEqual(n);
      expect(p.steps.length).toBe(k + 1);
      if (n > 3) expect(p.steps[0]).not.toMatch(/ and 0\)/);
    }
  });
  it('frog: escapes on the answer day and not before', () => {
    for (let seed = 1; seed < 200; seed++) for (const g of [2, 3] as const) for (const l of [1, 2, 3] as const) {
      const p = mk(tb('frog-well')!, g, l, seed);
      const [depth, up, back] = [...p.text.replace(/\*\*/g, '').matchAll(/(\d+)/g)].map((m) => +m[1]);
      let at = 0, day = 0;
      for (;;) { day++; if (at + up >= depth) break; at = at + up - back; }
      expect((p.answer as { value: number }).value).toBe(day);
    }
  });
});
