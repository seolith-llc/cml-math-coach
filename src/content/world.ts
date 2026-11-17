/**
 * Game look world map (docs/GAME-MODE.md, phase 2): the CML topics grouped into four islands,
 * lit by the stars the child has really earned. Pure data and helpers, no DOM.
 */
import type { Category, Grade, Topic } from '../core/types';
import { topicsForGrade } from './topics';

export interface Island {
  id: string;
  name: string;
  categories: Category[];
}

export const ISLANDS: Island[] = [
  { id: 'meadow', name: 'Numbers Meadow', categories: ['Number sense', 'Word problems'] },
  { id: 'cove', name: 'Coin Cove', categories: ['Money'] },
  { id: 'tower', name: 'Clock Tower', categories: ['Time & calendar', 'Measurement'] },
  { id: 'peaks', name: 'Puzzle Peaks', categories: ['Logic', 'Counting', 'Puzzles'] }
];

export const islandById = (id: string) => ISLANDS.find((i) => i.id === id);

export function islandTopics(grade: Grade, island: Island): Topic[] {
  return topicsForGrade(grade).filter((t) => island.categories.includes(t.category));
}

/** Stars per topic (0–3, never down) for one island, and the island's total. */
export function islandProgress(stats: Record<string, { stars?: number } | undefined>, grade: Grade, island: Island) {
  const topics = islandTopics(grade, island).map((topic) => ({ topic, stars: Math.max(0, Math.min(3, stats[topic.id]?.stars ?? 0)) }));
  return { topics, stars: topics.reduce((n, t) => n + t.stars, 0), max: topics.length * 3 };
}

/** Today's goal as stepping stones: crossed, the one to step on next, and still to come. */
export function goalStones(practiced: number, goal: number): ('done' | 'next' | 'todo')[] {
  return Array.from({ length: goal }, (_, i) => (i < practiced ? 'done' : i === practiced ? 'next' : 'todo'));
}
