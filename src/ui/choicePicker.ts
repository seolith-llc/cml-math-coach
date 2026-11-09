import type { AnswerSpec } from '../core/types';
import { h } from './dom';

type Choice = Extract<AnswerSpec, { kind: 'choice' }>;

const letter = (i: number) => String.fromCharCode(97 + i);

/**
 * Tap targets for multiple choice: a letter plus a picture (SVG or emoji) or the option text.
 * `onPick` gets the letter. `mark` shows right/wrong after checking.
 */
export function choicePicker(spec: Choice, onPick: (letter: string) => void) {
  let picked = '';
  const buttons = spec.options.map((o, i) => {
    const pic = spec.pictures?.[i];
    const face = !pic ? h('span', { class: 'choice-text' }, o) : pic.trim().startsWith('<svg') ? h('span', { class: 'choice-pic', html: pic }) : h('span', { class: 'choice-emoji' }, pic);
    return h('button', { class: 'choice', type: 'button', 'aria-label': `${letter(i).toUpperCase()}: ${o}`, onclick: () => {
      picked = letter(i);
      buttons.forEach((b, k) => b.classList.toggle('picked', k === i));
      onPick(picked);
    } }, h('span', { class: 'choice-letter' }, letter(i).toUpperCase()), face);
  });
  const wide = !spec.pictures && spec.options.some((o) => o.length > 12);
  const el = h('div', { class: `choices${wide ? ' wide' : ''}`, role: 'group', 'aria-label': 'Choices' }, ...buttons);
  return {
    el,
    value: () => picked,
    select: (l: string) => {
      picked = l;
      buttons.forEach((b, k) => b.classList.toggle('picked', letter(k) === l));
    },
    mark: (l: string, ok: boolean) => buttons.forEach((b, k) => letter(k) === l && b.classList.add(ok ? 'right' : 'wrong')),
    disable: () => buttons.forEach((b) => (b.disabled = true))
  };
}
