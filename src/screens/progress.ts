import { dayStreak, load } from '../core/storage';
import { statFor, weakestTopics } from '../core/mastery';
import { topicsForGrade } from '../content/topics';
import { h, list, meter } from '../ui/dom';
import type { View } from '../app';

export function progressScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const topics = topicsForGrade(grade);
  const stats = topics.map((t) => statFor(state, grade, t.id)).filter(Boolean);
  const tried = stats.reduce((n, s) => n + s!.attempts, 0);
  const right = stats.reduce((n, s) => n + s!.correct, 0);
  const meets = state.meets.filter((m) => m.grade === grade).slice(-6).reverse();
  const weak = weakestTopics(state, grade, topics, 5);
  // the best of the listed tests (by share right; the latest wins a tie): highlighted in Neon
  const best = meets.reduce<typeof meets[number] | undefined>((b, m) => (!b || m.score / m.total > b.score / b.total ? m : b), undefined);
  const stars = topics.reduce((n, t) => n + (statFor(state, grade, t.id)?.stars ?? 0), 0);
  const tile = (value: string | number, label: string) => h('div', { class: 'tile' }, h('strong', {}, String(value)), h('span', {}, label));
  return {
    title: 'Progress',
    el: h('div', { class: 'stack' },
      h('div', { class: 'tiles' },
        tile(dayStreak(state), 'Day streak'),
        tile(`${stars}/${topics.length * 3}`, 'Stars'),
        tile(tried ? `${Math.round((right / tried) * 100)}%` : '–', 'First try')),
      weak.length ? list(weak.map((t) => ({ label: t.title, value: meter(statFor(state, grade, t.id)?.mastery), href: `#/learn/${t.id}` })), 'Practice next') : null,
      meets.length ? list(meets.map((m) => ({ label: new Date(m.date).toLocaleDateString(), value: h('span', { class: meets.length > 1 && m === best ? 'best' : '' }, `${m.score} of ${m.total}`) })), 'Tests') : null,
      tried ? null : h('p', { class: 'empty' }, 'No problems yet'))
  };
}
