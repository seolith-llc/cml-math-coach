import type { Scene, Shape } from '../core/scene';
import { load } from '../core/storage';
import { speak, stopSpeaking, voiceOptions } from '../voice/speech';
import { h, iconButton } from './dom';
import { icon } from './icons';

const NS = 'http://www.w3.org/2000/svg';

interface Live {
  g: SVGGElement;
  el: SVGElement;
  shape: Shape;
}

/** Draws one picture, animating from the previous one (moves, draw-in, fades) by shape id. */
function stage(scene: Scene) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${scene.w} ${scene.h}`);
  svg.setAttribute('class', 'stage');
  svg.setAttribute('role', 'img');
  const live = new Map<string, Live>();

  const paint = (el: SVGElement, s: Shape, prev?: Shape) => {
    const a = (k: string, v: unknown) => (v === undefined ? el.removeAttribute(k) : el.setAttribute(k, String(v)));
    switch (s.kind) {
      case 'rect': a('width', s.w); a('height', s.h); a('rx', s.rx ?? 0); break;
      case 'circle': a('r', s.r); break;
      case 'path': a('d', s.d); break;
      case 'line': a('x1', 0); a('y1', 0); a('x2', s.x2); a('y2', s.y2); break;
      case 'text':
        if (prev && prev.text !== s.text) {
          el.classList.remove('swap');
          void (el as SVGGraphicsElement).getBBox; // restart animation
          requestAnimationFrame(() => el.classList.add('swap'));
        }
        el.textContent = s.text ?? '';
        a('font-size', s.size ?? 18);
        a('font-weight', s.weight ?? 600);
        a('text-anchor', s.anchor ?? 'middle');
        a('dominant-baseline', 'central');
        break;
    }
    el.setAttribute('class', [`f-${s.fill ?? (s.kind === 'text' ? 'ink' : 'none')}`, `s-${s.stroke ?? 'none'}`, s.dash ? 'dash' : '', s.draw && !prev ? 'draw' : '', el.classList.contains('swap') ? 'swap' : ''].filter(Boolean).join(' '));
    if (s.sw !== undefined) a('stroke-width', s.sw);
    if (s.draw) el.setAttribute('pathLength', '1');
  };

  const place = (g: SVGGElement, s: Shape) => {
    g.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.rot ?? 0}deg)`;
    g.style.opacity = String(s.opacity ?? 1);
  };

  return {
    svg,
    show(shapes: Shape[], instant = false) {
      svg.classList.toggle('instant', instant);
      const next = new Set(shapes.map((s) => s.id));
      for (const [id, l] of live) {
        if (next.has(id)) continue;
        live.delete(id);
        if (instant) l.g.remove();
        else {
          l.g.classList.add('exit');
          setTimeout(() => l.g.remove(), 350);
        }
      }
      for (const s of shapes) {
        const old = live.get(s.id);
        if (old) {
          paint(old.el, s, old.shape);
          place(old.g, s);
          if (s.pulse) {
            old.g.classList.remove('pulse');
            requestAnimationFrame(() => old.g.classList.add('pulse'));
          }
          old.shape = s;
          continue;
        }
        const g = document.createElementNS(NS, 'g');
        const el = document.createElementNS(NS, s.kind) as SVGElement;
        g.append(el);
        paint(el, s);
        place(g, s);
        if (!instant) g.classList.add('enter');
        if (s.pulse) g.classList.add('pulse');
        svg.append(g);
        live.set(s.id, { g, el, shape: s });
      }
    }
  };
}

export interface Player {
  el: HTMLElement;
  /** Play from the start; resolves when it ends or is stopped. */
  play(): Promise<void>;
  /** Hint mode: allow (and play) one more of the steps before the answer. Returns false when none are left. */
  hintStep(): boolean;
  destroy(): void;
}

const SPEEDS = [1, 1.5, 0.75];

/**
 * Animated, voiced explanation with controls: replay, back, play/pause, next, speed, voice on/off.
 * In hint mode it only goes up to the steps that don't reveal the answer.
 */
export function scenePlayer(scene: Scene, opts: { hintOnly?: boolean } = {}): Player {
  const st = stage(scene);
  const steps = scene.steps;
  const firstReveal = Math.max(0, steps.findIndex((s) => s.reveal));
  const hintLimit = steps.some((s) => s.reveal) ? firstReveal : 0;
  let limit = opts.hintOnly ? 0 : steps.length; // number of steps allowed
  let i = -1;
  let playing = false;
  let run = 0;
  let speedIx = 0;
  let voice = load().settings.speak;

  const caption = h('p', { class: 'caption', 'aria-live': 'polite' });
  const counter = h('span', { class: 'counter', 'aria-live': 'off' });
  const playBtn = iconButton('play', 'Play', () => (playing ? pause() : resume()));
  const speedBtn = h('button', { class: 'btn plain speed', type: 'button', 'aria-label': 'Speed', onclick: () => {
    speedIx = (speedIx + 1) % SPEEDS.length;
    speedBtn.textContent = `${SPEEDS[speedIx]}×`;
    el.style.setProperty('--t', `${0.6 / SPEEDS[speedIx]}s`);
  } }, '1×');
  const voiceBtn = iconButton(voice ? 'speaker' : 'speakerOff', voice ? 'Voice on' : 'Voice off', () => {
    voice = !voice;
    voiceBtn.innerHTML = icon(voice ? 'speaker' : 'speakerOff');
    voiceBtn.setAttribute('aria-label', voice ? 'Voice on' : 'Voice off');
    if (!voice) stopSpeaking();
  });

  const draw = (k: number, instant = false) => {
    i = k;
    st.show(steps[k].shapes, instant);
    caption.textContent = steps[k].say;
    counter.textContent = `${k + 1} / ${limit}`;
    back.disabled = k <= 0;
    fwd.disabled = k >= limit - 1;
  };

  const wait = (ms: number, token: number) => new Promise<void>((r) => setTimeout(r, ms)).then(() => token === run);

  async function narrate(k: number, token: number) {
    const say = steps[k].say;
    if (voice) {
      const s = load().settings;
      await speak(say, voiceOptions(s.voice, s.rate * SPEEDS[speedIx]));
      return token === run && (await wait(350 / SPEEDS[speedIx], token));
    }
    return wait(Math.max(1600, say.length * 55) / SPEEDS[speedIx], token);
  }

  async function loop(from: number) {
    const token = ++run;
    playing = true;
    playBtn.innerHTML = icon('pause');
    playBtn.setAttribute('aria-label', 'Pause');
    for (let k = from; k < limit; k++) {
      draw(k);
      if (!(await narrate(k, token))) return;
    }
    if (token === run) setPaused();
  }

  function setPaused() {
    playing = false;
    playBtn.innerHTML = icon(i >= limit - 1 ? 'replay' : 'play');
    playBtn.setAttribute('aria-label', i >= limit - 1 ? 'Replay' : 'Play');
  }
  function pause() {
    run++;
    stopSpeaking();
    setPaused();
  }
  function resume() {
    void loop(i >= limit - 1 ? 0 : i + 1);
  }
  const step = (d: number) => {
    pause();
    const k = Math.min(limit - 1, Math.max(0, i + d));
    draw(k);
    if (voice) {
      const s = load().settings;
      void speak(steps[k].say, voiceOptions(s.voice, s.rate * SPEEDS[speedIx]));
    }
  };
  const back = iconButton('prev', 'Back', () => step(-1));
  const fwd = iconButton('next', 'Next', () => step(1));
  const restart = iconButton('replay', 'Replay', () => void loop(0));

  const el = h('div', { class: 'player', tabindex: '0', onkeydown: (e: KeyboardEvent) => {
    if (e.key === ' ') { e.preventDefault(); playing ? pause() : resume(); }
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  } },
    st.svg as unknown as Node,
    caption,
    h('div', { class: 'player-bar' }, restart, back, playBtn, fwd, counter, speedBtn, voiceBtn));

  // Ready on the first picture, paused (the card calls play() right away).
  if (!opts.hintOnly && steps.length) {
    draw(0, true);
    setPaused();
  }

  return {
    el,
    play() {
      limit = steps.length;
      return loop(0);
    },
    hintStep() {
      if (limit >= hintLimit) return false;
      limit++;
      void loop(limit - 1);
      return true;
    },
    destroy() {
      run++;
      stopSpeaking();
    }
  };
}
