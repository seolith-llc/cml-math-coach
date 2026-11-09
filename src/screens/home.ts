import type { Grade } from '../core/types';
import { dayStreak, dueReviews, load, save } from '../core/storage';
import { today } from '../core/progress';
import { summary } from '../core/session';
import { topicsForGrade } from '../content/topics';
import { h, list, segmented } from '../ui/dom';
import type { View } from '../app';

export function homeScreen(): View {
  const state = load();
  const s = state.settings;
  const grade = s.grade;
  const t = today({ log: state.log, goal: s.goal, reviewDue: dueReviews(state, grade).length, meets: state.meets.filter((m) => m.grade === grade) });
  const streak = dayStreak(state);
  const stats = state.stats[String(grade)] ?? {};
  const stars = topicsForGrade(grade).reduce((n, tp) => n + (stats[tp.id]?.stars ?? 0), 0);
  const cogatStars = topicsForGrade(grade, 'cogat').reduce((n, tp) => n + (stats[tp.id]?.stars ?? 0), 0);

  const segment = segmented<Grade>('Grade', [{ value: 2, label: 'Grade 2' }, { value: 3, label: 'Grade 3' }], grade, (g) => {
    s.grade = g;
    save(state);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  // Today: progress toward the daily goal. When it's met, say so and make "more" optional.
  const pct = Math.min(100, Math.round((t.practiced / t.goal) * 100));
  const todayCard = h('section', { class: `card today${t.goalMet ? ' met' : ''}` },
    h('div', { class: 'today-row' },
      h('span', { class: 'today-count' }, t.goalMet ? 'Done for today' : `${t.practiced} of ${t.goal}`),
      streak ? h('span', { class: 'today-streak', 'aria-label': `${streak} day streak` }, `🔥 ${streak}`) : null),
    h('div', { class: 'bar-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': t.goal, 'aria-valuenow': t.practiced }, h('span', { style: `width:${pct}%` })),
    h('a', { class: `btn ${t.goalMet ? '' : 'primary'} hero`, href: '#/practice' }, t.goalMet ? 'Keep going' : 'Practice'));

  return {
    title: 'Math Coach',
    el: h('div', { class: 'stack' },
      segment,
      todayCard,
      list([
        t.reviewDue ? { label: 'Review', value: t.reviewDue, href: '#/review' } : null,
        { label: 'Test', value: t.testThisWeek ? '✓' : summary(s.test), href: '#/test' },
        { label: 'Learn', value: stars ? `${stars} ★` : undefined, href: '#/learn' },
        { label: 'CogAT', value: cogatStars ? `${cogatStars} ★` : undefined, href: '#/cogat' },
        { label: 'Progress', href: '#/progress' }
      ]))
  };
}
