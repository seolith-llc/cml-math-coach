import { describe, expect, it } from 'vitest';
import { DAILY_MAX, DESIGNS, DESIGN_ORDER, STICKER_LABELS, nextDesign, roundStickers, stickerSvg } from '../src/content/stickers';
import { awardStickers, defaultState, stickersToday } from '../src/core/storage';
import { recentStickers } from '../src/core/insights';

const facts = (o: Partial<Parameters<typeof roundStickers>[0]> = {}) => ({ right: 5, fixed: 0, total: 10, starsGained: 0, goalReached: false, todayCount: 0, ...o });

describe('stickers (game look, phase 4)', () => {
  it('are earned for effort-like things at the end of a round, fixing a miss first', () => {
    expect(roundStickers(facts())).toEqual([]); // an ordinary round: no payout per answer
    expect(roundStickers(facts({ fixed: 1 }))).toEqual(['fixer']);
    expect(roundStickers(facts({ right: 8 }))).toEqual(['careful']);
    expect(roundStickers(facts({ fixed: 2, starsGained: 1, goalReached: true, right: 8 }))).toEqual(['fixer', 'star', 'goal']);
    expect(roundStickers(facts({ right: 4, total: 4 }))).toEqual([]); // too short a round for "careful"
  });

  it('at most 3 a day', () => {
    expect(roundStickers(facts({ fixed: 1, starsGained: 1, goalReached: true, todayCount: 2 }))).toEqual(['fixer']);
    expect(roundStickers(facts({ fixed: 1, todayCount: DAILY_MAX }))).toEqual([]);
  });

  it('labels name what the child did, never ability', () => {
    for (const l of Object.values(STICKER_LABELS)) expect(l).not.toMatch(/smart|genius|clever|best|perfect/i);
  });

  it('24 distinct designs in a surprise order; new ones first, then they come round again', () => {
    expect(new Set(DESIGN_ORDER).size).toBe(DESIGNS);
    const svgs = Array.from({ length: DESIGNS }, (_, d) => stickerSvg(d));
    expect(new Set(svgs).size).toBe(DESIGNS);
    for (const s of svgs) expect(s).toMatch(/^<svg[^>]*viewBox="0 0 100 100"[\s\S]*<\/svg>$/);
    const got: number[] = [];
    for (let i = 0; i < DESIGNS; i++) got.push(nextDesign(got));
    expect(new Set(got).size).toBe(DESIGNS);
    expect(DESIGN_ORDER).toContain(nextDesign(got));
  });

  it('are saved with why and when, counted per day, and reach the dashboard', () => {
    const state = defaultState();
    const day = Date.UTC(2026, 10, 17, 15);
    const a = awardStickers(state, ['fixer', 'careful'], 2, day);
    expect(a.map((x) => x.kind)).toEqual(['fixer', 'careful']);
    expect(a[0].design).not.toBe(a[1].design);
    expect(stickersToday(state, day + 1000)).toBe(2);
    expect(stickersToday(state, day + 86_400_000 * 2)).toBe(0);
    const shown = recentStickers({ child: { name: '', grade: 2 }, lastSync: null, attempts: [], snapshot: { stickers: [...state.stickers!, { design: 99, kind: 'x', at: 1, grade: 2 } as never] } });
    expect(shown.map((s) => s.why)).toEqual(['Fixed a miss', 'Careful round']);
  });
});
