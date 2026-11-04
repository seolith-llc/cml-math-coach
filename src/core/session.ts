/**
 * Test sessions: how many questions, when feedback comes, and what the clock does.
 * Two independent choices cover every mode:
 *   feedback  learn = hints, checking and solutions as you go · test = score at the end
 *   clock     off = unlimited · total = minutes for the whole test · each = seconds per question
 */

export type Feedback = 'learn' | 'test';
export type ClockKind = 'off' | 'total' | 'each';

export interface TestConfig {
  count: number;
  feedback: Feedback;
  clock: ClockKind;
  totalMinutes: number;
  eachSeconds: number;
}

export const COUNTS = [6, 10, 15, 20] as const;
export const TOTAL_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;
export const EACH_SECONDS = [30, 60, 90, 120, 180, 300] as const;

/** CML meet: 6 questions, 30 minutes, scored at the end. */
export const DEFAULT_TEST: TestConfig = { count: 6, feedback: 'test', clock: 'total', totalMinutes: 30, eachSeconds: 120 };

const nearest = (list: readonly number[], v: unknown, dflt: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return list.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), list[0]);
};

export function normalizeTest(raw: Partial<TestConfig> | undefined): TestConfig {
  const r = raw ?? {};
  return {
    count: nearest(COUNTS, r.count, DEFAULT_TEST.count),
    feedback: r.feedback === 'learn' ? 'learn' : 'test',
    clock: r.clock === 'off' || r.clock === 'each' ? r.clock : r.clock === 'total' ? 'total' : DEFAULT_TEST.clock,
    totalMinutes: nearest(TOTAL_MINUTES, r.totalMinutes, DEFAULT_TEST.totalMinutes),
    eachSeconds: nearest(EACH_SECONDS, r.eachSeconds, DEFAULT_TEST.eachSeconds)
  };
}

/** "30 min", "2 min", "90 s" */
export function formatDuration(seconds: number): string {
  if (seconds < 60 || seconds % 60) return `${seconds} s`;
  return `${seconds / 60} min`;
}

/** "m:ss" for the clock face. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Short value for the Home row, e.g. "6 · 30 min", "10 · 2 min each", "Learn · 6". */
export function summary(c: TestConfig): string {
  const clock = c.clock === 'off' ? '' : c.clock === 'total' ? ` · ${formatDuration(c.totalMinutes * 60)}` : ` · ${formatDuration(c.eachSeconds)} each`;
  return `${c.feedback === 'learn' ? 'Learn · ' : ''}${c.count}${clock}`;
}

/** Seconds on the clock for one countdown (the whole test, or one question). Null when there is no clock. */
export function clockSeconds(c: TestConfig): number | null {
  return c.clock === 'total' ? c.totalMinutes * 60 : c.clock === 'each' ? c.eachSeconds : null;
}

/** When the clock turns red: the last minute, or the last 20% for short clocks. */
export function warnAt(total: number): number {
  return Math.min(60, Math.ceil(total * 0.2));
}

/** Wall-clock countdown, so switching apps or tabs can't pause it. Pure: pass `now` in. */
export class Countdown {
  private end: number;
  constructor(public readonly seconds: number, now: number) {
    this.end = now + seconds * 1000;
  }
  left(now: number): number {
    return Math.max(0, (this.end - now) / 1000);
  }
  expired(now: number): boolean {
    return now >= this.end;
  }
}
