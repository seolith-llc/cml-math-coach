import { describe, expect, it } from 'vitest';
import { streak, summarize, type DashboardData } from '../src/core/insights';

const NOW = Date.UTC(2026, 10, 15, 18, 0); // Sun 15 Nov 2026, evening
const DAY = 86_400_000;
const a = (daysAgo: number, topicId: string, firstTry: boolean, extra: Partial<DashboardData['attempts'][number]> = {}) => ({
  ts: NOW - daysAgo * DAY - 3_600_000, problemId: `${topicId}:2:1:${daysAgo}${topicId.length}`, topicId, grade: 2, level: 1,
  correct: true, firstTry, skipped: false, hints: firstTry ? 0 : 1, seconds: 60, mode: 'practice', ...extra
});

const data: DashboardData = {
  child: { name: 'Sam', grade: 2 },
  lastSync: NOW - 60_000,
  snapshot: {
    stats: { '2': { calendar: { attempts: 6, correct: 1, mastery: 0.3, lastSeen: NOW }, coins: { attempts: 8, correct: 8, mastery: 0.92, lastSeen: NOW } } },
    meets: [{ date: NOW - 3 * DAY, grade: 2, score: 4, total: 6, seconds: 1500 }, { date: NOW - 10 * DAY, grade: 3, score: 1, total: 6, seconds: 900 }],
    activeDays: ['2026-11-13', '2026-11-14', '2026-11-15'],
    reviewDue: 6
  },
  attempts: [
    // this week: 6 problems on 3 days, 4 first try
    a(0, 'coins', true), a(0, 'coins', true), a(1, 'calendar', false, { answer: 'Tuesday' }), a(1, 'coins', true), a(2, 'calendar', false, { skipped: true, correct: false }), a(2, 'coins', true),
    // last week: 4 problems, 1 first try
    a(8, 'calendar', false), a(8, 'calendar', false), a(9, 'calendar', true), a(9, 'calendar', false),
    // another grade must be ignored
    { ...a(0, 'handshakes', true), grade: 3 }
  ]
};

describe('parent dashboard insights', () => {
  const s = summarize(data, NOW);
  it('computes this week vs last week', () => {
    expect(s.week).toEqual({ problems: 6, firstTry: 4, pct: 67, minutes: 6, days: 3 });
    expect(s.prevWeek).toMatchObject({ problems: 4, firstTry: 1, pct: 25 });
  });
  it('builds a 30-day daily series ending today', () => {
    expect(s.daily).toHaveLength(30);
    expect(s.daily[29]).toMatchObject({ date: '2026-11-15', firstTry: 2, other: 0 });
    expect(s.daily[28]).toMatchObject({ firstTry: 1, other: 1 });
  });
  it('classifies topics and lists mistakes newest first', () => {
    expect(s.needsHelp.map((t) => t.topicId)).toEqual(['calendar']);
    expect(s.strong.map((t) => t.topicId)).toEqual(['coins']);
    expect(s.mistakes[0]).toMatchObject({ topicId: 'calendar', answer: 'Tuesday' });
    expect(s.mistakes.every((m) => !m.firstTry)).toBe(true);
  });
  it('only shows meets for the current grade, and gives useful tips', () => {
    expect(s.meets).toHaveLength(1);
    expect(s.tips.join(' ')).toMatch(/Calendar days/);
    expect(s.tips.join(' ')).toMatch(/up 42 points/);
    expect(s.tips.join(' ')).toMatch(/6 missed problems/);
    expect(s.streak).toBe(3);
  });
  it('streak tolerates not having practiced yet today', () => {
    expect(streak(['2026-11-13', '2026-11-14'], NOW)).toBe(2);
    expect(streak(['2026-11-12'], NOW)).toBe(0);
  });
  it('handles an empty account', () => {
    const e = summarize({ child: { name: '', grade: 3 }, lastSync: null, snapshot: null, attempts: [] }, NOW);
    expect(e.week.problems).toBe(0);
    expect(e.tips[0]).toMatch(/No practice/);
    expect(e.topics.every((t) => t.status === 'new')).toBe(true);
  });
});
