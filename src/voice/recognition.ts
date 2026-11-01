/**
 * Speech-to-text wrapper (Web Speech API SpeechRecognition).
 * Returns several alternatives so the answer checker can accept the answer if ANY
 * hypothesis is correct, which helps a lot with children's voices and homophones ("for" vs "four").
 */

type Ctor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function ctor(): Ctor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const sttSupported = (): boolean => !!ctor();

export interface ListenResult {
  alternatives: string[];
  error?: string;
}

let active: SpeechRecognitionLike | null = null;

export function stopListening(): void {
  active?.abort();
  active = null;
}

export function listen(onInterim?: (text: string) => void, timeoutMs = 9000): Promise<ListenResult> {
  const C = ctor();
  if (!C) return Promise.resolve({ alternatives: [], error: 'unsupported' });
  stopListening();
  const rec = new C();
  active = rec;
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  return new Promise((resolve) => {
    let finalAlts: string[] = [];
    let error: string | undefined;
    const timer = setTimeout(() => rec.stop(), timeoutMs);
    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      const alts = Array.from({ length: res.length }, (_, i) => res[i].transcript.trim());
      if (res.isFinal) finalAlts = alts;
      else onInterim?.(alts[0] ?? '');
    };
    rec.onerror = (e) => (error = e.error);
    rec.onend = () => {
      clearTimeout(timer);
      if (active === rec) active = null;
      resolve({ alternatives: finalAlts.filter(Boolean), error: finalAlts.length ? undefined : error ?? 'no-speech' });
    };
    try {
      rec.start();
    } catch {
      clearTimeout(timer);
      resolve({ alternatives: [], error: 'start-failed' });
    }
  });
}

export type VoiceCommand = 'repeat' | 'hint' | 'skip' | 'explain' | 'next' | 'stop' | 'help' | 'slower' | 'faster';

const COMMANDS: [VoiceCommand, RegExp][] = [
  ['repeat', /^(repeat|say (it|that) again|again|read (it|again)|what\??|pardon|come again)$/],
  ['hint', /^(hint|help me|give me a hint|clue|i need (a )?hint|another hint)$/],
  ['skip', /^(skip|pass|skip (it|this)|i don'?t know|no idea)$/],
  ['explain', /^(explain|show me|show (me )?(the )?(answer|solution)|how( do i| to)? (do|solve) (it|this)|tell me|solution)$/],
  ['next', /^(next|next (one|question)|continue|go on|ok next|okay next|ready)$/],
  ['stop', /^(stop|quit|pause|stop listening|i'?m done|that'?s enough)$/],
  ['help', /^(what can i say|commands|help)$/],
  ['slower', /^(slower|slow down|talk slower)$/],
  ['faster', /^(faster|speed up|talk faster)$/]
];

export function parseCommand(text: string): VoiceCommand | undefined {
  const t = text.toLowerCase().replace(/[.,!?]/g, '').replace(/^(please|um|uh|okay|ok)\s+/, '').replace(/\s+please$/, '').trim();
  for (const [cmd, re] of COMMANDS) if (re.test(t)) return cmd;
  return undefined;
}

export const COMMAND_HELP =
  'You can say your answer, or say: repeat, hint, explain, skip, next, slower, faster, or stop.';
