/**
 * Text-to-speech wrapper around the Web Speech API (speechSynthesis).
 * - Splits long text into sentences (Chrome stops long utterances after ~15 s).
 * - Resolves when finished so the caller can chain "speak, then listen".
 */
export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voiceURI?: string;
}

export const ttsSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

let defaults: SpeakOptions = { rate: 0.95, pitch: 1.05 };
let token = 0;

export function configureSpeech(opts: SpeakOptions): void {
  defaults = { ...defaults, ...opts };
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
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

const PREFERRED = [/natural/i, /samantha/i, /google us english/i, /aria/i, /jenny/i, /karen/i, /daniel/i, /en-us/i];

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
  if (!ttsSupported()) return;
  const unlock = () => {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** True for iPad/iPhone, including iPadOS which reports itself as a Mac. */
export const isAppleMobile = (): boolean =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  ((navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches);

export function stopSpeaking(): void {
  token++;
  if (ttsSupported()) speechSynthesis.cancel();
}

export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported() || !text) return Promise.resolve();
  stopSpeaking();
  const my = token;
  const o = { ...defaults, ...opts };
  const voice = pickVoice(o.voiceURI);
  const parts = chunks(prepareForSpeech(text));
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
