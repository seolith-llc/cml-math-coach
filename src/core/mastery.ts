import type { Grade, Level, Topic } from './types';
import type { AppState } from './storage';
import { Rng, randomSeed } from './rng';

export function statFor(state: AppState, grade: Grade, topicId: string) {
  return state.stats[String(grade)]?.[topicId];
}

/** Pick a level that keeps the learner in the "just hard enough" zone. */
export function levelFor(state: AppState, grade: Grade, topicId: string): Level {
  const s = statFor(state, grade, topicId);
  if (!s || s.attempts < 2) return 1;
  if (s.mastery >= 0.8 && s.attempts >= 4) return 3;
  if (s.mastery >= 0.5) return 2;
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
