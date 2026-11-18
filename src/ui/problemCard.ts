import type { Problem } from '../core/types';
import { THINK_SECONDS, helpState, maxTriesFor } from '../core/thinkFirst';
import { ASK_CHANCE, reasonQuestion } from '../core/explainBack';
import { Coach } from '../core/coach';
import { Rng, randomSeed } from '../core/rng';
import { answerPlaceholder, formatAnswer, parseChoice, parseDigits } from '../core/answer';
import { load, save } from '../core/storage';
import { configureSpeech, stopSpeaking } from '../voice/speech';
import { COMMAND_HELP, listen, parseCommand, stopListening, sttSupported, type VoiceCommand } from '../voice/recognition';
import { h, iconButton, rich, svg } from './dom';
import { placementBoard } from './placementBoard';
import { choicePicker } from './choicePicker';
import { scenePlayer, type Player } from './player';
import { voiceControls } from './voiceControls';
import { sceneFor } from '../core/explain';
import { cheer } from './fx';

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
  /** The daily Big Puzzle: no try limit (core/thinkFirst.ts). */
  big?: boolean;
  /** "How did you know?" after some right first tries (core/explainBack.ts): puzzles of other families to borrow reasons from. */
  reasons?: { pool: () => Problem[]; onPick: (right: boolean) => void };
}

/**
 * One problem: question, answer field, check. Voice (read aloud, spoken answers and commands),
 * hints, mistake coaching and the step-by-step solution all live here.
 */
export function problemCard({ problem, onDone, onNext, big = false, reasons }: CardOptions): { el: HTMLElement; destroy: () => void; expire: () => void } {
  const state = load();
  const settings = state.settings;
  const coach = new Coach(problem, new Rng(randomSeed()), maxTriesFor(problem.answer, big));
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
  // Multiple choice is tap-to-answer: a tap checks right away.
  const picker = problem.answer.kind === 'choice' ? choicePicker(problem.answer, (l) => void submit([l])) : undefined;
  const current = () => (board ? board.value() : picker ? picker.value() : input.value);
  const check = h('button', { class: 'btn primary', type: 'button', onclick: () => submit([current()]) }, 'Check');
  const next = h('button', { class: 'btn primary wide', type: 'button', hidden: true, onclick: () => onNext() }, 'Next');
  const status = h('p', { class: 'status-line', 'aria-live': 'polite' });
  const feedback = h('p', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
  const hints = h('ul', { class: 'hints' });
  const why = h('div', { class: 'why' });
  const rng = new Rng(randomSeed());
  const solution = h('div', { class: 'solution' });
  const scene = sceneFor(problem);
  let player: Player | undefined;
  const mic = sttSupported() ? iconButton('mic', 'Answer by voice', () => (listening ? stopListening() : startListening()), 'mic') : null;
  const hintBtn = h('button', { class: 'btn plain', type: 'button', onclick: () => void showHint() }, 'Hint') as HTMLButtonElement;
  const answerBtn = h('button', { class: 'btn plain', type: 'button', onclick: () => void giveUp(false) }, 'Answer') as HTMLButtonElement;

  // Think first (core/thinkFirst.ts): Hint opens after a try or 30 seconds; Answer after 2 tries and every hint.
  const help = () => helpState({ tries: coach.tries, hintsUsed: coach.hintsUsed, hintCount: problem.hints.length, elapsedMs: Date.now() - startedAt, big });
  function showHelp() {
    const st = help();
    hintBtn.disabled = !st.hintOpen || coach.hintsUsed >= problem.hints.length;
    answerBtn.disabled = !st.answerOpen;
  }
  const hintTimer = setTimeout(showHelp, THINK_SECONDS * 1000 + 50);

  // Everything said about this question goes through Pause/Mute, so the child can always quiet it.
  const voice = voiceControls(() => problem.speech ?? problem.text);
  const say = (text: string) => (destroyed || voice.muted() ? Promise.resolve() : voice.talk(text));
  const sayAlways = (text: string) => (destroyed ? Promise.resolve() : voice.talk(text)); // explicit taps

  function setFeedback(kind: 'good' | 'bad' | 'info', text: string) {
    feedback.className = `feedback ${kind}`;
    feedback.textContent = text;
    if (kind !== 'info') cheer(el, kind === 'good');
  }

  async function showHint() {
    if (finished) return;
    if (!help().hintOpen) return setFeedback('info', 'Have a go first.');
    const hint = coach.nextHint();
    showHelp();
    if (!hint) return setFeedback('info', 'No more hints.');
    hints.append(h('li', {}, hint));
    // The picture's setup steps illustrate the hints (never the answer). It narrates them itself.
    if (!player) {
      player = scenePlayer(scene, { hintOnly: true });
      solution.replaceChildren(player.el);
    }
    if (!player.hintStep()) await say(hint);
  }

  /** The full animated, voiced explanation (Answer button, second miss, time up). */
  async function readSolution() {
    player?.destroy();
    player = scenePlayer(scene);
    solution.replaceChildren(player.el);
    player.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    await player.play();
  }

  function finish(partial: Omit<CardResult, 'hints' | 'seconds'>) {
    if (finished) return;
    finished = true;
    input.disabled = true;
    board?.disable();
    picker?.disable();
    if (picker && problem.answer.kind === 'choice') picker.mark(problem.answer.value, true);
    check.hidden = true;
    hintBtn.hidden = answerBtn.hidden = true;
    next.hidden = false;
    onDone({ ...partial, hints: coach.hintsUsed, seconds: Math.round((Date.now() - startedAt) / 1000) });
    next.focus({ preventScroll: true });
  }

  /** "How did you know?": three lines of thinking; one is how this puzzle is solved. Never blocks Next. */
  function askWhy() {
    const q = reasonQuestion(problem, reasons!.pool(), rng);
    if (!q) return;
    const out = h('p', { class: 'feedback', role: 'status' });
    const buttons = q.options.map((text, i) => h('button', { class: 'reason', type: 'button', onclick: () => {
      buttons.forEach((b, j) => { b.disabled = true; b.classList.toggle('right', j === q.right); b.classList.toggle('picked', j === i); });
      const right = i === q.right;
      out.className = `feedback ${right ? 'good' : 'info'}`;
      out.textContent = right ? 'Yes! That is the thinking.' : 'This one is how this puzzle works.';
      reasons!.onPick(right);
    } }, text) as HTMLButtonElement);
    why.replaceChildren(h('p', { class: 'why-q' }, 'How did you know?'), h('div', { class: 'reasons' }, ...buttons), out);
  }

  /** Answer button, or the skip/explain voice commands: only once the answer is open (think first). */
  async function giveUp(skipped: boolean) {
    if (finished) return;
    if (!help().answerOpen) return setFeedback('info', coach.tries < (big ? 3 : 2) ? 'Keep thinking. Try again.' : 'Try the hints first.');
    return reveal(skipped);
  }

  /** Show the answer and walk through it (after giving up, the last miss, or time up). */
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
      if (coach.firstTryCorrect && reasons && rng.next() < ASK_CHANCE) askWhy();
      await say(fb.message);
      if (settings.handsFree && !destroyed) setTimeout(() => !destroyed && onNext(), 600);
      return;
    }
    setFeedback(fb.verdict === 'unclear' ? 'info' : 'bad', fb.message);
    if (fb.verdict === 'wrong' && !fb.reveal) {
      hints.replaceChildren(...problem.hints.slice(0, coach.hintsUsed).map((x) => h('li', {}, x)));
      if (picker) picker.mark(picker.value(), false);
      else if (!board) input.select();
    }
    if (fb.reveal) {
      finish({ correct: false, firstTry: false, skipped: false, revealed: true, wrongAnswer: coach.wrongAnswers[0] });
      await say(fb.message);
      await readSolution();
      return afterReveal();
    }
    showHelp();
    await say(fb.message);
    if (settings.handsFree && !destroyed) startListening();
  }

  async function command(cmd: VoiceCommand) {
    switch (cmd) {
      case 'repeat': await sayAlways(problem.speech ?? problem.text); break;
      case 'hint': await showHint(); break;
      case 'explain': return giveUp(false);
      case 'skip': return giveUp(true);
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
    if (picker && problem.answer.kind === 'choice') {
      const opts = problem.answer.options;
      const l = alts.map((a) => parseChoice(a, opts)).find(Boolean);
      if (l) picker.select(l);
    }
    return submit(alts);
  }

  const el = h('article', { class: 'card problem', 'data-problem-id': problem.id },
    h('p', { class: 'question' }, rich(problem.text)),
    board ? board.el : problem.figure ? svg(problem.figure) : null,
    picker?.el,
    h('div', { class: 'answer-row' }, board || picker ? null : input, picker ? null : check, next),
    feedback,
    why,
    hints,
    solution,
    h('div', { class: 'tools' },
      voice.el,
      mic,
      status,
      hintBtn,
      answerBtn));

  showHelp();

  queueMicrotask(async () => {
    if (settings.speak || settings.handsFree) await sayAlways(problem.speech ?? problem.text);
    if (settings.handsFree && !destroyed) startListening();
    else if (!destroyed && !board && !picker && matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  });

  return {
    el,
    /** Time ran out: show the answer and solution; counts as missed. */
    expire: () => void reveal(false),
    destroy: () => {
      destroyed = true;
      clearTimeout(hintTimer);
      player?.destroy();
      stopSpeaking();
      stopListening();
    }
  };
}
