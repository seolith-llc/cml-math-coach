/**
 * Motivation model (pure). Designed for children: progress is about mastery, goals are small,
 * streaks forgive a rest day, and nothing is ever taken away.
 *
 * - Stars: each topic earns ★ / ★★ / ★★★ as the learner moves up a level (Warm-up → Contest → Challenge → Mastered).
 *   Stars only go up, even if later answers dip.
 * - Daily goal: a small number of problems; when it's met the app says so and suggests stopping.
 * - Streak: consecutive practice days; one missed day per week is forgiven automatically.
 */

export interface StarStat {
  attempts: number;
  mastery: number;
  stars?: number;
}

/** Thresholds match mastery.levelFor: ★ = moved to Contest level, ★★ = Challenge, ★★★ = mastered. */
export const STAR_RULES = [
  { mastery: 0.5, attempts: 2 },
  { mastery: 0.8, attempts: 4 },
  { mastery: 0.9, attempts: 8 }
] as const;

export const LEVEL_NAMES = ['Warm-up', 'Contest', 'Challenge', 'Mastered'] as const;

export function starsFor(s: StarStat): number {
  let n = 0;
  for (const r of STAR_RULES) if (s.mastery >= r.mastery && s.attempts >= r.attempts) n++;
  return n;
}

/** Updates the stored (never decreasing) stars. Returns the new count if it went up. */
export function awardStars(s: StarStat): number | null {
  const now = Math.max(s.stars ?? 0, starsFor(s));
  const before = s.stars ?? 0;
  s.stars = now;
  return now > before ? now : null;
}

export const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export const GOALS = [5, 10, 15, 20] as const;

/** Local calendar day, YYYY-MM-DD (not UTC: an evening session must count for today). */
export function localDay(t: number | Date = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
};

/**
 * Consecutive practice days ending today (or yesterday, so the streak doesn't look broken in the morning).
 * One missed day in any 7 is a free rest day.
 */
export function streak(activeDays: Iterable<string>, now: number = Date.now()): number {
  const set = new Set(activeDays);
  let day = localDay(now);
  if (!set.has(day)) day = addDays(day, -1);
  let count = 0;
  let lastRest = -Infinity;
  for (let i = 0; i < 400; i++, day = addDays(day, -1)) {
    if (set.has(day)) {
      count++;
      continue;
    }
    // A missed day is forgiven if no rest was used in the last 6 days and the streak continues before it.
    if (count > 0 && i - lastRest > 6 && set.has(addDays(day, -1))) {
      lastRest = i;
      continue;
    }
    break;
  }
  return count;
}

export interface TodayInput {
  log: { ts: number }[];
  goal: number;
  reviewDue: number;
  meets: { date: number }[];
  now?: number;
}

/** Start of this week (Monday 00:00 local). */
export function weekStart(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** The Today list on Home: practice toward the goal, due reviews, and one Test a week. */
export function today(input: TodayInput) {
  const now = input.now ?? Date.now();
  const day = localDay(now);
  const done = input.log.filter((a) => localDay(a.ts) === day).length;
  return {
    practiced: done,
    goal: input.goal,
    goalMet: done >= input.goal,
    reviewDue: input.reviewDue,
    testThisWeek: input.meets.some((m) => m.date >= weekStart(now))
  };
}
