import type { Grade, Problem } from '../core/types';
import { checkAnswer, formatAnswer, answerPlaceholder } from '../core/answer';
import { addToReview, load, recordAttempt, save } from '../core/storage';
import { makeMeet, topicById } from '../content/topics';
import { CONTEST_TIPS } from '../content/strategies';
import { speak, stopSpeaking } from '../voice/speech';
import { listen, stopListening, sttSupported } from '../voice/recognition';
import { h, rich, svg } from './dom';
import type { View } from './app';

const MINUTES = 30;

/** Mock contest: 6 questions, 30 minutes, no feedback until the end, as on contest day. */
export function meetView(): View {
  const state = load();
  const grade = state.settings.grade as Grade;
  const root = h('section');
  let timer = 0;

  function intro() {
    root.replaceChildren(
      h('div', { class: 'card' },
        h('h2', {}, `Mock Meet · Grade ${grade}`),
        h('p', {}, `6 questions · ${MINUTES} minutes · answers are checked at the end, just like contest day.`),
        h('ul', { class: 'tips' }, ...CONTEST_TIPS.slice(0, 4).map((t) => h('li', {}, t))),
        h('button', { class: 'btn primary big', onclick: start }, 'Start the meet ⏱')
      )
    );
  }

  function start() {
    const problems = makeMeet(grade);
    const answers: string[][] = problems.map(() => []);
    const started = Date.now();
    const clock = h('div', { class: 'clock', 'aria-live': 'off' });
    const tick = () => {
      const left = Math.max(0, MINUTES * 60 - Math.floor((Date.now() - started) / 1000));
      clock.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      clock.classList.toggle('warn', left <= 300);
      if (left === 300) speak('Five minutes left.');
      if (left === 0) finish(problems, answers, started);
    };
    timer = window.setInterval(tick, 1000);
    tick();
    const items = problems.map((p, i) => question(p, i, answers));
    root.replaceChildren(
      h('div', { class: 'meet-head' }, clock, h('button', { class: 'btn primary', onclick: () => confirmFinish(problems, answers, started) }, 'Hand in')),
      ...items
    );
  }

  function question(p: Problem, i: number, answers: string[][]) {
    const input = h('input', { class: 'answer-input', placeholder: answerPlaceholder(p.answer), 'aria-label': `Answer to question ${i + 1}`, oninput: () => (answers[i] = [input.value]) });
    const heard = h('span', { class: 'heard' });
    const mic = h('button', {
      class: 'mic small', type: 'button', 'aria-label': 'Answer by voice',
      onclick: async () => {
        mic.classList.add('on');
        stopSpeaking();
        const r = await listen((t) => (heard.textContent = t));
        mic.classList.remove('on');
        if (r.alternatives.length) {
          input.value = r.alternatives[0];
          answers[i] = r.alternatives;
          heard.textContent = '';
        } else heard.textContent = 'Did not catch that. Try again or type.';
      }
    }, '🎤');
    return h('article', { class: 'card problem meet-q' },
      h('div', { class: 'qnum' }, `${i + 1}`),
      h('p', { class: 'question' }, rich(p.text)),
      p.figure ? svg(p.figure) : null,
      h('div', { class: 'answer-row' }, input,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(p.speech ?? p.text) }, '🔊'),
        sttSupported() ? mic : null),
      heard);
  }

  function confirmFinish(problems: Problem[], answers: string[][], started: number) {
    const blank = answers.filter((a) => !a.join('').trim()).length;
    if (blank && !confirm(`You left ${blank} question${blank > 1 ? 's' : ''} blank. Hand in anyway?`)) return;
    finish(problems, answers, started);
  }

  function finish(problems: Problem[], answers: string[][], started: number) {
    clearInterval(timer);
    stopListening();
    const seconds = Math.round((Date.now() - started) / 1000);
    const results = problems.map((p, i) => answers[i].some((a) => checkAnswer(p.answer, a).correct));
    const score = results.filter(Boolean).length;
    problems.forEach((p, i) => {
      recordAttempt(state, grade, p.topicId, results[i]);
      if (!results[i]) addToReview(state, p.id, answers[i][0]);
    });
    state.meets.push({ date: Date.now(), grade, score, total: problems.length, seconds, topics: problems.map((p, i) => ({ topicId: p.topicId, correct: results[i] })) });
    save(state);
    const msg = score === 6 ? 'A perfect score! Outstanding!' : score >= 4 ? 'Strong result! Let\'s look at the ones you missed.' : 'Good effort! Every mistake is a lesson. Let\'s go through them together.';
    speak(`You scored ${score} out of 6. ${msg}`);
    root.replaceChildren(
      h('div', { class: 'card celebrate' },
        h('div', { class: 'big-emoji' }, score === 6 ? '🏆' : score >= 4 ? '🥈' : '📚'),
        h('h2', {}, `${score} / 6`),
        h('p', {}, msg),
        h('p', { class: 'muted' }, `Time used: ${Math.floor(seconds / 60)} min ${seconds % 60} s`)),
      ...problems.map((p, i) => resultCard(p, i, answers[i][0] ?? '', results[i])),
      h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: intro }, 'Another meet'), h('a', { class: 'btn', href: '#/review' }, 'Review mistakes'))
    );
    window.scrollTo({ top: 0 });
  }

  function resultCard(p: Problem, i: number, given: string, ok: boolean) {
    const steps = h('ol', { class: 'solution', hidden: true }, ...p.steps.map((s) => h('li', {}, s)));
    return h('article', { class: `card problem result ${ok ? 'ok' : 'miss'}` },
      h('div', { class: 'qnum' }, ok ? '✔' : '✘'),
      h('p', { class: 'chip' }, `Question ${i + 1} · ${topicById(p.topicId)?.title ?? ''}`),
      h('p', { class: 'question' }, rich(p.text)),
      p.figure ? svg(p.figure) : null,
      h('p', {}, h('strong', {}, 'Your answer: '), given || '(blank)', ' · ', h('strong', {}, 'Correct: '), formatAnswer(p.answer)),
      h('button', {
        class: 'btn ghost', onclick: async () => {
          steps.hidden = false;
          for (const s of p.steps) await speak(s);
        }
      }, ok ? '📖 Show solution' : '🧑‍🏫 Explain it to me'),
      steps);
  }

  intro();
  return { title: 'Mock Meet', el: root, destroy: () => { clearInterval(timer); stopSpeaking(); stopListening(); } };
}
