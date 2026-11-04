import type { Problem } from '../core/types';
import { checkAnswer, formatAnswer } from '../core/answer';
import { addToReview, load, recordAttempt, save } from '../core/storage';
import { COUNTS, EACH_SECONDS, TOTAL_MINUTES, clockSeconds, formatClock, formatDuration, type ClockKind, type Feedback, type TestConfig } from '../core/session';
import { makeMeet } from '../content/topics';
import { speak, stopSpeaking } from '../voice/speech';
import { stopListening } from '../voice/recognition';
import { fill, group, h, list, rich, segmented, svg } from '../ui/dom';
import { answerCard } from '../ui/answerCard';
import { clock } from '../ui/clock';
import { problemCard } from '../ui/problemCard';
import { done, progressDots } from '../ui/session';
import type { View } from '../app';

/**
 * Tests: pick how many questions, Learn (coached) or Test (scored at the end), and a clock
 * (off, total for the whole test, or each question). The last setup is remembered.
 */
export function testScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const root = h('div', { class: 'stack' });
  let cleanup = () => {};

  function setup() {
    cleanup();
    const cfg: TestConfig = { ...state.settings.test };
    const persist = () => {
      state.settings.test = { ...cfg };
      save(state);
    };
    const time = h('select', { class: 'row-input', 'aria-label': 'Time', onchange: () => {
      if (cfg.clock === 'total') cfg.totalMinutes = Number(time.value);
      else cfg.eachSeconds = Number(time.value);
      persist();
    } });
    const timeRow = h('label', { class: 'row' }, h('span', { class: 'row-label' }, 'Time'), time);
    const drawTime = () => {
      timeRow.hidden = cfg.clock === 'off';
      const [values, current, toSec] = cfg.clock === 'total'
        ? [TOTAL_MINUTES, cfg.totalMinutes, (v: number) => v * 60]
        : [EACH_SECONDS, cfg.eachSeconds, (v: number) => v];
      time.replaceChildren(...values.map((v) => h('option', { value: String(v), selected: v === current }, formatDuration(toSec(v)))));
    };
    drawTime();
    fill(root,
      group('Questions', segmented<number>('Questions', COUNTS.map((n) => ({ value: n, label: String(n) })), cfg.count, (v) => { cfg.count = v; persist(); })),
      group('Mode', segmented<Feedback>('Mode', [{ value: 'learn', label: 'Learn' }, { value: 'test', label: 'Test' }], cfg.feedback, (v) => { cfg.feedback = v; persist(); })),
      group('Clock',
        segmented<ClockKind>('Clock', [{ value: 'off', label: 'Off' }, { value: 'total', label: 'Total' }, { value: 'each', label: 'Each' }], cfg.clock, (v) => { cfg.clock = v; persist(); drawTime(); }),
        timeRow),
      h('button', { class: 'btn primary hero', type: 'button', onclick: () => run({ ...cfg }) }, 'Start'));
  }

  function run(cfg: TestConfig) {
    const problems = makeMeet(grade, undefined, cfg.count);
    const started = Date.now();
    const seconds = clockSeconds(cfg);
    const speakOn = () => load().settings.speak;
    if (cfg.feedback === 'learn') return runLearn(cfg, problems, started, seconds, speakOn);
    if (cfg.clock === 'each') return runEach(cfg, problems, started, seconds!);
    return runPaper(cfg, problems, started, seconds, speakOn);
  }

  /** Test mode, no clock or a total clock: all questions on one page, like a contest paper. */
  function runPaper(cfg: TestConfig, problems: Problem[], started: number, seconds: number | null, speakOn: () => boolean) {
    const cards = problems.map((p, i) => answerCard(p, i + 1));
    const c = seconds ? clock(() => finishTest(cfg, problems, cards.map((x) => x.answers()), started), () => speakOn() && void speak('One minute left.')) : null;
    const handIn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
      const blank = cards.filter((x) => !/[0-9a-z]/i.test(x.answers().join(''))).length;
      if (!blank || confirm(`${blank} blank. Hand in?`)) finishTest(cfg, problems, cards.map((x) => x.answers()), started);
    } }, 'Hand in');
    cleanup = () => c?.stop();
    fill(root, h('div', { class: 'meet-bar' }, c ? c.el : h('span'), handIn), ...cards.map((x) => x.el));
    c?.start(seconds!);
  }

  /** Test mode, a clock per question: one question at a time; time up moves on. */
  function runEach(cfg: TestConfig, problems: Problem[], started: number, seconds: number) {
    const answers: string[][] = problems.map(() => []);
    const dots = progressDots(problems.length);
    const slot = h('div');
    let i = -1;
    let card: ReturnType<typeof answerCard> | undefined;
    const c = clock(() => next());
    const nextBtn = h('button', { class: 'btn primary hero', type: 'button', onclick: () => next() }, 'Next');
    function next() {
      if (card) {
        answers[i] = card.answers();
        card.lock();
        dots.update(answers.slice(0, i + 1).map(() => null));
      }
      i++;
      if (i >= problems.length) return finishTest(cfg, problems, answers, started);
      card = answerCard(problems[i], i + 1, () => next());
      nextBtn.textContent = i === problems.length - 1 ? 'Hand in' : 'Next';
      fill(slot, card.el);
      c.start(seconds);
      card.focus();
      window.scrollTo(0, 0);
    }
    cleanup = () => c.stop();
    fill(root, h('div', { class: 'meet-bar' }, c.el, dots.el), slot, nextBtn);
    next();
  }

  /** Learn mode: coached cards one at a time, with an optional clock (total or per question). */
  function runLearn(cfg: TestConfig, problems: Problem[], started: number, seconds: number | null, speakOn: () => boolean) {
    const results: boolean[] = [];
    const dots = progressDots(problems.length);
    const slot = h('div');
    let current: ReturnType<typeof problemCard> | undefined;
    const c = seconds
      ? clock(
          () => (cfg.clock === 'each' ? current?.expire() : finishLearn(results, problems.length, started)),
          () => cfg.clock === 'total' && speakOn() && void speak('One minute left.'))
      : null;
    function next() {
      current?.destroy();
      const p = problems[results.length];
      if (!p) return finishLearn(results, problems.length, started);
      current = problemCard({
        problem: p,
        onDone: (r) => {
          const ok = r.correct && r.firstTry;
          results.push(ok);
          dots.update(results);
          if (cfg.clock === 'each') c?.stop();
          recordAttempt(state, grade, p.topicId, ok, {
            problemId: p.id, level: p.level, correct: r.correct, firstTry: ok, skipped: r.skipped,
            hints: r.hints, seconds: r.seconds, answer: r.wrongAnswer, mode: 'practice'
          });
          if (!ok) addToReview(state, p.id, r.wrongAnswer);
        },
        onNext: next
      });
      fill(slot, current.el);
      if (cfg.clock === 'each') c?.start(seconds!);
      window.scrollTo(0, 0);
    }
    cleanup = () => {
      c?.stop();
      current?.destroy();
    };
    fill(root, h('div', { class: 'meet-bar' }, c ? c.el : h('span'), dots.el), slot);
    if (cfg.clock === 'total') c?.start(seconds!);
    next();
  }

  function finishLearn(results: boolean[], total: number, started: number) {
    cleanup();
    const right = results.filter(Boolean).length;
    fill(root,
      done(`${right} of ${total}`, [h('button', { class: 'btn primary', type: 'button', onclick: setup }, 'Again')]),
      list([{ label: 'Time', value: formatClock((Date.now() - started) / 1000) }]));
  }

  function finishTest(cfg: TestConfig, problems: Problem[], answers: string[][], started: number) {
    cleanup();
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
    state.meets.push({ date: Date.now(), grade, score, total: problems.length, seconds, config: cfg, topics: problems.map((p, i) => ({ topicId: p.topicId, correct: ok[i] })) });
    save(state);
    fill(root,
      done(`${score} of ${problems.length}`, [h('button', { class: 'btn primary', type: 'button', onclick: setup }, 'Again')]),
      list([{ label: 'Time', value: formatClock(seconds) }]),
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

  setup();
  return { title: 'Test', el: root, destroy: () => { cleanup(); stopSpeaking(); stopListening(); } };
}
