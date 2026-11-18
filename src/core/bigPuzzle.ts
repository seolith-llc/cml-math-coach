/**
 * The daily Big Puzzle (docs/REDESIGN.md §4, step083): one very hard puzzle a day per grade, the same for everyone,
 * always at the hardest level, from the families that need the most thinking. No clock and no try limit
 * (core/thinkFirst.ts): meant to be worked on with a grown-up and celebrated however long it takes.
 */
import type { Grade } from './types';
import { topicsForGrade } from '../content/topics';

/** Families that reward a long think (number track only; checked against the grade's topics). */
export const BIG_FAMILIES = [
  'magic-square', 'rule-machine', 'cryptarithm', 'balance', 'logic-order', 'logic-match', 'work-backwards', 'heads-legs',
  'shape-equations', 'brothers-sisters', 'count-triangles', 'coin-combinations', 'digit-placement', 'custom-operation', 'venn'
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The problem id of a day's Big Puzzle (`topic:grade:3:seed`). */
export function bigPuzzleId(day: string, grade: Grade): string {
  const ids = new Set(topicsForGrade(grade).map((t) => t.id));
  const pool = BIG_FAMILIES.filter((id) => ids.has(id));
  const n = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  const topic = pool[((n % pool.length) + pool.length) % pool.length]; // a different family each day, round and round
  return `${topic}:${grade}:3:${hash(`big:${day}:${grade}`) % 1_000_000_000}`;
}

export interface BigResult {
  /** Solved (in the end, however many tries). */
  solved: boolean;
  /** Seconds of thinking and hints used, for the child's own record. */
  seconds: number;
  hints: number;
  at: number;
}
