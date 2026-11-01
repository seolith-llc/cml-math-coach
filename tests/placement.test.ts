import { describe, expect, it } from 'vitest';
import { makeProblem, topicById } from '../src/content/topics';
import { checkAnswer, diagnose, parseDigits } from '../src/core/answer';
import { permutations } from '../src/content/generators/helpers';
import type { Grade, Level } from '../src/core/types';

const isPal = (s: string) => s === s.split('').reverse().join('');

describe('palindromes', () => {
  it('template puzzles have exactly one completion that uses all digits', () => {
    const t = topicById('palindromes')!;
    for (const grade of [2, 3] as Grade[])
      for (let s = 1; s < 150; s++) {
        const p = makeProblem(t, grade, 2, s);
        if (p.answer.kind !== 'digits') continue;
        const value = p.answer.value;
        expect(isPal(value)).toBe(true);
        const shown = p.text.match(/\*\*(.+)\*\*/)![1].split(' ');
        const digits = p.text.match(/digits ([\d, ]+), complete/)![1].split(', ').map(Number);
        const k = digits.length, len = 2 * k - 1;
        const fits = permutations(digits)
          .map((half) => Array.from({ length: len }, (_, i) => half[Math.min(i, len - 1 - i)]).join(''))
          .filter((c) => shown.every((ch, i) => ch === '_' || ch === c[i]));
        expect(fits).toEqual([value]);
        expect(shown.includes('_')).toBe(true);
      }
  });
  it('level-1 choices contain exactly one palindrome', () => {
    const t = topicById('palindromes')!;
    for (let s = 1; s < 100; s++) {
      const p = makeProblem(t, 3, 1, s);
      if (p.answer.kind !== 'choice') throw new Error('expected choice');
      expect(p.answer.options.filter((o) => isPal(o.replace(/,/g, '')))).toHaveLength(1);
    }
  });
  it('accepts digits typed or spoken many ways', () => {
    for (const s of ['6897986', '6,897,986', '6 8 9 7 9 8 6', '6, 8 9 7, 9 8 6', 'six eight nine seven nine eight six'])
      expect(parseDigits(s), s).toBe('6897986');
  });
});

describe('digit placement', () => {
  const t = topicById('digit-placement')!;
  it('stored solutions are valid and any other valid arrangement is accepted', () => {
    for (const grade of [2, 3] as Grade[])
      for (const level of [2, 3] as Level[])
        for (let s = 1; s < 60; s++) {
          const p = makeProblem(t, grade, level, s);
          if (p.answer.kind !== 'placement') continue;
          const a = p.answer;
          expect(checkAnswer(a, a.solution.join('')).correct).toBe(true);
          // every valid permutation must be accepted, every invalid one rejected
          for (const perm of permutations(a.digits)) {
            const ok = a.lines.every((l) => l.reduce((x, i) => x + perm[i], 0) === a.target);
            expect(checkAnswer(a, perm.join('')).correct).toBe(ok);
          }
        }
  });
  it('explains which line is wrong', () => {
    const p = makeProblem(t, 2, 2, 7);
    if (p.answer.kind !== 'placement') throw new Error();
    const bad = [...p.answer.digits].join(''); // 1..5 in order - rarely valid
    if (!checkAnswer(p.answer, bad).correct) expect(diagnose(p, bad)).toMatch(/adds to|exactly once/);
    expect(diagnose(p, '11111')).toMatch(/exactly once/);
    expect(diagnose(p, '12_45')).toMatch(/Fill all/);
  });
  it('corner square: corner number works on every side', () => {
    for (let s = 1; s < 100; s++) {
      const p = makeProblem(t, 3, 1, s);
      const T = +p.text.match(/adds to (\d+)/)![1];
      const x = (p.answer as { value: number }).value;
      const pairs = [...p.speech!.matchAll(/(\d+) and (\d+)/g)].map((m) => +m[1] + +m[2]);
      expect(pairs).toHaveLength(4);
      for (const m of pairs) expect(m + 2 * x).toBe(T);
    }
  });
});
