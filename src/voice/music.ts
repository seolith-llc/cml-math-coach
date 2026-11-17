/**
 * Game-look sound (docs/GAME-MODE.md, phase 3): the child's chosen tune and short sound effects, with Web Audio.
 * - Only in the game look. Off when the child picks Off; effects have their own switch.
 * - Ducks to near silence while the coach talks or the mic listens (voice/activity.ts), quiet on questions,
 *   silent in Tests and the parent area (core/tunes.ts musicLevel / sceneForRoute).
 * - Starts on the first tap (browsers need one), suspends when the app is in the background.
 */
import { load } from '../core/storage';
import { barEvents, beatSeconds, midiToHz, musicLevel, type MusicScene, type NoteEvent, type Tune } from '../core/tunes';
import { voiceBusy } from './activity';

let ctx: AudioContext | undefined;
let musicBus: GainNode | undefined;
let sfxBus: GainNode | undefined;
let wet: GainNode | undefined;
let scene: MusicScene = 'off';
let playingTune: Tune | undefined;
let bar = 0;
let nextBar = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let started = false;

const MUSIC_GAIN = 0.32; // everything stays soft; the child's volume scales this
const SFX_GAIN = 0.5;

const settings = () => load().settings;
const gameOn = () => settings().look === 'game';

function audio(): AudioContext | undefined {
  if (ctx) return ctx;
  const C = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return undefined;
  ctx = new C();
  const out = ctx.createDynamicsCompressor();
  out.connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(out);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = SFX_GAIN;
  sfxBus.connect(out);
  // a little space: a soft feedback echo through a low-pass filter
  wet = ctx.createGain();
  wet.gain.value = 0.28;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.34;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  wet.connect(delay);
  delay.connect(lp);
  lp.connect(fb);
  fb.connect(delay);
  lp.connect(musicBus);
  return ctx;
}

/** One note through a voice: a gentle envelope, no sharp attacks. */
function play(e: NoteEvent, at: number, spb: number, bus: AudioNode, sendWet = true) {
  const c = ctx!;
  const dur = e.beats * spb;
  const f = midiToHz(e.midi);
  const g = c.createGain();
  g.connect(bus);
  if (sendWet && wet) g.connect(wet);
  const v = e.vel;
  const osc = (type: OscillatorType, freq: number, gain = 1) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (gain === 1) o.connect(g);
    else {
      const h = c.createGain();
      h.gain.value = gain;
      o.connect(h);
      h.connect(g);
    }
    o.start(at);
    o.stop(at + dur + 1.2);
  };
  g.gain.setValueAtTime(0.0001, at);
  switch (e.voice) {
    case 'pad': {
      g.gain.linearRampToValueAtTime(v * 0.5, at + Math.min(0.8, dur / 2));
      g.gain.setTargetAtTime(0.0001, at + dur - 0.2, 0.5);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      g.disconnect();
      g.connect(lp);
      lp.connect(bus);
      if (wet) lp.connect(wet);
      osc('triangle', f);
      osc('sine', f * 1.003, 0.6);
      break;
    }
    case 'bass':
      g.gain.linearRampToValueAtTime(v * 0.8, at + 0.04);
      g.gain.setTargetAtTime(0.0001, at + 0.1, dur / 3);
      osc('sine', f);
      break;
    case 'pluck':
      g.gain.linearRampToValueAtTime(v, at + 0.01);
      g.gain.setTargetAtTime(0.0001, at + 0.02, 0.18);
      osc('sine', f);
      osc('sine', f * 4, 0.12);
      break;
    case 'bell':
      g.gain.linearRampToValueAtTime(v, at + 0.005);
      g.gain.setTargetAtTime(0.0001, at + 0.01, 0.35);
      osc('sine', f);
      osc('sine', f * 3, 0.18);
      break;
  }
}

function schedule() {
  if (!ctx || !playingTune) return;
  const spb = beatSeconds(playingTune);
  while (nextBar < ctx.currentTime + 0.6) {
    for (const e of barEvents(playingTune, bar)) play(e, nextBar + e.beat * spb, spb, musicBus!);
    nextBar += 4 * spb;
    bar++;
  }
}

/** Bring the music to where it should be now: which tune, how loud (with ducking), or stopped. */
export function refreshSound(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cml:music')); // the top-bar button follows
  const c = ctx;
  if (!c || !musicBus) return;
  const s = settings();
  // nothing is generated where it would be silent anyway (Tests, the parent area, Off, the classic look)
  const tune = gameOn() && s.music.tune !== 'off' && scene !== 'off' ? s.music.tune : undefined;
  const level = tune ? musicLevel(scene, voiceBusy()) * s.music.volume * MUSIC_GAIN : 0;
  musicBus.gain.setTargetAtTime(level, c.currentTime, voiceBusy() ? 0.08 : 0.4);
  if (tune !== playingTune) {
    playingTune = tune;
    if (tune) {
      bar = 0;
      nextBar = c.currentTime + 0.1;
    }
  }
  if (playingTune && !timer) timer = setInterval(schedule, 150);
  if (!playingTune && timer) {
    clearInterval(timer);
    timer = undefined;
  }
  if (playingTune) schedule();
}

/** The screen's music scene (the top-bar button hides where it is 'off'). */
export function musicScene(): MusicScene {
  return scene;
}

/** The screen changed (app.ts): map, question or silent. */
export function setMusicScene(next: MusicScene): void {
  scene = next;
  refreshSound();
}

export type Sfx = 'right' | 'miss' | 'star' | 'goal' | 'pop';
const SFX: Record<Sfx, { notes: number[]; step: number; voice: NoteEvent['voice']; vel: number }> = {
  right: { notes: [72, 76, 79], step: 0.07, voice: 'bell', vel: 0.55 },
  miss: { notes: [64, 60], step: 0.12, voice: 'pluck', vel: 0.35 }, // soft and low: never a buzzer
  star: { notes: [72, 76, 79, 84, 88], step: 0.07, voice: 'bell', vel: 0.5 },
  goal: { notes: [67, 72, 76, 79, 84], step: 0.11, voice: 'bell', vel: 0.55 },
  pop: { notes: [79], step: 0, voice: 'pluck', vel: 0.45 }
};

/** A short sound effect (game look, effects on, after the first tap). */
export function sfx(name: Sfx): void {
  if (!gameOn() || !settings().sfx) return;
  const c = audio();
  if (!c || c.state !== 'running' || !sfxBus) return;
  const s = SFX[name];
  s.notes.forEach((m, i) => play({ beat: 0, midi: m, beats: 0.6, voice: s.voice, vel: s.vel }, c.currentTime + 0.01 + i * s.step, 1, sfxBus!, false));
}

/** Call once at app start. Audio begins on the first tap; follows voice activity and app visibility. */
export function startSound(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // local checks only (Playwright on localhost): read the mixer's state; never on the real site
  if (location.hostname === 'localhost') (window as unknown as { __cmlSound: typeof soundState }).__cmlSound = soundState;
  const unlock = () => {
    if (!gameOn()) return; // nothing to unlock in the classic look; try again on a later tap
    const c = audio();
    if (!c) return;
    void c.resume().then(refreshSound);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('cml:voice', () => refreshSound());
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') void ctx.suspend();
    else void ctx.resume().then(refreshSound);
  });
}

/** For checks in local tests only: what the mixer is doing. */
export function soundState() {
  return { running: ctx?.state === 'running', tune: playingTune, scene, gain: musicBus?.gain.value ?? 0 };
}
