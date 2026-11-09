import type { AnswerSpec, Grade, Misconception } from '../../core/types';
import type { Rng } from '../../core/rng';

/** Answer choices per item: Grade 2 (CogAT Level 8 style) uses 3, Grade 3 (Level 9 style) uses 5. */
export const choicesFor = (grade: Grade) => (grade === 2 ? 3 : 5);

export const letterOf = (i: number) => String.fromCharCode(97 + i);

export interface MC<T> {
  answer: Extract<AnswerSpec, { kind: 'choice' }>;
  items: T[];
  letter: string;
  /** Misconception for a specific wrong option, if it made the cut. */
  miss: (wrong: T, feedback: string) => Misconception[];
}

/**
 * Build a multiple-choice answer. `wrong` is ordered by preference (the most tempting first);
 * duplicates of each other or of the right answer are dropped. Returns null if there aren't enough.
 */
export function mc<T>(rng: Rng, right: T, wrong: T[], n: number, key: (t: T) => string, name: (t: T) => string, picture?: (t: T) => string): MC<T> | null {
  const seen = new Set([key(right)]);
  const picked: T[] = [];
  for (const w of wrong) {
    if (picked.length === n - 1) break;
    const k = key(w);
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(w);
  }
  if (picked.length < n - 1) return null;
  const items = rng.shuffle([right, ...picked]);
  const names = items.map(name);
  if (new Set(names).size !== names.length) return null;
  const letter = letterOf(items.indexOf(right));
  const answer: MC<T>['answer'] = { kind: 'choice', value: letter, options: names, ...(picture ? { pictures: items.map(picture) } : {}) };
  return {
    answer,
    items,
    letter,
    miss: (w, feedback) => {
      const i = items.findIndex((t) => key(t) === key(w));
      return i < 0 || items[i] === right ? [] : [{ answer: { ...answer, value: letterOf(i) }, feedback }];
    }
  };
}

/** Keep trying until `make` returns something (generators are deterministic per seed). */
export function retry<T>(make: () => T | null, tries = 400): T {
  for (let i = 0; i < tries; i++) {
    const v = make();
    if (v) return v;
  }
  throw new Error('cogat: could not build an item');
}

export const say = (s: string) => s.replace(/→/g, 'becomes');
