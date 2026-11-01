/**
 * Turns free text (typed or from speech recognition) into numbers.
 * Handles digits ("42", "31,400", "1.25"), words ("forty two", "one hundred and five"),
 * and ordinals ("second", "3rd").
 */
const SMALL: Record<string, number> = {
  zero: 0, oh: 0, o: 0, none: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // common speech-recognition homophones
  won: 1, to: 2, too: 2, for: 4, fore: 4, ate: 8
};

const ORDINAL: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30
};

/** Homophones only count as numbers when next to another number word, to avoid "how to" → 2. */
const WEAK = new Set(['won', 'to', 'too', 'for', 'fore', 'ate', 'o', 'oh', 'none']);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, '$1') // 31,400 -> 31400
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1') // 2nd -> 2
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9.:$¢'\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, '').replace(/\.$/, ''))
    .filter(Boolean);
}

function isNumberWord(t: string): boolean {
  return t in SMALL || t in ORDINAL || t === 'hundred' || t === 'thousand';
}

/** Extract every number mentioned, in order. */
export function parseNumbers(text: string): number[] {
  const tokens = tokenize(text);
  const out: number[] = [];
  let total = 0;
  let current = 0;
  let active = false;

  const flush = () => {
    if (active) out.push(total + current);
    total = 0;
    current = 0;
    active = false;
  };

  tokens.forEach((raw, i) => {
    const t = raw.replace(/^\$/, '').replace(/¢$/, '');
    if (/^\d+(\.\d+)?$/.test(t)) {
      flush();
      out.push(parseFloat(t));
      return;
    }
    if (WEAK.has(t)) {
      const prev = tokens[i - 1];
      const next = tokens[i + 1];
      const near = (x?: string) => !!x && (isNumberWord(x) || /^\d/.test(x)) && !WEAK.has(x);
      if (!near(prev) && !near(next)) {
        flush();
        return;
      }
    }
    const word = t in SMALL ? SMALL[t] : t in ORDINAL ? ORDINAL[t] : undefined;
    if (word !== undefined) {
      const r = current % 100;
      const canAdd =
        active && ((r === 0 && (current >= 100 || total > 0)) || (r >= 20 && r % 10 === 0 && word < 10));
      if (canAdd) current += word;
      else {
        flush();
        current = word;
        active = true;
      }
      if (t in ORDINAL) flush();
      return;
    }
    if (t === 'hundred') {
      current = (active ? current || 1 : 1) * 100;
      active = true;
      return;
    }
    if (t === 'thousand') {
      total += (active ? current || 1 : 1) * 1000;
      current = 0;
      active = true;
      return;
    }
    if (t === 'and' && active) return;
    if (t === 'a' && (tokens[i + 1] === 'hundred' || tokens[i + 1] === 'thousand')) {
      flush();
      return;
    }
    flush();
  });
  flush();
  return out;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 342 -> "three hundred forty-two" (used by tests and for clearer speech). */
export function numberToWords(n: number): string {
  if (n < 0) return 'minus ' + numberToWords(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberToWords(n % 100) : '');
  return numberToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
