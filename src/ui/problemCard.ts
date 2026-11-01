import type { Problem } from '../core/types';
import { Coach } from '../core/coach';
import { Rng, randomSeed } from '../core/rng';
import { answerPlaceholder, formatAnswer } from '../core/answer';
import { load, save } from '../core/storage';
import { topicById } from '../content/topics';
import { configureSpeech, speak, stopSpeaking } from '../voice/speech';
import { COMMAND_HELP, listen, parseCommand, stopListening, sttSupported } from '../voice/recognition';
import { h, rich, svg } from './dom';

export interface CardResult {
  correct: boolean;
  firstTry: boolean;
  skipped: boolean;
  revealed: boolean;
  wrongAnswer?: string;
}

export interface CardOptions {
  problem: Problem;
  onDone: (r: CardResult) => void;
  onNext: () => void;
  /** Label for the button that appears when finished. */
  nextLabel?: string;
}

const LEVEL_LABEL = ['', 'Warm-up', 'Contest', 'Challenge'];

/** Interactive problem card with typing, voice answers, hints, mistake coaching and a step-by-step solution. */
export function problemCard(opts: CardOptions): { el: HTMLElement; destroy: () => void } {
  const { problem } = opts;
  const state = load();
  const settings = state.settings;
  const coach = new Coach(problem, new Rng(randomSeed()));
  const topic = topicById(problem.topicId)!;
  let finished = false;
  let destroyed = false;
  let listening = false;

  const input = h('input', {
    class: 'answer-input',
    type: 'text',
    inputmode: problem.answer.kind === 'number' ? 'numeric' : 'text',
    placeholder: answerPlaceholder(problem.answer),
    'aria-label': 'Your answer',
    autocomplete: 'off',
    onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && submit([input.value])
  });
  const heard = h('div', { class: 'heard', 'aria-live': 'polite' });
  const feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
  const solution = h('ol', { class: 'solution', hidden: true });
  const hintsBox = h('ul', { class: 'hints' });
  const micBtn = h('button', { class: 'mic', type: 'button', title: 'Answer by voice', 'aria-label': 'Answer by voice', onclick: () => (listening ? stopListening() : startListening()) }, '🎤');
  const checkBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => submit([input.value]) }, 'Check');
  const nextBtn = h('button', { class: 'btn primary big', type: 'button', hidden: true, onclick: () => opts.onNext() }, opts.nextLabel ?? 'Next problem →');

  const say = (text: string) => (destroyed ? Promise.resolve() : speak(text, { rate: settings.rate, voiceURI: settings.voiceURI }));

  function setFeedback(kind: 'good' | 'bad' | 'info', msg: string) {
    feedback.className = `feedback ${kind}`;
    feedback.textContent = msg;
  }

  function showHint() {
    const hint = coach.nextHint();
    if (!hint) {
      setFeedback('info', 'No more hints. Try "Show solution" if you are stuck.');
      return say('No more hints. You can ask me to explain.');
    }
    hintsBox.append(h('li', {}, '💡 ', hint));
    return say(hint);
  }

  async function revealSolution(readAloud = true) {
    if (!solution.hidden) return;
    solution.hidden = false;
    solution.replaceChildren(...problem.steps.map((s) => h('li', {}, s)));
    if (readAloud && settings.speakFeedback) {
      for (const [i, s] of problem.steps.entries()) {
        if (destroyed) return;
        solution.children[i]?.classList.add('reading');
        await say(s);
        solution.children[i]?.classList.remove('reading');
      }
    }
  }

  function finish(r: CardResult) {
    if (finished) return;
    finished = true;
    input.disabled = true;
    checkBtn.disabled = true;
    nextBtn.hidden = false;
    opts.onDone(r);
    nextBtn.focus({ preventScroll: true });
  }

  async function handleCommand(cmd: NonNullable<ReturnType<typeof parseCommand>>) {
    switch (cmd) {
      case 'repeat':
        await say(problem.speech ?? problem.text);
        break;
      case 'hint':
        await showHint();
        break;
      case 'explain':
      case 'skip':
        await skip(cmd === 'skip');
        return;
      case 'next':
        if (finished) return opts.onNext();
        await say('Answer this one first, or say skip.');
        break;
      case 'stop':
        settings.handsFree = false;
        save(state);
        updateHandsFree();
        await say('Okay, hands-free mode is off. Tap the microphone when you want to talk.');
        return;
      case 'help':
        await say(COMMAND_HELP);
        break;
      case 'slower':
      case 'faster':
        settings.rate = Math.min(1.4, Math.max(0.6, settings.rate + (cmd === 'slower' ? -0.15 : 0.15)));
        configureSpeech({ rate: settings.rate });
        save(state);
        await say(cmd === 'slower' ? 'Okay, I will talk slower.' : 'Okay, I will talk faster.');
        break;
    }
    if (settings.handsFree && !finished) startListening();
  }

  async function skip(isSkip: boolean) {
    setFeedback('info', `The answer is ${formatAnswer(problem.answer)}.`);
    finish({ correct: false, firstTry: false, skipped: isSkip, revealed: true });
    await say(isSkip ? `That's okay. The answer is ${formatAnswer(problem.answer)}. Here's how to solve it.` : `Let's solve it together.`);
    await revealSolution();
    afterReveal();
  }

  async function afterReveal() {
    if (destroyed) return;
    if (settings.handsFree) {
      await say('Say next when you are ready.');
      waitForNext();
    }
  }

  async function waitForNext() {
    for (let i = 0; i < 3 && !destroyed; i++) {
      const res = await listenOnce();
      if (!res) return;
      const cmd = parseCommand(res[0] ?? '');
      if (cmd === 'next' || cmd === 'skip') return opts.onNext();
      if (cmd === 'repeat') await revealSolutionAgain();
      if (cmd === 'stop') return handleCommand('stop');
    }
  }

  async function revealSolutionAgain() {
    for (const s of problem.steps) await say(s);
  }

  async function submit(alternatives: string[]) {
    if (finished) return;
    if (!alternatives.join('').trim()) {
      setFeedback('info', 'Type or say an answer first.');
      return;
    }
    stopSpeaking();
    const fb = coach.answer(alternatives);
    if (fb.heard && alternatives.length > 1) heard.textContent = `I heard: "${fb.heard}"`;
    if (fb.verdict === 'correct') {
      setFeedback('good', `✔ ${fb.message}`);
      finish({ correct: true, firstTry: coach.firstTryCorrect, skipped: false, revealed: false, wrongAnswer: coach.wrongAnswers[0] });
      if (settings.speakFeedback) await say(fb.message);
      if (settings.handsFree && !destroyed) {
        await new Promise((r) => setTimeout(r, 600));
        if (!destroyed) opts.onNext();
      }
      return;
    }
    setFeedback(fb.verdict === 'unclear' ? 'info' : 'bad', (fb.verdict === 'wrong' ? '✘ ' : '') + fb.message);
    if (fb.verdict === 'wrong' && !fb.reveal) {
      input.select();
      hintsBox.replaceChildren(...problem.hints.slice(0, coach.hintsUsed).map((x) => h('li', {}, '💡 ', x)));
    }
    if (fb.reveal) {
      finish({ correct: false, firstTry: false, skipped: false, revealed: true, wrongAnswer: coach.wrongAnswers[0] });
      if (settings.speakFeedback) await say(fb.message);
      await revealSolution();
      afterReveal();
      return;
    }
    if (settings.speakFeedback) await say(fb.message);
    if (settings.handsFree && !destroyed) startListening();
  }

  async function listenOnce(): Promise<string[] | null> {
    if (!sttSupported() || destroyed) return null;
    listening = true;
    micBtn.classList.add('on');
    heard.textContent = 'Listening…';
    const res = await listen((t) => (heard.textContent = `… ${t}`));
    listening = false;
    micBtn.classList.remove('on');
    if (destroyed) return null;
    if (res.error === 'not-allowed' || res.error === 'service-not-allowed') {
      heard.textContent = 'Microphone is blocked. Allow it in your browser settings, or type your answer.';
      settings.handsFree = false;
      updateHandsFree();
      return null;
    }
    if (!res.alternatives.length) {
      heard.textContent = res.error === 'network' ? 'Voice needs an internet connection in this browser. Please type.' : 'I did not hear anything.';
      return [];
    }
    heard.textContent = `I heard: "${res.alternatives[0]}"`;
    return res.alternatives;
  }

  async function startListening() {
    if (finished || destroyed) return;
    stopSpeaking();
    const alts = await listenOnce();
    if (alts === null) return;
    if (!alts.length) {
      if (settings.handsFree) {
        await say('Say your answer, or say repeat.');
        return startListening();
      }
      return;
    }
    const cmd = parseCommand(alts[0]);
    if (cmd) return handleCommand(cmd);
    input.value = alts[0];
    submit(alts);
  }

  const handsFreeToggle = h('input', {
    type: 'checkbox',
    checked: settings.handsFree,
    disabled: !sttSupported(),
    onchange: () => {
      settings.handsFree = handsFreeToggle.checked;
      save(state);
      if (settings.handsFree) startListening();
      else stopListening();
    }
  });
  function updateHandsFree() {
    handsFreeToggle.checked = settings.handsFree;
  }

  const el = h(
    'article',
    { class: 'card problem' },
    h('div', { class: 'chips' },
      h('span', { class: 'chip' }, topic.title),
      h('span', { class: `chip level-${problem.level}` }, LEVEL_LABEL[problem.level]),
      h('span', { class: 'chip ghost', title: 'Suggested strategy' }, '🧭 ', topic.strategy)
    ),
    h('p', { class: 'question' }, rich(problem.text)),
    problem.figure ? svg(problem.figure) : null,
    h('div', { class: 'answer-row' }, input, checkBtn, sttSupported() ? micBtn : null),
    heard,
    feedback,
    hintsBox,
    h('div', { class: 'tools' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => say(problem.speech ?? problem.text) }, '🔊 Read'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => !finished && showHint() }, '💡 Hint'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => (finished ? revealSolution() : skip(false)) }, '📖 Solution'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => (finished ? opts.onNext() : skip(true)) }, '⏭ Skip')
    ),
    solution,
    nextBtn,
    sttSupported()
      ? h('label', { class: 'handsfree' }, handsFreeToggle, ' Hands-free voice mode ', h('small', {}, '(I read the question, then listen for your answer)'))
      : h('p', { class: 'muted small' }, 'Voice answers are not available in this browser. Try Chrome, Edge or Safari. You can still type your answers and listen to the questions.')
  );

  // Kick off
  queueMicrotask(async () => {
    if (settings.autoRead || settings.handsFree) await say(problem.speech ?? problem.text);
    if (settings.handsFree && !destroyed) startListening();
    else if (!destroyed && matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  });

  return {
    el,
    destroy: () => {
      destroyed = true;
      stopSpeaking();
      stopListening();
    }
  };
}
