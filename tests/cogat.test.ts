import { describe, expect, it } from 'vitest';
import { TOPICS, makeMeet, makeProblem, topicsForGrade } from '../src/content/topics';
import { checkAnswer, parseChoice } from '../src/core/answer';
import { POINTY, holesAfter, type Fig } from '../src/content/cogat/figures';
import { classify } from '../src/content/cogat/nonverbal';
import { Rng } from '../src/core/rng';
import { _test } from '../src/content/cogat/verbal';
import type { Grade, Level } from '../src/core/types';

const cogat = TOPICS.filter((t) => t.track === 'cogat');

describe('CogAT track', () => {
  it('has the three batteries with three question types each', () => {
    expect(cogat.map((t) => t.category)).toEqual(['Verbal', 'Verbal', 'Verbal', 'Quantitative', 'Quantitative', 'Quantitative', 'Nonverbal', 'Nonverbal', 'Nonverbal']);
    for (const g of [2, 3] as Grade[]) expect(topicsForGrade(g, 'cogat')).toHaveLength(9);
  });

  it('stays out of CML practice and tests', () => {
    for (const g of [2, 3] as Grade[]) {
      expect(topicsForGrade(g).some((t) => t.track === 'cogat')).toBe(false);
      for (let s = 1; s <= 30; s++) expect(makeMeet(g, s, 20).some((p) => p.topicId.startsWith('cogat'))).toBe(false);
    }
  });

  for (const t of cogat)
    for (const grade of t.grades)
      it(`${t.id} G${grade}: well-formed multiple choice`, () => {
        for (let s = 1; s <= 150; s++) {
          const p = makeProblem(t, grade, ((s % 3) + 1) as Level, s * 104729);
          const a = p.answer;
          expect(a.kind, p.id).toBe('choice');
          if (a.kind !== 'choice') continue;
          expect(a.options, p.id).toHaveLength(grade === 2 ? 3 : 5);
          expect(new Set(a.options).size, `${p.id} duplicate options`).toBe(a.options.length);
          if (a.pictures) {
            expect(a.pictures, p.id).toHaveLength(a.options.length);
            expect(new Set(a.pictures).size, `${p.id} duplicate pictures`).toBe(a.pictures.length);
            for (const pic of a.pictures) expect(pic, p.id).not.toMatch(/NaN|undefined/);
          }
          // tapping, saying the letter, and saying the option all work; no other option is accepted
          const i = a.value.charCodeAt(0) - 97;
          expect(checkAnswer(a, a.value).correct, p.id).toBe(true);
          expect(checkAnswer(a, a.options[i]).correct, `${p.id} by name`).toBe(true);
          a.options.forEach((o, k) => k !== i && expect(checkAnswer(a, String.fromCharCode(97 + k)).correct, `${p.id} ${o}`).toBe(false));
          if (p.figure) expect(p.figure, p.id).not.toMatch(/NaN|undefined/);
          for (const m of p.misconceptions ?? []) expect(checkAnswer(a, (m.answer as { value: string }).value).correct, p.id).toBe(false);
        }
      });

  it('Grade 2 verbal items are pictures; Grade 3 verbal items are words', () => {
    for (const id of ['cogat-analogies', 'cogat-sentences', 'cogat-classification']) {
      const t = TOPICS.find((x) => x.id === id)!;
      for (let s = 1; s <= 20; s++) {
        const g2 = makeProblem(t, 2, 2, s).answer, g3 = makeProblem(t, 3, 2, s).answer;
        expect(g2.kind === 'choice' && g2.pictures?.length, id).toBe(3);
        expect(g3.kind === 'choice' && g3.pictures, id).toBeUndefined();
      }
    }
  });

  it('figure classification: exactly one choice shares everything the three pictures visibly share', () => {
    // what a child can see: shape, colour, looks big, how many, which way it points
    const traits = (f: Fig) => ({ shape: f.shape, fill: f.fill, big: f.count === 1 && f.size === 'L', count: f.count, dir: POINTY.includes(f.shape) ? f.rot : -1 });
    for (const grade of [2, 3] as Grade[])
      for (let s = 1; s <= 400; s++) {
        const it = classify(grade, new Rng(s));
        if (!it) continue;
        const t = it.stim.map(traits);
        const shared = (Object.keys(t[0]) as (keyof ReturnType<typeof traits>)[]).filter((k) => t.every((x) => x[k] === t[0][k]) && !(k === 'dir' && t[0].dir === -1));
        expect(shared.length, `seed ${s}`).toBeGreaterThan(0);
        const fits = it.options.filter((o) => shared.every((k) => traits(o)[k] === t[0][k]));
        expect(fits, `G${grade} seed ${s}: ${shared.join(',')}`).toEqual([it.ans]);
      }
  });

  it('paper folding: each fold doubles the holes', () => {
    expect(holesAfter([0.875, 0.125], ['v'])).toEqual([[0.875, 0.125], [0.125, 0.125]]);
    expect(holesAfter([0.625, 0.875], ['v', 'h'])).toHaveLength(4);
    expect(holesAfter([0.125, 0.875], ['d'])).toEqual([[0.125, 0.875], [0.875, 0.125]]);
  });

  it('banks are original-sized and consistent', () => {
    for (const r of _test.RELATIONS) expect(r.pairs.length, r.name).toBeGreaterThanOrEqual(4);
    for (const q of _test.WORD_SENTENCES) {
      expect(q.s, q.s).toContain('___');
      expect(q.d, q.s).not.toContain(q.a);
      expect(q.d.length, q.s).toBeGreaterThanOrEqual(4);
    }
    for (const q of _test.PICTURE_SENTENCES) {
      expect(q.d.map((d) => d[0]), q.q).not.toContain(q.a[0]);
      expect(new Set([q.a[1], ...q.d.map((d) => d[1])]).size, `${q.q} pictures`).toBe(q.d.length + 1);
    }
    expect(_test.PICTURE_SENTENCES.length).toBeGreaterThanOrEqual(40);
    expect(_test.WORD_SENTENCES.length).toBeGreaterThanOrEqual(40);
    expect(_test.RELATIONS.filter((r) => r.picture).length).toBeGreaterThanOrEqual(9);
    expect(new Set(_test.ITEMS.map((i) => i[0])).size).toBe(_test.ITEMS.length);
  });

  it('a spoken option name beats a letter that sounds the same', () => {
    expect(parseChoice('bee', ['ant', 'cat', 'bee'])).toBe('c');
    expect(parseChoice('(b) two big black diamonds', ['x', 'two big black diamonds'])).toBe('b');
    expect(parseChoice('see', ['ant', 'cat', 'bee'])).toBe('c');
  });
});
