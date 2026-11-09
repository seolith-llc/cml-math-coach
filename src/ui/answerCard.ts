import type { Problem } from '../core/types';
import { answerPlaceholder, parseChoice, parseDigits } from '../core/answer';
import { speak, stopSpeaking } from '../voice/speech';
import { listen, sttSupported } from '../voice/recognition';
import { h, iconButton, rich, svg } from './dom';
import { placementBoard } from './placementBoard';
import { choicePicker } from './choicePicker';

/** A question with an answer field and no feedback (Test mode). `answers()` returns what to check later. */
export function answerCard(p: Problem, n: number, onEnter?: () => void) {
  let answers: string[] = [];
  const board = p.answer.kind === 'placement' && p.figure ? placementBoard(p.figure, p.answer) : undefined;
  if (board) board.onChange = () => (answers = [board.value()]);
  const picker = p.answer.kind === 'choice' ? choicePicker(p.answer, (l) => (answers = [l])) : undefined;
  const input = h('input', { class: 'answer', placeholder: answerPlaceholder(p.answer), 'aria-label': `Answer ${n}`, autocomplete: 'off',
    oninput: () => (answers = [input.value]), onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && onEnter?.() });
  const mic = sttSupported()
    ? iconButton('mic', 'Answer by voice', async () => {
        mic!.classList.add('on');
        stopSpeaking();
        const r = await listen();
        mic!.classList.remove('on');
        if (!r.alternatives.length) return;
        if (board) {
          const d = r.alternatives.map((a) => parseDigits(a)).find(Boolean);
          if (d) board.fill(d);
        } else if (picker && p.answer.kind === 'choice') {
          const l = r.alternatives.map((a) => parseChoice(a, (p.answer as { options: string[] }).options)).find(Boolean);
          if (l) { picker.select(l); answers = [l]; }
        } else {
          input.value = r.alternatives[0];
          answers = r.alternatives;
        }
      }, 'mic')
    : null;
  const el = h('article', { class: 'card problem' },
    h('p', { class: 'qnum' }, String(n)),
    h('p', { class: 'question' }, rich(p.text)),
    board ? board.el : p.figure ? svg(p.figure) : null,
    picker?.el,
    h('div', { class: 'answer-row' }, board || picker ? null : input, iconButton('speaker', 'Read aloud', () => void speak(p.speech ?? p.text)), mic));
  return {
    el,
    answers: () => answers,
    focus: () => !board && !picker && matchMedia('(pointer: fine)').matches && input.focus({ preventScroll: true }),
    lock: () => {
      input.disabled = true;
      board?.disable();
      picker?.disable();
    }
  };
}
