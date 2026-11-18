import { lastRound, load, type RoundKind } from '../core/storage';
import { roundFeedback, scoreText } from '../core/feedback';
import { topicById } from '../content/topics';
import { h } from '../ui/dom';
import { keepRound, recordSecondTry, restoreRound, roundEnd } from '../ui/roundEnd';
import type { View } from '../app';

const KINDS: RoundKind[] = ['number', 'thinking', 'review'];
const AGAIN: Record<RoundKind, [string, string]> = { number: ['Practice', '#/practice'], thinking: ['Practice', '#/practice/thinking'], review: ['Review', '#/review'] };

/** "7 → 9 of 10" for a saved round, for list rows. */
export function savedScore(kind: RoundKind): { score: string; href: string } | undefined {
  const state = load();
  const saved = lastRound(state, state.settings.grade, kind);
  if (!saved?.items.length) return undefined;
  const f = roundFeedback(saved.items.map((i) => {
    const topicId = i.problemId.split(':')[0];
    return { topicId, title: topicById(topicId)?.title ?? topicId, ok: i.ok, fixed: i.fixed };
  }));
  return { score: scoreText(f), href: `#/round/${kind}` };
}

/** #/round/<kind>: reopen the last round: summary, every explanation, and "Try missed again". */
export function roundScreen(param?: string): View {
  const state = load();
  const grade = state.settings.grade;
  const kind = (KINDS.includes(param as RoundKind) ? param : 'number') as RoundKind;
  const saved = lastRound(state, grade, kind);
  const slot = h('div');
  let cleanup = () => {};
  const items = saved ? restoreRound(saved) : [];
  if (!saved || !items.length) slot.replaceChildren(h('a', { class: 'btn primary hero', href: AGAIN[kind][1] }, AGAIN[kind][0]));
  else roundEnd({
    slot,
    items,
    actions: (missedLeft) => [h('a', { class: `btn ${missedLeft ? '' : 'primary'}`, href: AGAIN[kind][1] }, AGAIN[kind][0])],
    record: (it, res) => recordSecondTry(state, grade, it.problem, res),
    onChange: (all) => keepRound(state, grade, kind, all, saved.at),
    setCleanup: (fn) => (cleanup = fn)
  });
  return { title: 'Last round', el: slot, destroy: () => cleanup() };
}
