import { describe, expect, it } from 'vitest';
import { Coach } from '../src/core/coach';
import { Rng } from '../src/core/rng';
import type { Problem } from '../src/core/types';

const problem: Problem = {
  id: 't', topicId: 'missing-number', grade: 2, level: 1,
  text: '32 − □ = 28', answer: { kind: 'number', value: 4 },
  hints: ['h1', 'h2'], steps: ['32 − 28 = 4'],
  misconceptions: [{ answer: { kind: 'number', value: 60 }, feedback: 'You added.' }]
};

describe('Coach', () => {
  it('accepts if any speech alternative is right', () => {
    const c = new Coach(problem, new Rng(1));
    expect(c.answer(['for', 'four']).verdict).toBe('correct');
    expect(c.firstTryCorrect).toBe(true);
  });
  it('gives a targeted message, then reveals', () => {
    const c = new Coach(problem, new Rng(1));
    const f1 = c.answer(['60']);
    expect(f1.verdict).toBe('wrong');
    expect(f1.message).toContain('You added.');
    expect(f1.reveal).toBe(false);
    const f2 = c.answer(['5']);
    expect(f2.reveal).toBe(true);
    expect(f2.message).toContain('The answer is 4');
  });
  it('does not count gibberish as a try', () => {
    const c = new Coach(problem, new Rng(1));
    expect(c.answer(['hello there']).verdict).toBe('unclear');
    expect(c.tries).toBe(0);
  });
});
