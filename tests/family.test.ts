import { describe, expect, it } from 'vitest';
import { makeProblem, topicById } from '../src/content/topics';
import { checkAnswer, diagnose } from '../src/core/answer';
import type { Grade, Level } from '../src/core/types';

/** The question as read (no **bold** markers), for parsing numbers and names out of it. */
const plain = (s: string) => s.replace(/\*\*/g, '');

const topic = topicById('brothers-sisters')!;

/** Independent re-implementation: parse the clue sentences and brute-force all families. */
function familiesFitting(text: string): [number, number][] {
  const [, boy, girl] = text.match(/^(\w+) is (\w+)'s brother\./)!;
  const sentences = text.split(/(?<=\.)\s+/).slice(1, -1);
  const fits: [number, number][] = [];
  for (let B = 1; B <= 15; B++)
    for (let G = 1; G <= 15; G++) {
      const ok = sentences.every((sen) => {
        const isGirl = sen.startsWith(girl + ' ');
        if (!isGirl && !sen.startsWith(boy + ' ')) throw new Error('unknown clue ' + sen);
        const s = isGirl ? G - 1 : G;
        const b = isGirl ? B : B - 1;
        let m;
        if (/as many sisters as brothers\.$/.test(sen) && !/times|twice/.test(sen)) return s === b;
        if ((m = sen.match(/has (twice|three times) as many (sisters|brothers) as/))) {
          const k = m[1] === 'twice' ? 2 : 3;
          return m[2] === 'sisters' ? s === k * b : b === k * s;
        }
        if ((m = sen.match(/has (\d+) more (sister|brother)s? than/))) return m[2] === 'sister' ? s - b === +m[1] : b - s === +m[1];
        if ((m = sen.match(/has (\d+) (sister|brother)s?\.$/))) return m[2] === 'sister' ? s === +m[1] : b === +m[1];
        throw new Error('unparsed clue ' + sen);
      });
      if (ok) fits.push([B, G]);
    }
  return fits;
}

describe('brothers & sisters puzzles', () => {
  it('every generated puzzle has exactly one family, and the answer matches it', () => {
    for (const grade of [2, 3] as Grade[])
      for (const level of [2, 3] as Level[])
        for (let s = 1; s <= 150; s++) {
          const p = makeProblem(topic, grade, level, s);
          const fits = familiesFitting(plain(p.text));
          expect(fits, p.text).toHaveLength(1);
          const [B, G] = fits[0];
          const ask = plain(p.text).match(/How many (\w+) are in the family\?/)![1];
          const want = ask === 'children' ? B + G : ask === 'boys' ? B : G;
          expect((p.answer as { value: number }).value, p.text).toBe(want);
          if (grade === 2) expect(p.text).not.toMatch(/twice|three times/);
        }
  });

  it('level-1 counting respects "nobody is their own sister/brother"', () => {
    for (let s = 1; s <= 100; s++) {
      const p = makeProblem(topic, 2, 1, s);
      const [, boys, girls] = plain(p.text).match(/has (\d+) boys? and (\d+) girls?/)!.map(Number);
      const isGirl = /one of the girls/.test(plain(p.text));
      const askSisters = /How many sisters/.test(plain(p.text));
      const want = askSisters ? girls - (isGirl ? 1 : 0) : boys - (isGirl ? 0 : 1);
      expect((p.answer as { value: number }).value, p.text).toBe(want);
    }
  });

  it('explains the "counted yourself" mistake', () => {
    let seen = 0;
    for (let s = 1; s <= 200 && seen < 5; s++) {
      const p = makeProblem(topic, 3, 3, s);
      const self = p.misconceptions?.find((m) => /counts herself/.test(m.feedback));
      if (!self) continue;
      seen++;
      const wrong = String((self.answer as { value: number }).value);
      expect(checkAnswer(p.answer, wrong).correct).toBe(false);
      expect(diagnose(p, wrong)).toMatch(/Leave the child who is talking out/);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
