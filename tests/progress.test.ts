import { describe, expect, it } from 'vitest';
import { awardStars, localDay, starText, starsFor, streak, today, weekStart } from '../src/core/progress';

const day = (s: string, h = 12) => new Date(`${s}T${String(h).padStart(2, '0')}:00:00`).getTime(); // local time

describe('stars', () => {
  it('follow the level thresholds and never go down', () => {
    expect(starsFor({ attempts: 1, mastery: 0.9 })).toBe(0);
    expect(starsFor({ attempts: 2, mastery: 0.5 })).toBe(1);
    expect(starsFor({ attempts: 4, mastery: 0.8 })).toBe(2);
    expect(starsFor({ attempts: 8, mastery: 0.95 })).toBe(3);
    const s: { attempts: number; mastery: number; stars?: number } = { attempts: 4, mastery: 0.85 };
    expect(awardStars(s)).toBe(2);
    expect(awardStars(s)).toBeNull(); // no change, no event
    s.mastery = 0.3;
    expect(awardStars(s)).toBeNull();
    expect(s.stars).toBe(2); // kept
    expect(starText(2)).toBe('★★☆');
  });
});

describe('streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(streak(['2026-11-03', '2026-11-04', '2026-11-05'], day('2026-11-05'))).toBe(3);
    expect(streak(['2026-11-03', '2026-11-04'], day('2026-11-05', 8))).toBe(2); // morning: not broken yet
    expect(streak([], day('2026-11-05'))).toBe(0);
  });
  it('forgives one missed day a week, not two', () => {
    expect(streak(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05'], day('2026-11-05'))).toBe(4); // rest on the 3rd
    expect(streak(['2026-11-01', '2026-11-03', '2026-11-05'], day('2026-11-05'))).toBe(2); // two gaps within a week
    expect(streak(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-31', '2026-11-01'], day('2026-11-01'))).toBe(11); // gaps 8 days apart: both forgiven
    expect(streak(['2026-11-01', '2026-11-02', '2026-11-03'], day('2026-11-06'))).toBe(0); // two days off at the end
  });
  it('uses the local calendar day', () => {
    const lateEvening = new Date(2026, 10, 5, 23, 30).getTime();
    expect(localDay(lateEvening)).toBe('2026-11-05');
  });
});

describe('today', () => {
  it('tracks the goal, reviews and the weekly test', () => {
    const now = day('2026-11-05'); // Thursday
    const t = today({ log: [{ ts: now - 3600e3 }, { ts: now - 7200e3 }, { ts: day('2026-11-04') }], goal: 2, reviewDue: 3, meets: [{ date: day('2026-11-02', 10) }], now });
    expect(t).toEqual({ practiced: 2, goal: 2, goalMet: true, reviewDue: 3, testThisWeek: true });
    expect(today({ log: [], goal: 10, reviewDue: 0, meets: [{ date: day('2026-11-01') }], now }).testThisWeek).toBe(false); // last Sunday
    expect(new Date(weekStart(now)).getDay()).toBe(1);
  });
});
