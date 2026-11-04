import type { Problem } from '../core/types';
import { Coach } from '../core/coach';
import { Rng, randomSeed } from '../core/rng';
import { answerPlaceholder, formatAnswer, parseDigits } from '../core/answer';
import { load, save } from '../core/storage';
import { configureSpeech, speak, stopSpeaking } from '../voice/speech';
import { COMMAND_HELP, listen, parseCommand, stopListening, sttSupported, type VoiceCommand } from '../voice/recognition';
import { h, iconButton, rich, svg } from './dom';
import { placementBoard } from './placementBoard';

export interface CardResult {
  correct: boolean;
  firstTry: boolean;
  skipped: boolean;
  revealed: boolean;
  wrongAnswer?: string;
  hints: number;
  seconds: number;
}

export interface CardOptions {
  problem: Problem;
  onDone: (r: CardResult) => void;
  onNext: () => void;
}

/**
 * One problem: question, answer field, check. Voice (read aloud, spoken answers and commands),
 * hints, mistake coaching and the step-by-step solution all live here.
 */
export function problemCard({ problem, onDone, onNext }: CardOptions): { el: HTMLElement; destroy: () => void; expire: () => void } {
  const state = load();
  const settings = state.settings;
  const coach = new Coach(problem, new Rng(randomSeed()));
  const startedAt = Date.now();
  let finished = false;
  let destroyed = false;
  let listening = false;

  const board = problem.answer.kind === 'placement' && problem.figure ? placementBoard(problem.figure, problem.answer) : undefined;
  const input = h('input', {
    class: 'answer',
    type: 'text',
    inputmode: problem.answer.kind === 'number' ? 'numeric' : 'text',
    placeholder: answerPlaceholder(problem.answer),
    'aria-label': 'Answer',
    autocomplete: 'off',
    onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && submit([current()])
  });
  const current = () => (board ? board.value() : input.value);
  const check = h('button', { class: 'btn primary', type: 'button', onclick: () => submit([current()]) }, 'Check');
  const next = h('button', { class: 'btn primary wide', type: 'button', hidden: true, onclick: () => onNext() }, 'Next');
  const status = h('p', { class: 'status-line', 'aria-live': 'polite' });
  const feedback = h('p', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
  const hints = h('ul', { class: 'hints' });
  const solution = h('ol', { class: 'steps', hidden: true });
  const mic = sttSupported() ? iconButton('mic', 'Answer by voice', () => (listening ? stopListening() : startListening()), 'mic') : null;
  const hintBtn = h('button', { class: 'btn plain', type: 'button', onclick: () => void showHint() }, 'Hint');
  const answerBtn = h('button', { class: 'btn plain', type: 'button', onclick: () => void reveal(false) }, 'Answer');

  const say = (text: string) => (destroyed || !settings.speak ? Promise.resolve() : speak(text));
  const sayAlways = (text: string) => (destroyed ? Promise.resolve() : speak(text)); // explicit taps

  function setFeedback(kind: 'good' | 'bad' | 'info', text: string) {
    feedback.className = `feedback ${kind}`;
    feedback.textContent = text;
  }

  async function showHint() {
    if (finished) return;
    const hint = coach.nextHint();
    if (!hint) return setFeedback('info', 'No more hints.');
    hints.append(h('li', {}, hint));
    await say(hint);
  }

  async function readSolution() {
    solution.hidden = false;
    solution.replaceChildren(...problem.steps.map((s) => h('li', {}, s)));
    for (const [i, s] of problem.steps.entries()) {
      if (destroyed || !settings.speak) return;
      solution.children[i]?.classList.add('reading');
      await speak(s);
      solution.children[i]?.classList.remove('reading');
    }
  }

  function finish(partial: Omit<CardResult, 'hints' | 'seconds'>) {
    if (finished) return;
    finished = true;
    input.disabled = true;
    board?.disable();
    check.hidden = true;
    hintBtn.hidden = answerBtn.hidden = true;
    next.hidden = false;
    onDone({ ...partial, hints: coach.hintsUsed, seconds: Math.round((Date.now() - startedAt) / 1000) });
    next.focus({ preventScroll: true });
  }

  /** "Answer" button, or the skip/explain voice commands: show the answer and walk through it. */
  async function reveal(skipped: boolean) {
    if (finished) return;
    setFeedback('info', formatAnswer(problem.answer));
    finish({ correct: false, firstTry: false, skipped, revealed: true });
    await readSolution();
    afterReveal();
  }

  async function afterReveal() {
    if (destroyed || !settings.handsFree) return;
    await say('Say next when you are ready.');
    for (let i = 0; i < 3 && !destroyed; i++) {
      const alts = await listenOnce();
      if (!alts) return;
      const cmd = parseCommand(alts[0] ?? '');
      if (cmd === 'next' || cmd === 'skip') return onNext();
      if (cmd === 'repeat') for (const s of problem.steps) await say(s);
      if (cmd === 'stop') return command('stop');
    }
  }

  async function submit(alternatives: string[]) {
    if (finished) return;
    if (!alternatives.join('').trim()) return;
    stopSpeaking();
    const fb = coach.answer(alternatives);
    if (fb.verdict === 'correct') {
      setFeedback('good', fb.message);
      finish({ correct: true, firstTry: coach.firstTryCorrect, skipped: false, revealed: false, wrongAnswer: coach.wrongAnswers[0] });
      await say(fb.message);
      if (settings.handsFree && !destroyed) setTimeout(() => !destroyed && onNext(), 600);
      return;
    }
    setFeedback(fb.verdict === 'unclear' ? 'info' : 'bad', fb.message);
    if (fb.verdict === 'wrong' && !fb.reveal) {
      hints.replaceChildren(...problem.hints.slice(0, coach.hintsUsed).map((x) => h('li', {}, x)));
      if (!board) input.select();
    }
    if (fb.reveal) {
      finish({ correct: false, firstTry: false, skipped: false, revealed: true, wrongAnswer: coach.wrongAnswers[0] });
      await say(fb.message);
      await readSolution();
      return afterReveal();
    }
    await say(fb.message);
    if (settings.handsFree && !destroyed) startListening();
  }

  async function command(cmd: VoiceCommand) {
    switch (cmd) {
      case 'repeat': await sayAlways(problem.speech ?? problem.text); break;
      case 'hint': await showHint(); break;
      case 'explain': return reveal(false);
      case 'skip': return reveal(true);
      case 'next': if (finished) return onNext(); break;
      case 'stop':
        settings.handsFree = false;
        save(state);
        return sayAlways('Okay, I will stop listening.');
      case 'help': await sayAlways(COMMAND_HELP); break;
      case 'slower':
      case 'faster':
        settings.rate = Math.min(1.4, Math.max(0.6, settings.rate + (cmd === 'slower' ? -0.15 : 0.15)));
        configureSpeech({ rate: settings.rate });
        save(state);
        await sayAlways(cmd === 'slower' ? 'Okay, slower.' : 'Okay, faster.');
        break;
    }
    if (settings.handsFree && !finished) startListening();
  }

  async function listenOnce(): Promise<string[] | null> {
    if (!sttSupported() || destroyed) return null;
    listening = true;
    mic?.classList.add('on');
    status.textContent = '…';
    const res = await listen((t) => (status.textContent = t));
    listening = false;
    mic?.classList.remove('on');
    if (destroyed) return null;
    if (res.error === 'not-allowed' || res.error === 'service-not-allowed') {
      status.textContent = 'Microphone blocked';
      settings.handsFree = false;
      return null;
    }
    status.textContent = res.alternatives[0] ?? '';
    return res.alternatives;
  }

  async function startListening() {
    if (finished || destroyed) return;
    stopSpeaking();
    const alts = await listenOnce();
    if (!alts) return;
    if (!alts.length) {
      if (settings.handsFree) return startListening();
      return;
    }
    const cmd = parseCommand(alts[0]);
    if (cmd) return command(cmd);
    if (board) {
      const digits = alts.map((a) => parseDigits(a)).find(Boolean);
      if (!digits) return submit(alts);
      board.fill(digits);
      return submit([board.value()]);
    }
    input.value = alts[0];
    return submit(alts);
  }

  const el = h('article', { class: 'card problem' },
    h('p', { class: 'question' }, rich(problem.text)),
    board ? board.el : problem.figure ? svg(problem.figure) : null,
    h('div', { class: 'answer-row' }, board ? null : input, check, next),
    feedback,
    hints,
    solution,
    h('div', { class: 'tools' },
      iconButton('speaker', 'Read aloud', () => void sayAlways(problem.speech ?? problem.text)),
      mic,
      status,
      hintBtn,
      answerBtn));

  queueMicrotask(async () => {
    if (settings.speak || settings.handsFree) await sayAlways(problem.speech ?? problem.text);
    if (settings.handsFree && !destroyed) startListening();
    else if (!destroyed && !board && matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  });

  return {
    el,
    /** Time ran out: show the answer and solution; counts as missed. */
    expire: () => void reveal(false),
    destroy: () => {
      destroyed = true;
      stopSpeaking();
      stopListening();
    }
  };
}
