/**
 * Text-to-speech wrapper around the Web Speech API (speechSynthesis).
 * - Splits long text into sentences (Chrome stops long utterances after ~15 s).
 * - Resolves when finished so the caller can chain "speak, then listen".
 */
export type VoiceEngine = 'premium' | 'device';

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voiceURI?: string;
  /** 'premium' = natural neural voice from /api/tts (needs internet); 'device' = the browser's built-in voice. */
  engine?: VoiceEngine;
  /** Aura speaker name for the premium engine. */
  premiumVoice?: string;
}

/** Turns the stored voice setting ("natural:luna" / "device:<uri>") into speak options. */
export function voiceOptions(voice: string, rate: number): SpeakOptions {
  const [kind, id = ''] = voice.split(/:(.*)/s);
  return kind === 'device' ? { rate, engine: 'device', voiceURI: id || undefined } : { rate, engine: 'premium', premiumVoice: id || 'luna' };
}

/** A short, kid-friendly selection of the Aura-2 voices (all 40 work). */
export const PREMIUM_VOICES = ['luna', 'thalia', 'asteria', 'athena', 'helena', 'aurora', 'iris', 'apollo', 'orion', 'arcas', 'hermes', 'atlas'];

export const ttsSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

let defaults: SpeakOptions = { rate: 0.95, pitch: 1.05, engine: 'premium', premiumVoice: 'luna' };
let token = 0;

export function configureSpeech(opts: SpeakOptions): void {
  defaults = { ...defaults, ...opts };
}

/** Higher = more natural. Downloaded Enhanced/Premium (Apple) and Natural/Neural (Microsoft) voices rank first. */
export function voiceQuality(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`;
  if (/premium/i.test(n)) return 5;
  if (/natural|neural/i.test(n)) return 4;
  if (/enhanced|siri/i.test(n)) return 3;
  if (/google/i.test(n)) return 2;
  if (/compact|eloquence|novelty|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy/i.test(n)) return 0;
  return 1;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => voiceQuality(b) - voiceQuality(a) || Number(b.lang === 'en-US') - Number(a.lang === 'en-US'));
}

/** Voices load asynchronously in some browsers. */
export function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const now = listVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(listVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

const PREFERRED = [/premium/i, /enhanced/i, /natural/i, /neural/i, /samantha/i, /google us english/i, /aria/i, /jenny/i, /karen/i, /daniel/i, /en-us/i];

function pickVoice(uri?: string): SpeechSynthesisVoice | undefined {
  const voices = listVoices();
  if (uri) {
    const v = voices.find((x) => x.voiceURI === uri);
    if (v) return v;
  }
  for (const re of PREFERRED) {
    const v = voices.find((x) => re.test(x.name) || re.test(x.lang));
    if (v) return v;
  }
  return voices[0];
}

/** Bigger pieces for the cloud voice (fewer requests, smoother flow), split at sentence ends. */
function cloudChunks(text: string, max = 280): string[] {
  const out: string[] = [];
  for (const sentence of chunks(text)) {
    const last = out[out.length - 1];
    if (last && last.length + sentence.length + 1 <= max) out[out.length - 1] = `${last} ${sentence}`;
    else out.push(sentence.slice(0, 590));
  }
  return out;
}

function chunks(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/)
    .flatMap((s) => (s.length > 220 ? s.split(/(?<=[,;:])\s+/) : [s]))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Make written maths sound natural. */
export function prepareForSpeech(text: string): string {
  return text
    .replace(/\$(\d+)\.(\d{2})/g, (_, d, c) => `${d} dollar${d === '1' ? '' : 's'} and ${+c} cent${c === '01' ? '' : 's'}`)
    .replace(/\$(\d+)/g, (_, d) => `${d} dollar${d === '1' ? '' : 's'}`)
    .replace(/(\d+)¢/g, '$1 cents')
    .replace(/(\d+)"/g, '$1 inches')
    .replace(/(\d+)°/g, '$1 degrees')
    .replace(/A\.M\./g, 'A M')
    .replace(/P\.M\./g, 'P M')
    .replace(/✔/g, '')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/−/g, ' minus ')
    .replace(/(\d) - (\d)/g, '$1 minus $2')
    .replace(/(\d)\s*\+\s*(\d)/g, '$1 plus $2')
    .replace(/\s\+\s/g, ' plus ')
    .replace(/=/g, ' equals ')
    .replace(/■/g, ' square ')
    .replace(/●/g, ' circle ')
    .replace(/▲/g, ' triangle ')
    .replace(/★/g, ' star ')
    .replace(/□/g, ' box ')
    .replace(/_{2,}/g, ' blank ')
    .replace(/\*\*/g, '')
    .replace(/…/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * iPad/iPhone Safari only allows speech after a user gesture. Speaking a silent utterance
 * on the first tap "unlocks" it, so later automatic read-aloud works.
 */
export function unlockSpeechOnFirstGesture(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    if (ttsSupported()) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
    // iOS also needs one gesture-initiated play() before audio elements may play on their own.
    const a = player();
    a.src = SILENT_WAV;
    a.play().catch(() => {});
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

export function stopSpeaking(): void {
  token++;
  if (ttsSupported()) speechSynthesis.cancel();
  if (audioEl) {
    audioEl.pause();
    audioEl.onended = audioEl.onerror = null;
  }
}

/* ---------------- premium (cloud) voice ---------------- */

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let audioEl: HTMLAudioElement | undefined;
const audioCache = new Map<string, Promise<string>>();
let premiumDownUntil = 0;

function player(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.setAttribute('playsinline', '');
  }
  return audioEl;
}

/** Fetch (and remember) one chunk of premium speech as an object URL. */
function fetchAudio(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return hit;
  const p = fetch(`./api/tts?v=${encodeURIComponent(voice)}&t=${encodeURIComponent(text)}`).then(async (r) => {
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('audio/')) throw new Error(`tts ${r.status}`);
    return URL.createObjectURL(await r.blob());
  });
  p.catch(() => audioCache.delete(key));
  audioCache.set(key, p);
  if (audioCache.size > 150) {
    const oldest = audioCache.keys().next().value as string;
    audioCache.get(oldest)?.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    audioCache.delete(oldest);
  }
  return p;
}

function playUrl(url: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const a = player();
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.src = url;
    a.playbackRate = rate;
    a.play().catch(() => resolve(false));
  });
}

export const premiumAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof Audio !== 'undefined' && navigator.onLine !== false && Date.now() > premiumDownUntil;

/** Speak with the premium voice; returns false if it could not start (caller falls back to the device voice). */
async function speakPremium(parts: string[], o: SpeakOptions, my: number): Promise<boolean> {
  const voice = o.premiumVoice ?? 'luna';
  const rate = o.rate ?? 1;
  const pending: (Promise<string> | undefined)[] = parts.map((t, i) => (i < 2 ? fetchAudio(t, voice) : undefined));
  for (let i = 0; i < parts.length; i++) {
    if (my !== token) return true;
    if (i + 2 < parts.length) pending[i + 2] = fetchAudio(parts[i + 2], voice);
    let url: string;
    try {
      url = await (pending[i] ?? fetchAudio(parts[i], voice));
    } catch {
      premiumDownUntil = Date.now() + 60_000; // back off: use the device voice for a minute
      if (i === 0) return false;
      await speakDevice(parts.slice(i), o, my);
      return true;
    }
    if (my !== token) return true;
    const ok = await playUrl(url, rate);
    if (!ok && i === 0) return false;
  }
  return true;
}

export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text) return;
  stopSpeaking();
  const my = token;
  const o = { ...defaults, ...opts };
  const prepared = prepareForSpeech(text);
  if (o.engine === 'premium' && premiumAvailable()) {
    if (await speakPremium(cloudChunks(prepared), o, my)) return;
    if (my !== token) return;
  }
  await speakDevice(chunks(prepared), o, my);
}

function speakDevice(parts: string[], o: SpeakOptions, my: number): Promise<void> {
  if (!ttsSupported()) return Promise.resolve();
  const voice = pickVoice(o.voiceURI);
  return new Promise((resolve) => {
    const next = (i: number) => {
      if (my !== token || i >= parts.length) return resolve();
      const u = new SpeechSynthesisUtterance(parts[i]);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = o.rate ?? 1;
      u.pitch = o.pitch ?? 1;
      // Safety net: some engines never fire onend.
      const guard = setTimeout(() => next(i + 1), 2000 + parts[i].length * 120);
      u.onend = u.onerror = () => {
        clearTimeout(guard);
        next(i + 1);
      };
      speechSynthesis.speak(u);
    };
    next(0);
  });
}
