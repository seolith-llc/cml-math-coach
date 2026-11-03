import type { Problem } from '../core/types';
import { addToReview, load, recordAttempt } from '../core/storage';
import { levelFor, pickTopic } from '../core/mastery';
import { makeProblem, topicById, topicsForGrade } from '../content/topics';
import { h } from '../ui/dom';
import { problemCard } from '../ui/problemCard';
import { done as doneScreen, progressDots } from '../ui/session';
import type { View } from '../app';

const SESSION = 10;

/** Smart mix (weakest topics more often), or one topic: #/practice/<topicId>. 10 problems per round. */
export function practiceScreen(topicId?: string): View {
  const state = load();
  const grade = state.settings.grade;
  const fixed = topicId ? topicById(topicId) : undefined;
  const pool = topicsForGrade(grade);
  const results: boolean[] = [];
  let last: string | undefined;
  let destroyCard = () => {};
  const dots = progressDots(SESSION);
  const slot = h('div');

  function next() {
    destroyCard();
    if (results.length === SESSION) return finishRound();
    const topic = fixed ?? pickTopic(state, grade, pool, last);
    last = topic.id;
    show(makeProblem(topic, grade, levelFor(state, grade, topic.id)));
  }

  function show(problem: Problem) {
    const card = problemCard({
      problem,
      onDone: (r) => {
        const ok = r.correct && r.firstTry;
        results.push(ok);
        dots.update(results);
        recordAttempt(state, grade, problem.topicId, ok, {
          problemId: problem.id, level: problem.level, correct: r.correct, firstTry: ok, skipped: r.skipped,
          hints: r.hints, seconds: r.seconds, answer: r.wrongAnswer, mode: 'practice'
        });
        if (!ok) addToReview(state, problem.id, r.wrongAnswer);
      },
      onNext: next
    });
    destroyCard = card.destroy;
    slot.replaceChildren(card.el);
  }

  function finishRound() {
    const right = results.filter(Boolean).length;
    slot.replaceChildren(doneScreen(`${right} of ${SESSION}`, [
      h('button', { class: 'btn primary', type: 'button', onclick: () => { results.length = 0; dots.update(results); next(); } }, 'Keep going'),
      right < SESSION ? h('a', { class: 'btn', href: '#/review' }, 'Review') : null
    ]));
  }

  next();
  return { title: fixed ? fixed.title : 'Practice', el: h('div', { class: 'stack' }, dots.el, slot), destroy: () => destroyCard() };
}
