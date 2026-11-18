import { describe, expect, it } from 'vitest';
import { ISLANDS, goalStones, islandProgress, islandTopics } from '../src/content/world';
import { topicsForGrade } from '../src/content/topics';
import type { Grade } from '../src/core/types';

describe('world map islands', () => {
  for (const grade of [2, 3] as Grade[])
    it(`Grade ${grade}: every number topics is on exactly one island, Thinking Puzzles on none`, () => {
      const placed = ISLANDS.flatMap((i) => islandTopics(grade, i).map((t) => t.id));
      expect(new Set(placed).size).toBe(placed.length);
      expect([...placed].sort()).toEqual(topicsForGrade(grade).map((t) => t.id).sort());
      for (const i of ISLANDS) expect(islandTopics(grade, i).length, i.name).toBeGreaterThan(0);
    });

  it('counts the stars the child earned, capped at 3 per topic', () => {
    const island = ISLANDS[1];
    const [a, b] = islandTopics(3, island);
    const p = islandProgress({ [a.id]: { stars: 2 }, [b.id]: { stars: 9 } }, 3, island);
    expect(p.stars).toBe(5);
    expect(p.max).toBe(islandTopics(3, island).length * 3);
  });

  it("shows today's goal as stones", () => {
    expect(goalStones(0, 5)).toEqual(['next', 'todo', 'todo', 'todo', 'todo']);
    expect(goalStones(2, 5)).toEqual(['done', 'done', 'next', 'todo', 'todo']);
    expect(goalStones(7, 5)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });
});
