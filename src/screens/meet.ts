import type { Problem } from '../core/types';
import { answerPlaceholder, checkAnswer, formatAnswer, parseDigits } from '../core/answer';
import { addToReview, load, recordAttempt, save } from '../core/storage';
import { makeMeet } from '../content/topics';
import { speak, stopSpeaking } from '../voice/speech';
import { listen, stopListening, sttSupported } from '../voice/recognition';
import { h, iconButton, list, rich, svg } from '../ui/dom';
import { placementBoard } from '../ui/placementBoard';
import { done } from '../ui/session';
import type { View } from '../app';

const MINUTES = 30;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Contest rehearsal: 6 questions, 30 minutes, no feedback until handed in. */
export function meetScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const root = h('div', { class: 'stack' });
  let timer = 0;

  function intro() {
    root.replaceChildren(
      list([{ label: 'Questions', value: 6 }, { label: 'Time', value: `${MINUTES} min` }]),
      h('button', { class: 'btn primary hero', type: 'button', onclick: start }, 'Start'));
  }

  function start() {
    const problems = makeMeet(grade);
    const answers: string[][] = problems.map(() => []);
    const started = Date.now();
    const time = h('span', { class: 'clock', role: 'timer' });
    const tick = () => {
      const left = Math.max(0, MINUTES * 60 - Math.floor((Date.now() - started) / 1000));
      time.textContent = clock(left);
      time.classList.toggle('warn', left <= 300);
      if (left === 300) void speak('Five minutes left.');
      if (left === 0) finish(problems, answers, started);
    };
    timer = window.setInterval(tick, 1000);
    tick();
    const handIn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
      const blank = answers.filter((a) => !/[0-9a-z]/i.test(a.join(''))).length;
      if (!blank || confirm(`${blank} blank. Hand in?`)) finish(problems, answers, started);
    } }, 'Hand in');
    root.replaceChildren(h('div', { class: 'meet-bar' }, time, handIn), ...problems.map((p, i) => question(p, i, answers)));
  }

  function question(p: Problem, i: number, answers: string[][]) {
    const board = p.answer.kind === 'placement' && p.figure ? placementBoard(p.figure, p.answer) : undefined;
    if (board) board.onChange = () => (answers[i] = [board.value()]);
    const input = h('input', { class: 'answer', placeholder: answerPlaceholder(p.answer), 'aria-label': `Answer ${i + 1}`, oninput: () => (answers[i] = [input.value]) });
    const mic = sttSupported()
      ? iconButton('mic', 'Answer by voice', async () => {
          mic!.classList.add('on');
          stopSpeaking();
          const r = await listen();
          mic!.classList.remove('on');
          if (!r.alternatives.length) return;
          if (board) {
            const d = r.alternatives.map((a) => parseDigits(a)).find(Boolean);
            if (d) board.fill(d);
          } else {
            input.value = r.alternatives[0];
            answers[i] = r.alternatives;
          }
        }, 'mic')
      : null;
    return h('article', { class: 'card problem' },
      h('p', { class: 'qnum' }, String(i + 1)),
      h('p', { class: 'question' }, rich(p.text)),
      board ? board.el : p.figure ? svg(p.figure) : null,
      h('div', { class: 'answer-row' }, board ? null : input, iconButton('speaker', 'Read aloud', () => void speak(p.speech ?? p.text)), mic));
  }

  function finish(problems: Problem[], answers: string[][], started: number) {
    clearInterval(timer);
    stopListening();
    const seconds = Math.round((Date.now() - started) / 1000);
    const ok = problems.map((p, i) => answers[i].some((a) => checkAnswer(p.answer, a).correct));
    problems.forEach((p, i) => {
      recordAttempt(state, grade, p.topicId, ok[i], {
        problemId: p.id, level: p.level, correct: ok[i], firstTry: ok[i], skipped: !answers[i].join('').trim(),
        hints: 0, seconds: Math.round(seconds / problems.length), answer: ok[i] ? undefined : answers[i][0]?.slice(0, 60), mode: 'meet'
      });
      if (!ok[i]) addToReview(state, p.id, answers[i][0]);
    });
    const score = ok.filter(Boolean).length;
    state.meets.push({ date: Date.now(), grade, score, total: problems.length, seconds, topics: problems.map((p, i) => ({ topicId: p.topicId, correct: ok[i] })) });
    save(state);
    root.replaceChildren(
      done(`${score} of ${problems.length}`, [h('button', { class: 'btn primary', type: 'button', onclick: intro }, 'Again')]),
      ...problems.map((p, i) => result(p, i, answers[i][0] ?? '', ok[i])));
    window.scrollTo(0, 0);
  }

  function result(p: Problem, i: number, given: string, ok: boolean) {
    const steps = h('ol', { class: 'steps', hidden: true }, ...p.steps.map((s) => h('li', {}, s)));
    const explain = h('button', { class: 'btn plain', type: 'button', onclick: async () => {
      steps.hidden = false;
      explain.hidden = true;
      for (const s of p.steps) await speak(s);
    } }, 'Explain');
    return h('article', { class: `card problem ${ok ? 'right' : 'wrong'}` },
      h('p', { class: 'qnum' }, String(i + 1)),
      h('p', { class: 'question' }, rich(p.text)),
      p.figure ? svg(p.figure) : null,
      h('dl', { class: 'compare' },
        h('dt', {}, 'Yours'), h('dd', {}, given || '—'),
        ok ? null : h('dt', {}, 'Answer'), ok ? null : h('dd', {}, formatAnswer(p.answer))),
      explain,
      steps);
  }

  intro();
  return { title: 'Mock meet', el: root, destroy: () => { clearInterval(timer); stopSpeaking(); stopListening(); } };
}
