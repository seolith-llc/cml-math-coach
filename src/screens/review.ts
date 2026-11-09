import { dueReviews, load } from '../core/storage';
import { problemFromId } from '../content/topics';
import { h } from '../ui/dom';
import { problemCard } from '../ui/problemCard';
import { progressDots } from '../ui/session';
import { keepRound, recordSecondTry, roundEnd, type RoundItem } from '../ui/roundEnd';
import type { View } from '../app';

/** Missed problems come back (same problem) on a spaced schedule: same day, 1, 3, 7, 14 days. */
export function reviewScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const queue = dueReviews(state, grade).map((r) => ({ r, p: problemFromId(r.problemId)! })).filter((x) => x.p);
  const results: boolean[] = [];
  const round: RoundItem[] = [];
  const dots = progressDots(queue.length);
  const slot = h('div');
  let destroyCard = () => {};

  function next() {
    destroyCard();
    const item = queue[results.length];
    if (!item) {
      if (!queue.length) slot.replaceChildren(h('div', { class: 'stack' }, h('p', { class: 'empty' }, 'Nothing to review'), h('a', { class: 'btn primary hero', href: '#/practice' }, 'Practice')));
      else {
        dots.el.hidden = true;
        const at = Date.now();
        roundEnd({
          slot,
          items: round,
          actions: (missedLeft) => [h('a', { class: `btn ${missedLeft ? '' : 'primary'}`, href: '#/practice' }, 'Practice')],
          record: (it, res) => recordSecondTry(state, grade, it.problem, res),
          onChange: (all) => keepRound(state, grade, 'review', all, at),
          setCleanup: (fn) => (destroyCard = fn)
        });
      }
      return;
    }
    const card = problemCard({
      problem: item.p,
      onDone: (res) => {
        const ok = res.correct && res.firstTry;
        results.push(ok);
        round.push({ problem: item.p, ok, answer: res.wrongAnswer });
        dots.update(results);
        recordSecondTry(state, grade, item.p, res);
      },
      onNext: next
    });
    destroyCard = card.destroy;
    slot.replaceChildren(card.el);
  }

  next();
  return { title: 'Review', el: h('div', { class: 'stack' }, queue.length ? dots.el : null, slot), destroy: () => destroyCard() };
}
