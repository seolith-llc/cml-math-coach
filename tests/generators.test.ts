import { describe, expect, it } from 'vitest';
import { TOPICS, makeMeet, makeProblem, problemFromId } from '../src/content/topics';
import { checkAnswer, formatAnswer } from '../src/core/answer';
import type { Grade, Level } from '../src/core/types';

const SEEDS = 120;

describe('every topic generator', () => {
  for (const topic of TOPICS) {
    for (const grade of topic.grades) {
      for (const level of [1, 2, 3] as Level[]) {
        it(`${topic.id} G${grade} L${level} makes sound problems`, () => {
          for (let s = 1; s <= SEEDS; s++) {
            const p = makeProblem(topic, grade as Grade, level, s * 7919);
            const ctx = `${p.id}: ${p.text}`;
            expect(p.text, ctx).not.toMatch(/NaN|undefined|Infinity|\[object/);
            expect(p.steps.join(' '), ctx).not.toMatch(/NaN|undefined|Infinity/);
            expect(p.hints.length, ctx).toBeGreaterThan(0);
            expect(p.steps.length, ctx).toBeGreaterThan(0);
            // the canonical formatted answer must be accepted by the checker
            expect(checkAnswer(p.answer, formatAnswer(p.answer)).correct, `${ctx} -> ${formatAnswer(p.answer)}`).toBe(true);
            if (p.answer.kind === 'number') {
              expect(Number.isInteger(p.answer.value), ctx).toBe(true);
              expect(p.answer.value, ctx).toBeGreaterThanOrEqual(0);
            }
            if (p.answer.kind === 'money') expect(p.answer.cents, ctx).toBeGreaterThan(0);
            // no misconception may be accepted as the right answer
            for (const m of p.misconceptions ?? []) {
              expect(checkAnswer(p.answer, formatAnswer(m.answer)).correct, `${ctx} misconception ${formatAnswer(m.answer)}`).toBe(false);
            }
            expect(problemFromId(p.id)?.text).toBe(p.text);
          }
        });
      }
    }
  }
});

describe('mock meet', () => {
  it('has 6 distinct topics for both grades', () => {
    for (const g of [2, 3] as Grade[])
      for (let s = 1; s < 50; s++) {
        const meet = makeMeet(g, s);
        expect(meet).toHaveLength(6);
        expect(new Set(meet.map((p) => p.topicId)).size).toBe(6);
      }
  });
});

describe('specific maths checks', () => {
  it('heads and legs answers are consistent', () => {
    const topic = TOPICS.find((t) => t.id === 'heads-legs')!;
    for (let s = 1; s < 200; s++) {
      const p = makeProblem(topic, 2, 2, s);
      const [heads, legs] = (p.text.match(/\d+/g) ?? []).map(Number);
      const big = (p.answer as { value: number }).value;
      const [small, large] = p.text.includes('wheels') ? [2, 3] : [2, 4];
      expect((heads - big) * small + big * large).toBe(legs);
    }
  });
  it('calendar answers match Date arithmetic', () => {
    const topic = TOPICS.find((t) => t.id === 'calendar')!;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let s = 1; s < 200; s++) {
      const p = makeProblem(topic, 2, 1, s);
      const m = p.text.match(/1st day of the month is a (\w+), then the (\d+)/)!;
      const start = days.indexOf(m[1]);
      const d = new Date(2024, 0, 1 + ((7 + start - 1) % 7)); // Jan 1 2024 = Monday
      expect(days[d.getDay()]).toBe(m[1]);
      d.setDate(d.getDate() + +m[2] - 1);
      expect((p.answer as { value: string }).value).toBe(days[d.getDay()]);
    }
  });
});
