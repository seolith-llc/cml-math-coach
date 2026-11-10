import { load, type ProgressEvent } from '../core/storage';
import { LEVEL_NAMES, starText } from '../core/progress';
import { topicById } from '../content/topics';
import { speak } from '../voice/speech';
import { h, iconButton, toast } from './dom';

/**
 * Row of dots, one per problem: green right, red missed, grey done-but-not-checked-yet (Test mode).
 * With `onOpen`, answered dots are buttons and a ‹ button opens the previous question.
 */
export function progressDots(total: number, onOpen?: (index: number) => void) {
  const row = h('div', { class: 'dots', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total });
  const prev = onOpen ? iconButton('prev', 'Previous question', () => count && onOpen(count - 1), 'dots-prev') : null;
  const el = prev ? h('div', { class: 'dots-bar' }, prev, row) : row;
  let count = 0;
  const update = (results: (boolean | null)[]) => {
    count = results.length;
    if (prev) prev.disabled = !count;
    row.replaceChildren(...Array.from({ length: total }, (_, i) => {
      const cls = i < results.length ? (results[i] === null ? 'done' : results[i] ? 'ok' : 'miss') : '';
      return onOpen && i < results.length
        ? h('button', { class: cls, type: 'button', 'aria-label': `Question ${i + 1}`, onclick: () => onOpen(i) })
        : h('span', { class: cls });
    }));
    row.setAttribute('aria-valuenow', String(results.length));
  };
  update([]);
  return { el, update };
}

/** End-of-round card: one big number, then actions. */
export function done(score: string, actions: (Node | null)[]): HTMLElement {
  if (load().settings.speak) void speak(`${score}.`);
  return h('div', { class: 'card done' }, h('p', { class: 'score' }, score), h('div', { class: 'actions' }, ...actions));
}

/** Celebrate a level-up or the daily goal: a toast, and a spoken line if Read aloud is on. */
export function celebrate(ev: ProgressEvent): void {
  const lines: string[] = [];
  if (ev.stars) {
    const title = topicById(ev.stars.topicId)?.title ?? '';
    toast(`${starText(ev.stars.stars)}  ${title}`);
    lines.push(`Level up! ${title}: ${LEVEL_NAMES[ev.stars.stars]}.`);
  }
  if (ev.goalReached) {
    toast('Goal reached');
    lines.push("You reached today's goal!");
  }
  if (lines.length && load().settings.speak) setTimeout(() => void speak(lines.join(' ')), 900);
}
