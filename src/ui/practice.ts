import type { Grade, Problem } from '../core/types';
import { addToReview, dueReviews, load, recordAttempt, reviewResult } from '../core/storage';
import { levelFor, pickTopic } from '../core/mastery';
import { makeProblem, problemFromId, topicById, topicsForGrade } from '../content/topics';
import { speak } from '../voice/speech';
import { h } from './dom';
import { problemCard, type CardResult } from './problemCard';
import type { View } from './app';

const SESSION_GOAL = 10;

/** Smart-mix or single-topic practice with a 10-problem session goal. */
export function practiceView(topicId?: string): View {
  const state = load();
  const grade = state.settings.grade as Grade;
  const fixed = topicId ? topicById(topicId) : undefined;
  const pool = topicsForGrade(grade);
  let done = 0, right = 0, streak = 0, best = 0;
  let lastTopic: string | undefined;
  let destroyCard: () => void = () => {};

  const progress = h('div', { class: 'progress-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': SESSION_GOAL });
  const fill = h('span');
  progress.append(fill);
  const score = h('div', { class: 'session-score' });
  const slot = h('div');

  function updateScore() {
    fill.style.width = `${Math.min(100, (done / SESSION_GOAL) * 100)}%`;
    progress.setAttribute('aria-valuenow', String(done));
    score.textContent = `${right} / ${done} correct · 🔥 streak ${streak}`;
  }

  function next() {
    destroyCard();
    if (done > 0 && done % SESSION_GOAL === 0 && slot.dataset.celebrated !== String(done)) {
      slot.dataset.celebrated = String(done);
      return celebrate();
    }
    const topic = fixed ?? pickTopic(state, grade, pool, lastTopic);
    lastTopic = topic.id;
    const problem = makeProblem(topic, grade, levelFor(state, grade, topic.id));
    mount(problem);
  }

  function mount(problem: Problem) {
    const card = problemCard({
      problem,
      onDone: (r: CardResult) => {
        done++;
        const success = r.correct && r.firstTry;
        if (success) {
          right++;
          streak++;
          best = Math.max(best, streak);
        } else streak = 0;
        recordAttempt(state, grade, problem.topicId, success, {
          problemId: problem.id, level: problem.level, correct: r.correct, firstTry: success, skipped: r.skipped,
          hints: r.hints, seconds: r.seconds, answer: r.wrongAnswer, mode: 'practice'
        });
        if (!success) addToReview(state, problem.id, r.wrongAnswer);
        updateScore();
      },
      onNext: next
    });
    destroyCard = card.destroy;
    slot.replaceChildren(card.el);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function celebrate() {
    const pct = Math.round((right / done) * 100);
    const msg = pct >= 80 ? 'Amazing session! You are contest ready.' : pct >= 50 ? 'Great effort! Your missed problems are saved for review.' : 'Good practice! Mistakes help your brain grow. Try the review next.';
    speak(`You finished ${done} problems and got ${right} right. ${msg}`);
    slot.replaceChildren(
      h('div', { class: 'card celebrate' },
        h('div', { class: 'big-emoji' }, pct >= 80 ? '🏆' : pct >= 50 ? '🌟' : '💪'),
        h('h2', {}, `${right} out of ${done} on the first try`),
        h('p', {}, msg),
        h('p', { class: 'muted' }, `Best streak: ${best}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: next }, 'Keep going'),
          h('a', { class: 'btn', href: '#/review' }, 'Review mistakes'),
          h('a', { class: 'btn ghost', href: '#/' }, 'Home'))
      )
    );
  }

  updateScore();
  next();
  return {
    title: fixed ? fixed.title : 'Smart practice',
    el: h('section', {}, h('div', { class: 'session-head' }, progress, score), slot),
    destroy: () => destroyCard()
  };
}

/** Spaced-repetition review of missed problems (same problem, re-asked later). */
export function reviewView(): View {
  const state = load();
  const grade = state.settings.grade as Grade;
  const queue = dueReviews(state, grade).map((r) => ({ r, p: problemFromId(r.problemId) })).filter((x) => x.p);
  let i = 0;
  let destroyCard: () => void = () => {};
  const slot = h('div');
  const counter = h('p', { class: 'muted' });

  function next() {
    destroyCard();
    if (i >= queue.length) {
      speak(queue.length ? 'Review finished. Great job fixing your mistakes!' : 'Nothing to review right now.');
      slot.replaceChildren(
        h('div', { class: 'card celebrate' },
          h('div', { class: 'big-emoji' }, '✅'),
          h('h2', {}, queue.length ? 'Review finished!' : 'Nothing to review right now'),
          h('p', {}, queue.length ? 'Problems you got right will come back later to make sure they stick.' : 'Problems you miss in practice or meets show up here.'),
          h('a', { class: 'btn primary', href: '#/practice' }, 'Practice'))
      );
      counter.textContent = '';
      return;
    }
    const { r, p } = queue[i++];
    counter.textContent = `Review ${i} of ${queue.length}${r.wrongAnswer ? ` · last time you answered "${r.wrongAnswer}"` : ''}`;
    const card = problemCard({
      problem: p!,
      onDone: (res) => {
        const ok = res.correct && res.firstTry;
        reviewResult(state, r.problemId, ok);
        recordAttempt(state, grade, p!.topicId, ok, {
          problemId: p!.id, level: p!.level, correct: res.correct, firstTry: ok, skipped: res.skipped,
          hints: res.hints, seconds: res.seconds, answer: res.wrongAnswer, mode: 'review'
        });
      },
      onNext: next,
      nextLabel: i < queue.length ? 'Next review →' : 'Finish'
    });
    destroyCard = card.destroy;
    slot.replaceChildren(card.el);
  }
  next();
  return { title: 'Review mistakes', el: h('section', {}, counter, slot), destroy: () => destroyCard() };
}
