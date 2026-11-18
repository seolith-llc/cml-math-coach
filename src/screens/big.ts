import { addToReview, load, recordAttempt, saveBig, today } from '../core/storage';
import { bigPuzzleId } from '../core/bigPuzzle';
import { problemFromId } from '../content/topics';
import { problemCard } from '../ui/problemCard';
import { celebrate } from '../ui/session';
import { confetti } from '../ui/fx';
import { h } from '../ui/dom';
import type { View } from '../app';

/** #/big: today's Big Puzzle (core/bigPuzzle.ts). No clock, no try limit; a solved one stays solved for the day. */
export function bigScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const day = today();
  const problem = problemFromId(bigPuzzleId(day, grade))!;
  const done = state.big?.[`${day}:${grade}`];
  const root = h('div', { class: 'stack big-puzzle' });
  const card = problemCard({
    problem,
    big: true,
    onDone: (r) => {
      saveBig(state, day, grade, { solved: r.correct, seconds: r.seconds, hints: r.hints, at: Date.now() });
      const ev = recordAttempt(state, grade, problem.topicId, r.correct && r.firstTry, {
        problemId: problem.id, level: problem.level, correct: r.correct, firstTry: r.correct && r.firstTry, skipped: r.skipped,
        hints: r.hints, seconds: r.seconds, answer: r.wrongAnswer, mode: 'practice'
      });
      if (!r.correct) addToReview(state, problem.id, r.wrongAnswer);
      celebrate(ev);
      if (r.correct) confetti(root, 40);
    },
    onNext: () => (location.hash = '#/')
  });
  root.append(card.el);
  if (done?.solved) root.prepend(h('p', { class: 'feedback good' }, '★ Solved today'));
  return { title: 'Big Puzzle', el: root, destroy: card.destroy };
}
