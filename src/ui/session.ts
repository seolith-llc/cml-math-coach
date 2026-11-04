import { load } from '../core/storage';
import { speak } from '../voice/speech';
import { h } from './dom';

/** Row of dots: one per problem in the round, filled green/red as answered. */
export function progressDots(total: number) {
  const el = h('div', { class: 'dots', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total });
  const update = (results: boolean[]) => {
    el.replaceChildren(...Array.from({ length: total }, (_, i) => h('span', { class: i < results.length ? (results[i] ? 'ok' : 'miss') : '' })));
    el.setAttribute('aria-valuenow', String(results.length));
  };
  update([]);
  return { el, update };
}

/** End-of-round card: one big number, then actions. */
export function done(score: string, actions: (Node | null)[]): HTMLElement {
  if (load().settings.speak) void speak(`${score}.`);
  return h('div', { class: 'card done' }, h('p', { class: 'score' }, score), h('div', { class: 'actions' }, ...actions));
}
