import type { Grade, Level, Problem, Topic } from '../core/types';
import { Rng, randomSeed } from '../core/rng';
import { speakable } from './generators/helpers';
import * as number from './generators/number';
import * as word from './generators/word';
import * as money from './generators/money';
import * as time from './generators/time';
import * as logic from './generators/logic';
import * as counting from './generators/counting';
import * as puzzles from './generators/puzzles';
import * as placement from './generators/placement';

export const TOPICS: Topic[] = [
  number.missingNumber,
  number.compareResults,
  number.sumDifference,
  number.productSum,
  number.distanceAway,
  number.roundUp,
  number.patterns,
  number.numberRiddle,
  number.digitCount,
  number.temperature,
  word.ages,
  word.transfer,
  word.multiStep,
  word.headsLegs,
  word.unitRate,
  word.workRate,
  word.backwards,
  money.coinCount,
  money.smallestAmount,
  money.coinCombos,
  money.pricePuzzle,
  time.calendar,
  time.elapsedTime,
  time.timeUnits,
  time.lengthUnits,
  time.segments,
  logic.orderingLogic,
  logic.matchingLogic,
  counting.countTriangles,
  counting.countRectangles,
  counting.venn,
  counting.handshakes,
  puzzles.cryptarithm,
  puzzles.customOp,
  puzzles.shapeEquations,
  puzzles.packages,
  puzzles.balance,
  placement.palindromes,
  placement.digitPlacement
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
export const topicsForGrade = (grade: Grade) => TOPICS.filter((t) => t.grades.includes(grade));

/** Problem ids encode everything needed to regenerate the same problem later (review queue). */
export function makeProblem(topic: Topic, grade: Grade, level: Level, seed = randomSeed()): Problem {
  const raw = topic.generate({ grade, level, rng: new Rng(seed) });
  const tidy = (s: string) => s.replace(/M\.\./g, 'M.').replace(/M\. ([a-z])/g, 'M. $1');
  const body = { ...raw, text: tidy(raw.text), hints: raw.hints.map(tidy), steps: raw.steps.map(tidy) };
  return {
    id: `${topic.id}:${grade}:${level}:${seed}`,
    topicId: topic.id,
    grade,
    level,
    ...body,
    speech: body.speech ?? speakable(body.text)
  };
}

export function problemFromId(id: string): Problem | undefined {
  const [topicId, g, l, s] = id.split(':');
  const topic = topicById(topicId);
  if (!topic) return undefined;
  return makeProblem(topic, +g as Grade, +l as Level, +s);
}

/**
 * A mock contest meet: 6 questions in 30 minutes, getting harder, as on real CML papers.
 * Questions come from different categories, and logic or counting puzzles go near the end.
 */
export function makeMeet(grade: Grade, seed = randomSeed()): Problem[] {
  const rng = new Rng(seed);
  const pool = topicsForGrade(grade);
  const levels: Level[] = [1, 2, 2, 2, 3, 3].map((l) => (grade === 2 && l === 3 ? 2 : l)) as Level[];
  const late = rng.shuffle(pool.filter((t) => ['Logic', 'Counting', 'Puzzles'].includes(t.category)));
  const early = rng.shuffle(pool.filter((t) => !['Logic', 'Counting', 'Puzzles'].includes(t.category)));
  const chosen: Topic[] = [];
  const usedCats = new Set<string>();
  const take = (list: Topic[]) => {
    const t = list.find((x) => !chosen.includes(x) && !usedCats.has(x.category)) ?? list.find((x) => !chosen.includes(x))!;
    chosen.push(t);
    usedCats.add(t.category);
  };
  take(early); take(early); take(early); take(late); take(early); take(late);
  return chosen.map((t, i) => makeProblem(t, grade, levels[i], rng.int(1, 2 ** 31)));
}
