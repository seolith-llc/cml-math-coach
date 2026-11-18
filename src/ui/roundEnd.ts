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
import { awardStickers, logRound, stickersToday, type Sticker } from '../core/storage';
import { today } from '../core/progress';
import { DAILY_MAX, STICKER_LABELS, roundStickers, stickerSvg } from '../content/stickers';
import { buddyView } from './buddy';
import { confetti, gameLook } from './fx';
import { sfx } from '../voice/music';

export interface RoundItem {
  problem: Problem;
  /** Right on the first try. */
  ok: boolean;
  /** What the child answered first when it was wrong. */
  answer?: string;
  /** Missed, then right on a second try from the summary. */
  fixed?: boolean;
  /** Picked the right reason for "How did you know?" (core/explainBack.ts). */
  reasoned?: boolean;
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
  /** Game look: stars and today's goal when the round started, so the round end can celebrate and award stickers.
   *  Left out when reopening a saved round, so nothing is earned twice. */
  celebrate?: RoundStart;
  /** What kind of round, for the round log (Practice: number or thinking; Review: review). */
  kind?: RoundKind;
}): void {
  const { slot, items } = o;
  let cleanup = () => {};
  const own = (fn: () => void) => {
    cleanup();
    cleanup = fn;
    o.setCleanup(() => cleanup());
  };
  const title = (p: Problem) => topicById(p.topicId)?.title ?? p.topicId;

  // Game look: the celebration card and stickers (docs/GAME-MODE.md phase 4), computed once per round.
  let earned: Sticker[] | undefined;
  let celebrated = false;
  const playful = () => !!o.celebrate && gameLook();
  const facts = () => roundFeedback(items.map((i) => ({ topicId: i.problem.topicId, title: title(i.problem), ok: i.ok, fixed: i.fixed })));
  // Phase 5: log every live round once (both looks), the first time its summary shows.
  let logged = false;
  function logOnce() {
    if (!o.celebrate || logged) return;
    logged = true;
    const state = load();
    const st = state.settings;
    const f = facts();
    logRound(state, {
      at: Date.now(), look: st.look, music: st.look === 'game' ? st.music.tune : 'off', kind: o.kind ?? 'number',
      grade: st.grade, total: f.total, right: f.right, fixed: f.fixed
    });
  }
  function award() {
    if (!playful() || earned) return;
    const state = load();
    const grade = state.settings.grade;
    const f = facts();
    const goalNow = today({ log: state.log, goal: state.settings.goal, reviewDue: 0, meets: [] }).goalMet;
    earned = awardStickers(state, roundStickers({
      right: f.right, fixed: f.fixed, total: f.total, reasoned: o.items.filter((x) => x.reasoned).length,
      starsGained: roundStars(state, grade) - o.celebrate!.starsBefore,
      goalReached: !o.celebrate!.goalBefore && goalNow,
      todayCount: stickersToday(state)
    }), grade);
  }
  /** A miss fixed after the summary appeared also earns "Fixed a miss" (once a round, within today's cap). */
  function awardFix() {
    if (!playful() || !earned || earned.some((x) => x.kind === 'fixer')) return;
    const state = load();
    if (stickersToday(state) >= DAILY_MAX) return;
    earned.push(...awardStickers(state, ['fixer'], state.settings.grade));
    celebrated = false; // show the new sticker with a small burst
  }
  function celebration(): HTMLElement | null {
    if (!playful()) return null;
    const f = facts();
    const buddy = buddyView('big');
    const missedLeft = f.total - f.right - f.fixed;
    buddy.say(
      f.fixed && !missedLeft ? 'You fixed every miss!'
        : f.right >= Math.ceil(f.total * 0.8) ? 'What a careful round!'
        : f.fixed ? 'You went back and fixed it!'
        : "You kept going. That's how we grow!",
      'cheer', 5000, true);
    const card = h('section', { class: 'card round-cheer' }, buddy.el,
      earned?.length
        ? h('div', { class: 'sticker-row', role: 'list', 'aria-label': 'New stickers' }, ...earned.map((st) =>
          h('div', { class: 'sticker-new', role: 'listitem' }, h('span', { class: 'sticker-art', html: stickerSvg(st.design) }), h('span', { class: 'sticker-why' }, STICKER_LABELS[st.kind]))))
        : null);
    if (!celebrated) {
      celebrated = true;
      requestAnimationFrame(() => confetti(card, Math.min(36, 8 + 2 * (f.right + f.fixed))));
      sfx(earned?.length ? 'star' : 'right');
    }
    return card;
  }

  function summary(spoken = true) {
    own(() => {});
    const f = roundFeedback(items.map((i) => ({ topicId: i.problem.topicId, title: title(i.problem), ok: i.ok, fixed: i.fixed })));
    const missed = items.filter((i) => !i.ok && !i.fixed);
    if (spoken && load().settings.speak) void speak(`${scoreText(f).replace('→', 'now')}. ${f.line}`);
    logOnce();
    award();
    slot.replaceChildren(h('div', { class: 'stack' },
      celebration(),
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
            awardFix();
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

/** What the round-end celebration compares against (taken when a round starts). */
export interface RoundStart {
  starsBefore: number;
  goalBefore: boolean;
}

/** All stars of a grade (Number and Thinking Puzzles), to see whether a round earned one. */
export function roundStars(state: AppState, grade: Grade): number {
  return Object.values(state.stats[String(grade)] ?? {}).reduce((n, st) => n + ((st as { stars?: number }).stars ?? 0), 0);
}

/** Snapshot at the start of a round (game look celebrations). */
export function roundStart(state: AppState): RoundStart {
  const s = state.settings;
  return { starsBefore: roundStars(state, s.grade), goalBefore: today({ log: state.log, goal: s.goal, reviewDue: 0, meets: [] }).goalMet };
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

/** Save a round as the last one of its kind (reopened from Home or the Thinking Puzzles screen). */
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
