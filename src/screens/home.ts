import type { Grade } from '../core/types';
import { dayStreak, dueReviews, load, save } from '../core/storage';
import { h, list } from '../ui/dom';
import type { View } from '../app';

export function homeScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const due = dueReviews(state, grade).length;
  const streak = dayStreak(state);

  const segment = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Grade' },
    ...([2, 3] as Grade[]).map((g) =>
      h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(g === grade), class: g === grade ? 'on' : '',
        onclick: () => {
          state.settings.grade = g;
          save(state);
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      }, `Grade ${g}`)));

  return {
    title: 'Math Coach',
    el: h('div', { class: 'stack' },
      segment,
      h('a', { class: 'btn primary hero', href: '#/practice' }, 'Practice'),
      list([
        { label: 'Mock meet', value: '30 min', href: '#/meet' },
        { label: 'Review', value: due || undefined, href: '#/review' },
        { label: 'Learn', href: '#/learn' },
        { label: 'Progress', value: streak ? `${streak} day${streak === 1 ? '' : 's'}` : undefined, href: '#/progress' }
      ]))
  };
}
