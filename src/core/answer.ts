import type { AnswerSpec, Problem } from './types';
import { parseNumbers, tokenize } from './numberWords';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FILLER = [
  /\b(i think|i guess|maybe|um+|uh+|hmm+|well|okay|ok|so)\b/g,
  /\b(my|the|final) answer is\b/g,
  /\b(it is|it's|its|is it|that's|that is|the answer)\b/g
];

export function cleanSpoken(input: string): string {
  let s = ` ${input.toLowerCase()} `;
  for (const re of FILLER) s = s.replace(re, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export interface CheckResult {
  correct: boolean;
  /** False when we could not find anything that looks like an answer. */
  understood: boolean;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/** Possible cent values the learner may mean. "1.25" -> 125, "$2" -> 200, "23 cents" -> 23. */
export function parseMoney(input: string): number[] {
  const s = input.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1');
  const nums = parseNumbers(s);
  if (!nums.length) return [];
  const hasDollar = /\$|dollar|buck/.test(s);
  const hasCent = /¢|cent|penn/.test(s);
  if (hasDollar && hasCent && nums.length >= 2) return [Math.round(nums[0] * 100 + nums[1])];
  if (hasDollar) {
    // "$1.25" or "1 dollar 25" or "one twenty five dollars"
    if (nums.length >= 2 && Number.isInteger(nums[0]) && nums[1] < 100) return [nums[0] * 100 + nums[1]];
    return [Math.round(nums[0] * 100)];
  }
  if (hasCent) return [Math.round(nums[0])];
  if (!Number.isInteger(nums[0])) return [Math.round(nums[0] * 100)];
  // bare integer: could be cents or whole dollars
  return [nums[0], nums[0] * 100];
}

/** Returns minutes after midnight candidates plus whether AM/PM was stated. */
export function parseTime(input: string): { minutes: number[]; meridiem?: 'am' | 'pm' } {
  const s = input.toLowerCase();
  const meridiem = /\bp\.?\s?m\b|afternoon|evening|night/.test(s)
    ? 'pm'
    : /\ba\.?\s?m\b|morning/.test(s)
      ? 'am'
      : undefined;
  let h: number | undefined;
  let m = 0;
  const colon = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (colon) {
    h = +colon[1];
    m = +colon[2];
  } else {
    const compact = s.match(/\b(\d{1,2})(\d{2})\b/);
    const nums = parseNumbers(s.replace(/o'?clock/g, ' '));
    if (compact && +compact[2] < 60) {
      h = +compact[1];
      m = +compact[2];
    } else if (nums.length >= 3 && nums[1] === 0) {
      h = nums[0];
      m = nums[2];
    } else if (nums.length >= 2) {
      h = nums[0];
      m = nums[1];
    } else if (nums.length === 1) {
      h = nums[0];
    }
  }
  if (h === undefined || h > 24 || m > 59) return { minutes: [] };
  const base = (h % 12) * 60 + m;
  if (meridiem === 'pm') return { minutes: [base + 720], meridiem };
  if (meridiem === 'am') return { minutes: [base], meridiem };
  return { minutes: [base, base + 720] };
}

const LETTER_SOUNDS: Record<string, string> = {
  a: 'a', ay: 'a', eh: 'a', b: 'b', be: 'b', bee: 'b', c: 'c', see: 'c', sea: 'c', d: 'd', dee: 'd',
  e: 'e', ee: 'e'
};

function parseChoice(input: string, options: string[]): string | undefined {
  const tokens = tokenize(input);
  const letters = options.map((_, i) => String.fromCharCode(97 + i));
  const flagged = tokens.findIndex((t) => ['letter', 'choice', 'option', 'answer'].includes(t));
  if (flagged >= 0 && tokens[flagged + 1] && LETTER_SOUNDS[tokens[flagged + 1]]) {
    return LETTER_SOUNDS[tokens[flagged + 1]];
  }
  if (tokens.length <= 2) {
    for (const t of tokens) {
      const l = LETTER_SOUNDS[t.replace(/\)$/, '')];
      if (l && letters.includes(l)) return l;
    }
  }
  // Learner said the option itself
  const norm = (x: string) => tokenize(x).join(' ');
  const said = norm(input);
  const idx = options.findIndex((o) => norm(o) === said);
  return idx >= 0 ? letters[idx] : undefined;
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Finds which option word the learner said (tolerates small speech-recognition slips). */
export function findWord(input: string, options: string[]): string | undefined {
  const tokens = tokenize(input);
  const phrase = tokens.join(' ');
  // exact multi-word match first ("Garden Club")
  for (const o of options) if (phrase.includes(o.toLowerCase())) return o;
  for (const o of options) {
    const key = tokenize(o).filter((w) => !['mrs', 'mr', 'ms', 'the', 'club'].includes(w))[0] ?? o.toLowerCase();
    if (tokens.some((t) => t === key || (key.length > 4 && editDistance(t, key) <= 1))) return o;
  }
  return undefined;
}

export function checkAnswer(spec: AnswerSpec, rawInput: string): CheckResult {
  const input = cleanSpoken(rawInput);
  if (!input) return { correct: false, understood: false };
  switch (spec.kind) {
    case 'number': {
      const nums = parseNumbers(input);
      if (!nums.length) return { correct: false, understood: false };
      return { correct: near(nums[0], spec.value), understood: true };
    }
    case 'money': {
      const c = parseMoney(input);
      if (!c.length) return { correct: false, understood: false };
      return { correct: c.some((v) => near(v, spec.cents)), understood: true };
    }
    case 'time': {
      const t = parseTime(input);
      if (!t.minutes.length) return { correct: false, understood: false };
      const ok = t.minutes.some((v) => v === spec.minutes);
      const sameClock = t.minutes.some((v) => v % 720 === spec.minutes % 720);
      return { correct: spec.ampm ? ok : sameClock, understood: true };
    }
    case 'day': {
      const d = findWord(input, DAYS);
      if (!d) return { correct: false, understood: false };
      return { correct: d === spec.value, understood: true };
    }
    case 'choice': {
      const c = parseChoice(input, spec.options);
      if (!c) return { correct: false, understood: false };
      return { correct: c === spec.value, understood: true };
    }
    case 'word': {
      const w = findWord(input, spec.options);
      if (!w) return { correct: false, understood: false };
      return { correct: w === spec.value, understood: true };
    }
    case 'set': {
      const nums = parseNumbers(input);
      if (!nums.length) return { correct: false, understood: false };
      const want = [...spec.values].sort((a, b) => a - b);
      const got = [...nums].sort((a, b) => a - b);
      return { correct: want.length === got.length && want.every((v, i) => near(v, got[i])), understood: true };
    }
  }
}

/** Returns the coaching message for a recognised wrong answer, if any. */
export function diagnose(problem: Problem, rawInput: string): string | undefined {
  for (const m of problem.misconceptions ?? []) {
    if (checkAnswer(m.answer, rawInput).correct) return m.feedback;
  }
  return undefined;
}

export function formatMoney(cents: number): string {
  return cents < 100 ? `${cents}¢` : `$${(cents / 100).toFixed(2)}`;
}

export function formatTime(minutes: number, ampm = true): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${ampm ? (h24 < 12 ? ' A.M.' : ' P.M.') : ''}`;
}

export function formatAnswer(spec: AnswerSpec): string {
  switch (spec.kind) {
    case 'number':
      return spec.value.toLocaleString('en-US') + (spec.unit ? ` ${spec.unit}` : '');
    case 'money':
      return formatMoney(spec.cents);
    case 'time':
      return formatTime(spec.minutes, spec.ampm !== false);
    case 'day':
    case 'word':
      return spec.value;
    case 'choice':
      return `(${spec.value}) ${spec.options[spec.value.charCodeAt(0) - 97]}`;
    case 'set':
      return spec.values.join(' and ');
  }
}

/** What the input box should hint at. */
export function answerPlaceholder(spec: AnswerSpec): string {
  switch (spec.kind) {
    case 'money':
      return 'e.g. 45¢ or $1.25';
    case 'time':
      return 'e.g. 4:05 P.M.';
    case 'day':
      return 'a day of the week';
    case 'choice':
      return 'a, b, c, d…';
    case 'word':
      return spec.options.join(' / ');
    case 'set':
      return 'e.g. 3 and 8';
    default:
      return 'your answer';
  }
}
