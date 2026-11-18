/**
 * Game-look feedback (docs/GAME-MODE.md, phase 1): a short burst around the card on a right answer, a gentle wobble on a miss.
 * Only with <html data-look="game">; never animates the question text itself, and nothing moves under reduced motion.
 */
import { sfx } from '../voice/music';

const COLORS = ['#ff6b9a', '#ffb703', '#2ec4b6', '#7b5cff', '#3a86ff', '#8ac926'];

export function gameLook(): boolean {
  return document.documentElement.dataset.look === 'game';
}

export function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced' || !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Celebrate (right) or soften (wrong) on the card. Short (≤ 600 ms) and removed afterwards. */
export function cheer(card: HTMLElement, right: boolean): void {
  if (!gameLook()) return;
  // Lets the buddy (ui/buddy.ts trailBuddy) react to every checked answer, including a first wrong try.
  card.dispatchEvent(new CustomEvent('pt:answer', { bubbles: true, detail: { right } }));
  sfx(right ? 'right' : 'miss');
  const cls = right ? 'fx-pop' : 'fx-wobble';
  card.classList.remove('fx-pop', 'fx-wobble');
  void card.offsetWidth; // restart the animation
  card.classList.add(cls);
  setTimeout(() => card.classList.remove(cls), 650);
  if (right && !reducedMotion()) burst(card);
}

/** A celebration burst on any element, sized by `amount` (game look, full motion only). */
export function confetti(el: HTMLElement, amount = 18): void {
  if (!gameLook() || reducedMotion()) return;
  burst(el, amount);
}

function burst(card: HTMLElement, count = 18): void {
  const layer = document.createElement('div');
  layer.className = 'fx-burst';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 90 + Math.random() * 70;
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    s.style.background = COLORS[i % COLORS.length];
    if (i % 3 === 0) s.style.borderRadius = '2px';
    layer.append(s);
  }
  card.append(layer);
  setTimeout(() => layer.remove(), 700);
}
