import { dueReviews, load, recordAttempt, reviewResult } from '../core/storage';
import { problemFromId } from '../content/topics';
import { h } from '../ui/dom';
import { problemCard } from '../ui/problemCard';
import { done, progressDots } from '../ui/session';
import type { View } from '../app';

/** Missed problems come back (same problem) on a spaced schedule: same day, 1, 3, 7, 14 days. */
export function reviewScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const queue = dueReviews(state, grade).map((r) => ({ r, p: problemFromId(r.problemId)! })).filter((x) => x.p);
  const results: boolean[] = [];
  const dots = progressDots(queue.length);
  const slot = h('div');
  let destroyCard = () => {};

  function next() {
    destroyCard();
    const item = queue[results.length];
    if (!item) {
      slot.replaceChildren(queue.length
        ? done(`${results.filter(Boolean).length} of ${queue.length}`, [h('a', { class: 'btn primary', href: '#/practice' }, 'Practice')])
        : h('div', { class: 'stack' }, h('p', { class: 'empty' }, 'Nothing to review'), h('a', { class: 'btn primary hero', href: '#/practice' }, 'Practice')));
      return;
    }
    const card = problemCard({
      problem: item.p,
      onDone: (res) => {
        const ok = res.correct && res.firstTry;
        results.push(ok);
        dots.update(results);
        reviewResult(state, item.r.problemId, ok);
        recordAttempt(state, grade, item.p.topicId, ok, {
          problemId: item.p.id, level: item.p.level, correct: res.correct, firstTry: ok, skipped: res.skipped,
          hints: res.hints, seconds: res.seconds, answer: res.wrongAnswer, mode: 'review'
        });
      },
      onNext: next
    });
    destroyCard = card.destroy;
    slot.replaceChildren(card.el);
  }

  next();
  return { title: 'Review', el: h('div', { class: 'stack' }, queue.length ? dots.el : null, slot), destroy: () => destroyCard() };
}
