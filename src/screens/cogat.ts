import type { Category } from '../core/types';
import { load } from '../core/storage';
import { statFor } from '../core/mastery';
import { starText } from '../core/progress';
import { topicsForGrade } from '../content/topics';
import { h, list } from '../ui/dom';
import type { View } from '../app';

const BATTERIES: Category[] = ['Verbal', 'Quantitative', 'Nonverbal'];

/** CogAT-style reasoning practice: a mixed round, or one question type (its lesson, then practice). */
export function cogatScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const topics = topicsForGrade(grade, 'cogat');
  return {
    title: 'CogAT',
    el: h('div', { class: 'stack' },
      h('a', { class: 'btn primary hero', href: '#/practice/cogat' }, 'Practice'),
      ...BATTERIES.map((b) => list(topics.filter((t) => t.category === b).map((t) => ({
        label: t.title,
        value: h('span', { class: 'stars' }, starText(statFor(state, grade, t.id)?.stars ?? 0)),
        href: `#/learn/${t.id}`
      })), b)))
  };
}
