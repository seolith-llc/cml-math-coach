import type { Problem } from '../core/types';
import { formatAnswer, parseChoice } from '../core/answer';
import { roundFeedback, scoreText } from '../core/feedback';
import { load, recordAttempt, reviewResult, saveRound, type AppState, type RoundKind, type SavedRound } from '../core/storage';
import type { Grade } from '../core/types';
import { sceneFor } from '../core/explain';
import { problemFromId, topicById } from '../content/topics';
import { speak, stopSpeaking } from '../voice/speech';
import { stopListening } from '../voice/recognition';
import { h, iconButton, list, rich, svg } from './dom';
import { choicePicker } from './choicePicker';
import { problemCard, type CardResult } from './problemCard';
import { scenePlayer, type Player } from './player';
import { celebrate, progressDots } from './session';

export interface RoundItem {
  problem: Problem;
  /** Right on the first try. */
  ok: boolean;
  /** What the child answered first when it was wrong. */
  answer?: string;
  /** Missed, then right on a second try from the summary. */
  fixed?: boolean;
}

/**
 * The child's answer next to the right one, then the animated explanation.
 * Choice questions show the choices with theirs (red) and the right one (green).
 */
export function compareAnswer(p: Problem, given: string | undefined, ok: boolean): Node {
  if (p.answer.kind === 'choice') {
    const pick = choicePicker(p.answer, () => {});
    pick.disable();
    const mine = given ? parseChoice(given, p.answer.options) : undefined;
    if (mine && mine !== p.answer.value) pick.mark(mine, false);
    pick.mark(p.answer.value, true);
    return pick.el;
  }
  return h('dl', { class: 'compare' },
    // the entry showing the right answer gets class 'right' (the Neon highlighter marks it)
    h('dt', {}, 'Yours'), h('dd', { class: ok ? 'right' : '' }, given || (ok ? formatAnswer(p.answer) : '—')),
    ok ? null : h('dt', {}, 'Answer'), ok ? null : h('dd', { class: 'right' }, formatAnswer(p.answer)));
}

/** The question, the child's answer against the right one, then the animated explanation. */
export function answerReview(p: Problem, given: string | undefined, ok: boolean): { el: HTMLElement; player: Player } {
  const player = scenePlayer(sceneFor(p));
  return {
    el: h('article', { class: `card problem ${ok ? 'right' : 'wrong'}` }, h('p', { class: 'question' }, rich(p.text)), p.figure ? svg(p.figure) : null, compareAnswer(p, given, ok), h('div', { class: 'solution' }, player.el)),
    player
  };
}

/**
 * End of a round: score, one line of feedback, right/total per question type, and every question.
 * Tap a question to see the answer explained; "Try missed again" replays the missed ones to raise the score.
 */
export function roundEnd(o: {
  slot: HTMLElement;
  items: RoundItem[];
  /** Extra actions under the score (Keep going, Done for today…). `missedLeft`: "Try missed again" is the main action. */
  actions: (missedLeft: boolean) => (Node | null)[];
  /** Save a second-try attempt (review mode). */
  record: (item: RoundItem, res: CardResult) => void;
  /** Lets the screen clean up whatever is showing when it is left. */
  setCleanup: (fn: () => void) => void;
  /** Called when the round first shows and after every fix, so it can be saved. */
  onChange?: (items: RoundItem[]) => void;
}): void {
  const { slot, items } = o;
  let cleanup = () => {};
  const own = (fn: () => void) => {
    cleanup();
    cleanup = fn;
    o.setCleanup(() => cleanup());
  };
  const title = (p: Problem) => topicById(p.topicId)?.title ?? p.topicId;

  function summary(spoken = true) {
    own(() => {});
    const f = roundFeedback(items.map((i) => ({ topicId: i.problem.topicId, title: title(i.problem), ok: i.ok, fixed: i.fixed })));
    const missed = items.filter((i) => !i.ok && !i.fixed);
    if (spoken && load().settings.speak) void speak(`${scoreText(f).replace('→', 'now')}. ${f.line}`);
    slot.replaceChildren(h('div', { class: 'stack' },
      h('div', { class: 'card done' },
        h('p', { class: 'score' }, scoreText(f)),
        h('p', { class: 'round-line' }, f.line),
        h('div', { class: 'actions' },
          missed.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => retry(missed) }, 'Try missed again') : null,
          ...o.actions(missed.length > 0))),
      f.byType.length > 1 ? list(f.byType.map((r) => ({ label: r.title, value: `${r.right} of ${r.total}` })), 'By type') : null,
      list(items.map((it, i) => ({
        label: h('span', {}, h('span', { class: 'qn' }, `${i + 1}`), title(it.problem)),
        value: h('span', { class: it.ok || it.fixed ? 'mark good' : 'mark bad', 'aria-label': it.ok ? 'right' : it.fixed ? 'fixed' : 'missed' }, it.ok ? '✓' : it.fixed ? '↻ ✓' : '✗'),
        onclick: () => open(i)
      })), 'Questions')));
    window.scrollTo(0, 0);
  }

  function open(i: number) {
    const it = items[i];
    const r = answerReview(it.problem, it.answer, it.ok || !!it.fixed);
    own(() => r.player.destroy());
    slot.replaceChildren(h('div', { class: 'stack' },
      r.el,
      h('div', { class: 'actions row-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => summary(false) }, 'Back'),
        i + 1 < items.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => open(i + 1) }, 'Next question') : null)));
    window.scrollTo(0, 0);
    void r.player.play();
  }

  function retry(queue: RoundItem[]) {
    const dots = progressDots(queue.length);
    const results: boolean[] = [];
    const host = h('div');
    slot.replaceChildren(h('div', { class: 'stack' }, dots.el, host));
    const next = () => {
      const it = queue[results.length];
      if (!it) return summary();
      const card = problemCard({
        problem: it.problem,
        onDone: (res) => {
          const good = res.correct && res.firstTry;
          if (good) {
            it.fixed = true;
            o.onChange?.(items);
          }
          results.push(good);
          dots.update(results);
          o.record(it, res);
        },
        onNext: next
      });
      own(card.destroy);
      host.replaceChildren(card.el);
    };
    next();
  }

  o.onChange?.(items);
  summary();
}

/** A second try from the summary counts as a review attempt (and moves it along the spaced Review queue). */
export function recordSecondTry(state: AppState, grade: Grade, p: Problem, res: CardResult): void {
  const good = res.correct && res.firstTry;
  reviewResult(state, p.id, good);
  celebrate(recordAttempt(state, grade, p.topicId, good, {
    problemId: p.id, level: p.level, correct: res.correct, firstTry: good, skipped: res.skipped,
    hints: res.hints, seconds: res.seconds, answer: res.wrongAnswer, mode: 'review'
  }));
}

/** Save a round as the last one of its kind (reopened from Home or the CogAT screen). */
export function keepRound(state: AppState, grade: Grade, kind: RoundKind, items: RoundItem[], at: number): void {
  saveRound(state, { kind, grade, at, items: items.map((i) => ({ problemId: i.problem.id, ok: i.ok, ...(i.answer ? { answer: i.answer } : {}), ...(i.fixed ? { fixed: true } : {}) })) });
}

/** Rebuild a saved round (problems regenerate from their ids). */
export function restoreRound(saved: SavedRound): RoundItem[] {
  return saved.items.flatMap((i) => {
    const problem = problemFromId(i.problemId);
    return problem ? [{ problem, ok: i.ok, answer: i.answer, fixed: i.fixed }] : [];
  });
}

/**
 * Look back at an answered question mid-round: the child's answer vs the right one and the explanation,
 * ‹ › to move between answered questions, and "Try again" on a missed one (a fix, like at the end).
 * The current question's card is kept as is and comes back on "Back to question N".
 */
export function peekRound(o: {
  slot: HTMLElement;
  items: RoundItem[];
  index: number;
  /** The question the child was on (1-based), for the back button. */
  current: number;
  /** Put the current question's card back. */
  onClose: () => void;
  record: (item: RoundItem, res: CardResult) => void;
  onChange?: (items: RoundItem[]) => void;
  setCleanup: (fn: () => void) => void;
}): void {
  let stop = () => {};
  const own = (fn: () => void) => {
    stop();
    stop = fn;
    o.setCleanup(() => stop());
  };
  const close = () => {
    own(() => {});
    o.onClose();
  };

  function show(i: number) {
    const it = o.items[i];
    const r = answerReview(it.problem, it.answer, it.ok || !!it.fixed);
    own(() => r.player.destroy());
    const prev = iconButton('prev', 'Previous question', () => show(i - 1));
    const next = iconButton('next', 'Next question', () => show(i + 1));
    prev.disabled = i === 0;
    next.disabled = i >= o.items.length - 1;
    o.slot.replaceChildren(h('div', { class: 'stack' },
      h('div', { class: 'peek-nav' }, prev, h('button', { class: 'btn primary', type: 'button', onclick: close }, `Back to question ${o.current}`), next),
      r.el,
      !it.ok && !it.fixed ? h('button', { class: 'btn', type: 'button', onclick: () => retry(i) }, 'Try again') : null));
    window.scrollTo(0, 0);
  }

  function retry(i: number) {
    const it = o.items[i];
    const card = problemCard({
      problem: it.problem,
      onDone: (res) => {
        if (res.correct && res.firstTry) {
          it.fixed = true;
          o.onChange?.(o.items);
        }
        o.record(it, res);
      },
      onNext: () => show(i)
    });
    own(card.destroy);
    o.slot.replaceChildren(card.el);
    window.scrollTo(0, 0);
  }

  stopSpeaking();
  stopListening();
  show(o.index);
}
