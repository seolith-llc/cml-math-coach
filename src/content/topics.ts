import type { Grade, Level, Problem, Topic, Track } from '../core/types';
import { Rng, randomSeed } from '../core/rng';
import * as number from './generators/number';
import * as word from './generators/word';
import * as money from './generators/money';
import * as time from './generators/time';
import * as logic from './generators/logic';
import * as counting from './generators/counting';
import * as puzzles from './generators/puzzles';
import * as placement from './generators/placement';
import * as family from './generators/family';
import * as verbal from './cogat/verbal';
import * as quant from './cogat/quantitative';
import * as nonverbal from './cogat/nonverbal';

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
  family.familyPuzzle,
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
  placement.digitPlacement,
  // CogAT-style reasoning (track: 'cogat'), in battery order
  verbal.verbalAnalogies,
  verbal.sentenceCompletion,
  verbal.classification,
  quant.numberAnalogies,
  quant.numberPuzzles,
  quant.numberSeries,
  nonverbal.figureMatrices,
  nonverbal.paperFolding,
  nonverbal.figureClassification
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
/** Topics of one track for a grade. CML is the default everywhere (practice mix, tests, progress, stars). */
export const topicsForGrade = (grade: Grade, track: Track = 'cml') => TOPICS.filter((t) => t.grades.includes(grade) && (t.track ?? 'cml') === track);

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
    ...body
  };
}

export function problemFromId(id: string): Problem | undefined {
  const [topicId, g, l, s] = id.split(':');
  const topic = topicById(topicId);
  if (!topic) return undefined;
  return makeProblem(topic, +g as Grade, +l as Level, +s);
}

/**
 * A test of `count` questions (6 = a CML meet). Difficulty ramps up: the first sixth is warm-up, the last third is
 * challenge (Grade 2 caps at contest level). Topics never repeat, and categories rotate so neighbours differ.
 * Logic, counting and puzzle topics lean towards the end, as on real papers.
 */
export function makeMeet(grade: Grade, seed = randomSeed(), count = 6): Problem[] {
  const rng = new Rng(seed);
  const pool = topicsForGrade(grade);
  const n = Math.min(count, pool.length);
  const levelAt = (i: number): Level => {
    const l: Level = i < Math.max(1, Math.round(n / 6)) ? 1 : i >= n - Math.max(2, Math.round(n / 3)) ? 3 : 2;
    return grade === 2 && l === 3 ? 2 : l;
  };
  const isLate = (t: Topic) => ['Logic', 'Counting', 'Puzzles'].includes(t.category);
  const late = rng.shuffle(pool.filter(isLate));
  const early = rng.shuffle(pool.filter((t) => !isLate(t)));
  const chosen: Topic[] = [];
  const take = (preferLate: boolean) => {
    const [first, second] = preferLate ? [late, early] : [early, late];
    const prev = chosen[chosen.length - 1]?.category;
    const fresh = (l: Topic[]) => l.find((t) => !chosen.includes(t) && t.category !== prev) ?? l.find((t) => !chosen.includes(t));
    chosen.push((fresh(first) ?? fresh(second))!);
  };
  // About 1 in 3 questions is a logic/counting/puzzle one, mostly in the second half.
  for (let i = 0; i < n; i++) take(i >= n / 2 ? i % 2 === 1 : i % 3 === 2);
  return chosen.map((t, i) => makeProblem(t, grade, levelAt(i), rng.int(1, 2 ** 31)));
}
