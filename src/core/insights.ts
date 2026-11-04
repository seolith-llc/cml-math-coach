import type { Category, Grade } from './types';
import { topicById, topicsForGrade } from '../content/topics';

/** Data the parent dashboard receives from /api/parent. */
export interface DashboardData {
  child: { name: string; grade: Grade };
  lastSync: number | null;
  snapshot: {
    grade?: Grade;
    stats?: Record<string, Record<string, { attempts: number; correct: number; mastery: number; lastSeen: number }>>;
    meets?: { date: number; grade: Grade; score: number; total: number; seconds: number }[];
    activeDays?: string[];
    reviewDue?: number;
    reviewQueue?: number;
  } | null;
  attempts: {
    ts: number; problemId: string; topicId: string; grade: number; level: number; correct: boolean; firstTry: boolean;
    skipped: boolean; hints: number; seconds: number; answer?: string; mode: string;
  }[];
}

export interface PeriodStats {
  problems: number;
  firstTry: number;
  pct: number | null;
  minutes: number;
  days: number;
}

export interface TopicRow {
  topicId: string;
  title: string;
  category: Category;
  attempts: number;
  firstTryPct: number | null;
  mastery: number | null;
  lastTs: number | null;
  status: 'new' | 'needs-help' | 'building' | 'strong';
}

const DAY = 86_400_000;
export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

function period(atts: DashboardData['attempts'], from: number, to: number): PeriodStats {
  const inP = atts.filter((a) => a.ts >= from && a.ts < to);
  const ft = inP.filter((a) => a.firstTry).length;
  return {
    problems: inP.length,
    firstTry: ft,
    pct: inP.length ? Math.round((ft / inP.length) * 100) : null,
    minutes: Math.round(inP.reduce((s, a) => s + (a.seconds || 0), 0) / 60),
    days: new Set(inP.map((a) => dayKey(a.ts))).size
  };
}

export function streak(days: string[], now: number): number {
  const set = new Set(days);
  let n = 0;
  let t = now;
  if (!set.has(dayKey(t))) t -= DAY;
  while (set.has(dayKey(t))) {
    n++;
    t -= DAY;
  }
  return n;
}

export function summarize(data: DashboardData, now = Date.now()) {
  const grade = (data.child.grade ?? data.snapshot?.grade ?? 2) as Grade;
  const atts = data.attempts.filter((a) => a.grade === grade);
  const startToday = new Date(dayKey(now)).getTime();
  const week = period(atts, startToday - 6 * DAY, now + 1);
  const prevWeek = period(atts, startToday - 13 * DAY, startToday - 6 * DAY);

  const daily = Array.from({ length: 30 }, (_, i) => {
    const start = startToday - (29 - i) * DAY;
    const p = atts.filter((a) => a.ts >= start && a.ts < start + DAY);
    const ft = p.filter((a) => a.firstTry).length;
    return { date: dayKey(start), firstTry: ft, other: p.length - ft, minutes: Math.round(p.reduce((s, a) => s + (a.seconds || 0), 0) / 60) };
  });

  const stats = data.snapshot?.stats?.[String(grade)] ?? {};
  const topics: TopicRow[] = topicsForGrade(grade).map((t) => {
    const mine = atts.filter((a) => a.topicId === t.id);
    const s = stats[t.id];
    const tries = Math.max(mine.length, s?.attempts ?? 0);
    const ft = mine.filter((a) => a.firstTry).length;
    const mastery = s ? s.mastery : null;
    const status: TopicRow['status'] =
      !tries ? 'new' : (mastery ?? 0) >= 0.8 && tries >= 4 ? 'strong' : (mastery ?? 1) < 0.5 && tries >= 3 ? 'needs-help' : 'building';
    return {
      topicId: t.id, title: t.title, category: t.category, attempts: tries,
      firstTryPct: mine.length ? Math.round((ft / mine.length) * 100) : null,
      mastery, lastTs: mine.length ? Math.max(...mine.map((a) => a.ts)) : s?.lastSeen || null, status
    };
  });

  const needsHelp = topics.filter((t) => t.status === 'needs-help').sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));
  const strong = topics.filter((t) => t.status === 'strong').sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0));
  const untried = topics.filter((t) => t.status === 'new');

  const mistakes = atts.filter((a) => !a.firstTry).sort((a, b) => b.ts - a.ts).slice(0, 12);
  const meets = (data.snapshot?.meets ?? []).filter((m) => m.grade === grade).sort((a, b) => a.date - b.date);
  const all = period(atts, 0, now + 1);
  const hinted = atts.filter((a) => a.hints > 0).length;

  // Plain-language suggestions for the parent.
  const tips: string[] = [];
  if (!week.problems) tips.push('No practice in the last 7 days. A short 10-minute session today restarts the habit.');
  else if (week.days < 3) tips.push(`Practiced on ${week.days} day${week.days === 1 ? '' : 's'} this week. Little and often (4–5 days a week) works better than one long session.`);
  if (needsHelp[0]) tips.push(`Sit together for "${needsHelp[0].title}": open its Learn page, do the worked example out loud, then 3 practice problems.`);
  if (week.pct !== null && prevWeek.pct !== null && week.pct - prevWeek.pct >= 10) tips.push(`First-try accuracy is up ${week.pct - prevWeek.pct} points on last week. Worth celebrating!`);
  if (!meets.length && all.problems >= 30) tips.push('Ready for a first Test: 6 questions in 30 minutes, like contest day.');
  if ((data.snapshot?.reviewDue ?? 0) >= 5) tips.push(`${data.snapshot!.reviewDue} missed problems are waiting in Review. Fixing old mistakes is the fastest win.`);
  if (untried.length && all.problems >= 20) tips.push(`${untried.length} topics are untried yet, for example "${untried[0].title}".`);
  if (all.problems && hinted / all.problems > 0.4) tips.push('Hints are used often. Encourage trying the problem for a minute before asking for a hint.');

  return {
    grade, week, prevWeek, all, daily, topics, needsHelp, strong, untried, mistakes, meets, tips,
    streak: streak(data.snapshot?.activeDays ?? [...new Set(atts.map((a) => dayKey(a.ts)))], now),
    lastPracticed: atts.length ? Math.max(...atts.map((a) => a.ts)) : null,
    reviewDue: data.snapshot?.reviewDue ?? 0
  };
}

export const topicTitle = (id: string) => topicById(id)?.title ?? id;
