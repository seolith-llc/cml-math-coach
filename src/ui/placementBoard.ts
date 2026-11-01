import type { AnswerSpec } from '../core/types';
import { slotName } from '../core/answer';
import { h, svg } from './dom';

type PlacementSpec = Extract<AnswerSpec, { kind: 'placement' }>;

export interface PlacementBoard {
  el: HTMLElement;
  value(): string;
  /** Fill slots from a digit string like "25314" (e.g. from speech). */
  fill(digits: string): void;
  disable(): void;
  onChange?: () => void;
}

/** Tap a circle, then tap a digit. Works with touch, mouse and keyboard. */
export function placementBoard(figure: string, spec: PlacementSpec): PlacementBoard {
  const wrap = svg(figure);
  wrap.classList.add('placement');
  const slots = Array.from(wrap.querySelectorAll<SVGGElement>('[data-slot]'));
  const values: (number | null)[] = slots.map((g) => (g.dataset.fixed !== undefined ? +g.dataset.fixed : null));
  const fixed = slots.map((g) => g.dataset.fixed !== undefined);
  let selected = values.findIndex((v) => v === null);
  let disabled = false;
  const status = h('p', { class: 'muted small', 'aria-live': 'polite' });

  const palette = h('div', { class: 'palette', role: 'group', 'aria-label': 'Digits' });
  const digitBtns = spec.digits.map((d) =>
    h('button', { class: 'digit-btn', type: 'button', 'aria-label': `Digit ${d}`, onclick: () => place(d) }, String(d))
  );
  palette.append(...digitBtns, h('button', { class: 'digit-btn clear', type: 'button', 'aria-label': 'Clear', onclick: clearSelected }, '⌫'));

  function render() {
    slots.forEach((g, i) => {
      (g.querySelector('.slot-digit') as SVGTextElement).textContent = values[i] === null ? '' : String(values[i]);
      g.classList.toggle('selected', i === selected && !disabled);
      g.setAttribute('aria-label', `Circle ${slotName(i)}${values[i] === null ? ', empty' : `, ${values[i]}`}${fixed[i] ? ', given' : ''}`);
    });
    digitBtns.forEach((b, i) => b.classList.toggle('used', values.includes(spec.digits[i])));
    status.textContent = selected >= 0 && !disabled ? `Choose a digit for circle ${slotName(selected)}.` : '';
    // line totals help children see progress
    board.onChange?.();
  }

  function select(i: number) {
    if (disabled || fixed[i]) return;
    selected = i;
    render();
  }

  function place(d: number) {
    if (disabled) return;
    if (selected < 0) selected = values.findIndex((v, i) => v === null && !fixed[i]);
    if (selected < 0) return;
    const prev = values.indexOf(d);
    if (prev >= 0 && !fixed[prev]) values[prev] = null;
    values[selected] = d;
    const nextEmpty = values.findIndex((v, i) => v === null && !fixed[i]);
    selected = nextEmpty;
    render();
  }

  function clearSelected() {
    if (disabled) return;
    if (selected >= 0 && !fixed[selected]) values[selected] = null;
    else {
      const last = values.map((v, i) => (v !== null && !fixed[i] ? i : -1)).filter((i) => i >= 0).pop();
      if (last !== undefined) {
        values[last] = null;
        selected = last;
      }
    }
    render();
  }

  slots.forEach((g, i) => {
    g.setAttribute('tabindex', fixed[i] ? '-1' : '0');
    g.setAttribute('role', 'button');
    g.addEventListener('click', () => select(i));
    g.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === 'Enter' || k === ' ') select(i);
      if (/^\d$/.test(k) && spec.digits.includes(+k)) {
        select(i);
        place(+k);
      }
      if (k === 'Backspace' || k === 'Delete') {
        select(i);
        clearSelected();
      }
    });
  });

  const board: PlacementBoard = {
    el: h('div', { class: 'placement-wrap' }, wrap, palette, status),
    value: () => values.map((v) => (v === null ? '_' : String(v))).join(''),
    fill: (digits: string) => {
      const ds = digits.replace(/\D/g, '').split('').map(Number);
      let j = 0;
      for (let i = 0; i < values.length && j < ds.length; i++) if (!fixed[i]) values[i] = ds[j++];
      selected = values.findIndex((v, i) => v === null && !fixed[i]);
      render();
    },
    disable: () => {
      disabled = true;
      palette.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
      render();
    }
  };
  render();
  return board;
}
