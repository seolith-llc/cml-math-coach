/**
 * "How did you know?" (docs/REDESIGN.md §4, step084). Now and then, after a right first try in Practice or Review,
 * the child picks which of three lines of thinking solved this puzzle: its own first step, or the first step of two
 * puzzles from other families. Naming the reasoning, not just the answer, is the point; the right pick earns a
 * Thinker sticker at the round's end (game look, within the daily cap). Pure.
 */
import type { Problem } from './types';
import type { Rng } from './rng';
import { makeProblem, topicById, topicsForGrade } from '../content/topics';

/** About one right first try in three is followed by the question. */
export const ASK_CHANCE = 0.34;

const plain = (s: string) => s.replace(/\*\*/g, '').trim();

export interface ReasonQuestion {
  options: string[];
  right: number;
}

/** A reason worth reading: it has at least one real word, not only numbers and symbols. */
const sentence = (s: string) => /[a-z]{3,}/i.test(s);

/**
 * Three reasons: this puzzle's first step; the same family's first step for other numbers (does it fit THIS puzzle?);
 * and one from another family. All different, each with words in it. Null if not possible.
 */
export function reasonQuestion(problem: Problem, others: Problem[], rng: Rng): ReasonQuestion | null {
  const mine = plain(problem.steps[0] ?? '');
  if (!mine) return null;
  const firsts = (list: Problem[]) => list.map((p) => plain(p.steps[0] ?? '')).filter((s, i, all) => s && s !== mine && sentence(s) && all.indexOf(s) === i);
  const same = firsts(others.filter((p) => p.topicId === problem.topicId));
  const other = firsts(others.filter((p) => p.topicId !== problem.topicId));
  const picks: string[] = [];
  if (same.length) picks.push(same[rng.int(0, same.length - 1)]);
  const rest = [...other, ...same].filter((s) => !picks.includes(s));
  while (picks.length < 2 && rest.length) picks.push(rest.splice(rng.int(0, rest.length - 1), 1)[0]);
  if (picks.length < 2) return null;
  const options = [mine, ...picks];
  for (let i = options.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, right: options.indexOf(mine) };
}

/** Puzzles to borrow wrong reasons from: the same family with other numbers, and other families of the same grade and track. */
export function reasonPool(problem: Problem, rng: Rng, n = 6): Problem[] {
  const topic = topicById(problem.topicId);
  const track = topic?.track ?? 'number';
  const topics = topicsForGrade(problem.grade, track).filter((t) => t.id !== problem.topicId);
  const out: Problem[] = [];
  if (topic) for (let i = 0; i < 3; i++) out.push(makeProblem(topic, problem.grade, problem.level, rng.int(1, 1e9)));
  for (let i = 0; i < n && topics.length; i++) out.push(makeProblem(topics[rng.int(0, topics.length - 1)], problem.grade, 1, rng.int(1, 1e9)));
  return out;
}
