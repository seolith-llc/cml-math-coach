import type { Grade } from '../core/types';
import { dayStreak, dueReviews, load, save } from '../core/storage';
import { h, list, segmented } from '../ui/dom';
import { summary } from '../core/session';
import type { View } from '../app';

export function homeScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const due = dueReviews(state, grade).length;
  const streak = dayStreak(state);

  const segment = segmented<Grade>('Grade', [{ value: 2, label: 'Grade 2' }, { value: 3, label: 'Grade 3' }], grade, (g) => {
    state.settings.grade = g;
    save(state);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  return {
    title: 'Math Coach',
    el: h('div', { class: 'stack' },
      segment,
      h('a', { class: 'btn primary hero', href: '#/practice' }, 'Practice'),
      list([
        { label: 'Test', value: summary(state.settings.test), href: '#/test' },
        { label: 'Review', value: due || undefined, href: '#/review' },
        { label: 'Learn', href: '#/learn' },
        { label: 'Progress', value: streak ? `${streak} day${streak === 1 ? '' : 's'}` : undefined, href: '#/progress' }
      ]))
  };
}
