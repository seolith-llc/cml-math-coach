/**
 * Game-look stickers (docs/GAME-MODE.md, phase 4). Small surprises at the end of a round, never pay-per-answer
 * (expected rewards for a task lower interest), no currency, nothing to spend, at most 3 a day.
 * They name what the child did: fixed a miss, earned a star, reached today's goal, a careful round.
 * Pure: rules, the surprise order and 24 original SVG designs (simple shapes, drawn in-house).
 */

export type StickerKind = 'fixer' | 'star' | 'goal' | 'careful';

/** Why a sticker was earned, in the child's (and parent's) words. Effort and strategy, never ability. */
export const STICKER_LABELS: Record<StickerKind, string> = {
  fixer: 'Fixed a miss',
  star: 'New star',
  goal: "Today's goal",
  careful: 'Careful round'
};

export const DAILY_MAX = 3;
export const DESIGNS = 24;

export interface RoundFacts {
  /** Right on the first try. */
  right: number;
  /** Missed, then fixed. */
  fixed: number;
  total: number;
  /** Stars gained during the round (any topic). */
  starsGained: number;
  /** The daily goal was reached during the round. */
  goalReached: boolean;
  /** Stickers already earned today. */
  todayCount: number;
}

/** Which stickers a round earns, most effort-like first, within today's cap. */
export function roundStickers(f: RoundFacts): StickerKind[] {
  const kinds: StickerKind[] = [];
  if (f.fixed > 0) kinds.push('fixer');
  if (f.starsGained > 0) kinds.push('star');
  if (f.goalReached) kinds.push('goal');
  if (f.total >= 5 && f.right >= Math.ceil(f.total * 0.8)) kinds.push('careful');
  return kinds.slice(0, Math.max(0, DAILY_MAX - f.todayCount));
}

/** The surprise order of the 24 designs (fixed, so every child's book fills in a varied way). */
export const DESIGN_ORDER: number[] = (() => {
  const order = Array.from({ length: DESIGNS }, (_, i) => i);
  let s = 20261117;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
})();

/** The next design: a new one until all 24 are collected, then they come round again. */
export function nextDesign(collected: number[]): number {
  return DESIGN_ORDER.find((d) => !collected.includes(d)) ?? DESIGN_ORDER[collected.length % DESIGNS];
}

/* ---------------- 24 designs: 8 shapes × 3 colourways, each a die-cut sticker with a little face ---------------- */

const SHAPES = ['star', 'heart', 'planet', 'cloud', 'flower', 'moon', 'gem', 'drop'] as const;
const PALETTES = [
  ['#ffb703', '#fb8500'], ['#ff6b9a', '#c2368f'], ['#7b5cff', '#3a86ff'],
  ['#8ac926', '#2a9d8f'], ['#2ec4b6', '#3a86ff'], ['#ff8a3d', '#e63946']
];

function shapePath(shape: (typeof SHAPES)[number]): string {
  switch (shape) {
    case 'star': return 'M50 8 L61 36 L91 37 L67 56 L76 86 L50 69 L24 86 L33 56 L9 37 L39 36 Z';
    case 'heart': return 'M50 86 C18 64 8 46 14 30 C20 14 42 12 50 28 C58 12 80 14 86 30 C92 46 82 64 50 86 Z';
    case 'planet': return 'M50 20 A30 30 0 1 1 49.9 20 Z';
    case 'cloud': return 'M24 72 A16 16 0 0 1 22 40 A20 20 0 0 1 58 28 A18 18 0 0 1 84 46 A14 14 0 0 1 80 72 Z';
    case 'flower': return 'M50 14 A14 14 0 0 1 64 34 A14 14 0 0 1 84 48 A14 14 0 0 1 64 64 A14 14 0 0 1 50 84 A14 14 0 0 1 36 64 A14 14 0 0 1 16 48 A14 14 0 0 1 36 34 A14 14 0 0 1 50 14 Z';
    case 'moon': return 'M62 12 A38 38 0 1 0 88 66 A30 30 0 1 1 62 12 Z';
    case 'gem': return 'M30 18 L70 18 L88 40 L50 88 L12 40 Z';
    case 'drop': return 'M50 10 C66 34 80 50 80 64 A30 30 0 0 1 20 64 C20 50 34 34 50 10 Z';
  }
}

/** A sticker as SVG markup (100×100): white die-cut edge, colour fill, a little smiling face. */
export function stickerSvg(design: number): string {
  const d = ((design % DESIGNS) + DESIGNS) % DESIGNS;
  const shape = SHAPES[d % SHAPES.length];
  const [a, b] = PALETTES[Math.floor(d / SHAPES.length) * 2 % PALETTES.length + (d % 2)];
  const id = `st${d}`;
  const path = shapePath(shape);
  const ring = shape === 'planet' ? `<ellipse cx="50" cy="52" rx="44" ry="11" fill="none" stroke="${b}" stroke-width="5" transform="rotate(-18 50 52)"/>` : '';
  const ink = '#2b2140';
  return `<svg class="sticker-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<path d="${path}" fill="#fff" stroke="#fff" stroke-width="10" stroke-linejoin="round" filter="drop-shadow(0 2px 2px rgb(0 0 0 / .25))"/>` +
    `<path d="${path}" fill="url(#${id})"/>` + ring +
    `<circle cx="42" cy="50" r="3.5" fill="${ink}"/><circle cx="58" cy="50" r="3.5" fill="${ink}"/>` +
    `<path d="M43 58 Q50 65 57 58" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<circle cx="36" cy="57" r="3.5" fill="#fff" opacity=".45"/><circle cx="64" cy="57" r="3.5" fill="#fff" opacity=".45"/>` +
    `</svg>`;
}
