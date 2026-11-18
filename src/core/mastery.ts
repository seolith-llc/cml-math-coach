import type { Grade, Level, Topic } from './types';
import type { AppState } from './storage';
import { Rng, randomSeed } from './rng';

export function statFor(state: AppState, grade: Grade, topicId: string) {
  return state.stats[String(grade)]?.[topicId];
}

/**
 * Desirable difficulty (docs/REDESIGN.md §4, step083): move up early, so a child gets about 70% right on the first try,
 * not 90%. Mastery is the weighted first-try rate (storage.record). Stars use the same thresholds (progress.STAR_RULES).
 */
export const LEVEL_UP = { two: { mastery: 0.45, attempts: 2 }, three: { mastery: 0.7, attempts: 4 } };

/** Pick a level that keeps the learner in the "just hard enough" zone. */
export function levelFor(state: AppState, grade: Grade, topicId: string): Level {
  const s = statFor(state, grade, topicId);
  if (!s || s.attempts < 2) return 1;
  if (s.mastery >= LEVEL_UP.three.mastery && s.attempts >= LEVEL_UP.three.attempts) return 3;
  if (s.mastery >= LEVEL_UP.two.mastery) return 2;
  return 1;
}

/**
 * Smart mix: weaker and less-practised topics come up more often,
 * but strong topics still appear sometimes so they stay fresh.
 */
export function pickTopic(state: AppState, grade: Grade, topics: Topic[], avoid?: string, seed = randomSeed()): Topic {
  const rng = new Rng(seed);
  const now = Date.now();
  const weights = topics.map((t) => {
    if (t.id === avoid && topics.length > 1) return 0;
    const s = statFor(state, grade, t.id);
    if (!s) return 1.6; // not tried yet
    const staleDays = (now - s.lastSeen) / 86_400_000;
    return 0.25 + (1 - s.mastery) * 1.5 + Math.min(staleDays, 7) * 0.08;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < topics.length; i++) {
    r -= weights[i];
    if (r <= 0) return topics[i];
  }
  return topics[topics.length - 1];
}

export function weakestTopics(state: AppState, grade: Grade, topics: Topic[], n = 3): Topic[] {
  return topics
    .map((t) => ({ t, s: statFor(state, grade, t.id) }))
    .filter((x) => x.s && x.s.attempts >= 2)
    .sort((a, b) => a.s!.mastery - b.s!.mastery)
    .slice(0, n)
    .map((x) => x.t);
}
