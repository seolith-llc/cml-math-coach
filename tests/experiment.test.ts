import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shared with scripts/status.mjs
import { compareLooks, formatComparison } from '../scripts/lib/experiment.mjs';

const NOW = Date.UTC(2026, 10, 30, 12);
const DAY = 86_400_000;
const r = (daysAgo: number, look: string, music: string, right: number, total = 10, fixed = 0) => ({ at: NOW - daysAgo * DAY, look, music, right, total, fixed, kind: 'cml', grade: 3 });

describe('Game vs Classic comparison (tester round)', () => {
  it('compares the looks and music on/off over the last 28 days', () => {
    const log = [
      r(20, 'classic', 'off', 6), r(19, 'classic', 'off', 7), r(18, 'classic', 'off', 5), r(17, 'classic', 'off', 6), r(16, 'classic', 'off', 6),
      r(9, 'game', 'breeze', 7, 10, 2), r(9, 'game', 'breeze', 8), r(8, 'game', 'bubbles', 6), r(7, 'game', 'off', 7), r(6, 'game', 'off', 9), r(5, 'game', 'stars', 8),
      r(40, 'game', 'breeze', 10) // too old
    ];
    const c = compareLooks(log, NOW);
    expect(c.classic).toMatchObject({ rounds: 5, days: 5, firstTryPct: 60 });
    expect(c.game).toMatchObject({ rounds: 6, days: 5, roundsPerDay: 1.2, firstTryPct: 75, fixed: 2 });
    expect(c.musicOn).toMatchObject({ rounds: 4, firstTryPct: 73 });
    expect(c.musicOff).toMatchObject({ rounds: 2, firstTryPct: 80 });
    expect(c.enoughLooks).toBe(true);
    expect(c.enoughMusic).toBe(false); // only 2 rounds without music
    expect(formatComparison('Family 1', c)).toContain('Game:    6 rounds on 5 days (1.2/day), 75% first try, 2 fixed');
  });

  it('ignores junk and says when there is nothing yet', () => {
    const c = compareLooks([null, { at: 'x' }, r(1, 'game', 'off', 12, 10)], NOW);
    expect(c.game.rounds).toBe(0);
    expect(formatComparison('Family 2', compareLooks(undefined, NOW))).toContain('Classic: no rounds');
  });
});
