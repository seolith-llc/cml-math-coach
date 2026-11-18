/**
 * Think before help (docs/REDESIGN.md §4, step083). Pure rules for one question:
 * - a hint opens after a real try: one wrong answer, or 30 seconds of thinking;
 * - the answer opens only after 2 wrong tries and every hint;
 * - typed answers get 3 tries before the answer is shown; picture/word choices keep 2, so guessing doesn't pay;
 * - the daily Big Puzzle has no limit (the answer still opens after 3 tries and every hint).
 */
import type { AnswerSpec } from './types';

export const THINK_SECONDS = 30;

export function maxTriesFor(answer: AnswerSpec, big = false): number {
  if (big) return Infinity;
  return answer.kind === 'choice' ? 2 : 3;
}

export interface HelpState {
  hintOpen: boolean;
  answerOpen: boolean;
  /** Seconds until the hint opens by time (0 when open). */
  hintIn: number;
}

export function helpState(o: { tries: number; hintsUsed: number; hintCount: number; elapsedMs: number; big?: boolean }): HelpState {
  const hintOpen = o.tries >= 1 || o.elapsedMs >= THINK_SECONDS * 1000;
  const allHints = o.hintsUsed >= o.hintCount;
  const answerOpen = allHints && o.tries >= (o.big ? 3 : 2);
  return { hintOpen, answerOpen, hintIn: hintOpen ? 0 : Math.ceil((THINK_SECONDS * 1000 - o.elapsedMs) / 1000) };
}
