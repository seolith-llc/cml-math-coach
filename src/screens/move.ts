import { NEW_ORIGIN } from '../core/hosts';
import { takeHandoff } from '../sync/move';
import { fill, h } from '../ui/dom';
import type { View } from '../app';

/** #/handoff/<code> on the new address: progress arriving from the old one. */
export function handoffScreen(code = ''): View {
  const root = h('div', { class: 'stack' }, h('h2', { class: 'page-heading' }, 'Moving…'));
  void takeHandoff(code).then((r) => {
    if (r === 'moved') location.replace('./#/');
    else fill(root, h('h2', { class: 'page-heading' }, 'Puzzle Trail'), h('a', { class: 'btn primary hero', href: '#/' }, 'Open'));
  });
  return { title: 'Puzzle Trail', el: root };
}

/** On the old address once a device has moved: only the way to the new one. */
export function movedScreen(): View {
  return {
    title: 'Puzzle Trail',
    el: h('div', { class: 'stack' },
      h('h2', { class: 'page-heading' }, 'Puzzle Trail has moved'),
      h('a', { class: 'btn primary hero', href: `${NEW_ORIGIN}/` }, new URL(NEW_ORIGIN).host))
  };
}
