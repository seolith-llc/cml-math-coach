import type { Category } from '../core/types';
import { load } from '../core/storage';
import { statFor } from '../core/mastery';
import { starText } from '../core/progress';
import { topicsForGrade } from '../content/topics';
import { h, list } from '../ui/dom';
import { savedScore } from './round';
import { gradeSwitch } from '../ui/session';
import type { View } from '../app';

const BATTERIES: Category[] = ['Verbal', 'Quantitative', 'Nonverbal'];

/** CogAT-style reasoning practice: a mixed round, or one question type (its lesson, then practice). */
export function cogatScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const topics = topicsForGrade(grade, 'cogat');
  const last = savedScore('cogat');
  return {
    title: 'CogAT',
    el: h('div', { class: 'stack' },
      gradeSwitch(),
      h('a', { class: 'btn primary hero', href: '#/practice/cogat' }, 'Practice'),
      last ? list([{ label: 'Last round', value: last.score, href: last.href }]) : null,
      ...BATTERIES.map((b) => list(topics.filter((t) => t.category === b).map((t) => ({
        label: t.title,
        value: h('span', { class: 'stars' }, starText(statFor(state, grade, t.id)?.stars ?? 0)),
        href: `#/learn/${t.id}`
      })), b)))
  };
}
