import type { Problem } from '../core/types';
import { addToReview, load, recordAttempt, reviewResult } from '../core/storage';
import { levelFor, pickTopic } from '../core/mastery';
import { makeProblem, topicById, topicsForGrade } from '../content/topics';
import { h } from '../ui/dom';
import { problemCard } from '../ui/problemCard';
import { celebrate, progressDots } from '../ui/session';
import { roundEnd, type RoundItem } from '../ui/roundEnd';
import { today } from '../core/progress';
import type { View } from '../app';

const SESSION = 10;

/** Smart mix (weakest topics more often), the CogAT mix (#/practice/cogat), or one topic: #/practice/<topicId>. 10 problems per round. */
export function practiceScreen(topicId?: string): View {
  const state = load();
  const grade = state.settings.grade;
  const cogat = topicId === 'cogat';
  const fixed = topicId && !cogat ? topicById(topicId) : undefined;
  const pool = topicsForGrade(grade, cogat ? 'cogat' : 'cml');
  const results: boolean[] = [];
  let round: RoundItem[] = [];
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
        round.push({ problem, ok, answer: r.wrongAnswer });
        dots.update(results);
        const ev = recordAttempt(state, grade, problem.topicId, ok, {
          problemId: problem.id, level: problem.level, correct: r.correct, firstTry: ok, skipped: r.skipped,
          hints: r.hints, seconds: r.seconds, answer: r.wrongAnswer, mode: 'practice'
        });
        if (!ok) addToReview(state, problem.id, r.wrongAnswer);
        celebrate(ev);
      },
      onNext: next
    });
    destroyCard = card.destroy;
    slot.replaceChildren(card.el);
  }

  function finishRound() {
    const goalMet = today({ log: state.log, goal: state.settings.goal, reviewDue: 0, meets: [] }).goalMet;
    dots.el.hidden = true;
    const items = round;
    roundEnd({
      slot,
      items,
      // Once today's goal is met, finishing is the main action: healthy stopping points, not endless play.
      actions: (missedLeft) => [
        goalMet ? h('a', { class: `btn ${missedLeft ? '' : 'primary'}`, href: '#/' }, 'Done for today') : null,
        h('button', { class: `btn ${goalMet || missedLeft ? '' : 'primary'}`, type: 'button', onclick: () => {
          results.length = 0;
          round = [];
          dots.update(results);
          dots.el.hidden = false;
          next();
        } }, 'Keep going')
      ],
      record: (it, res) => {
        const good = res.correct && res.firstTry;
        reviewResult(state, it.problem.id, good);
        celebrate(recordAttempt(state, grade, it.problem.topicId, good, {
          problemId: it.problem.id, level: it.problem.level, correct: res.correct, firstTry: good, skipped: res.skipped,
          hints: res.hints, seconds: res.seconds, answer: res.wrongAnswer, mode: 'review'
        }));
      },
      setCleanup: (fn) => (destroyCard = fn)
    });
  }

  next();
  return { title: fixed ? fixed.title : cogat ? 'CogAT' : 'Practice', el: h('div', { class: 'stack' }, dots.el, slot), destroy: () => destroyCard() };
}
