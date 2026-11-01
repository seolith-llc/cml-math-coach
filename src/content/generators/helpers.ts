import type { AnswerSpec, Misconception } from '../../core/types';
import type { Rng } from '../../core/rng';

export const num = (value: number, unit?: string): AnswerSpec => ({ kind: 'number', value, unit });
export const money = (cents: number): AnswerSpec => ({ kind: 'money', cents });
export const word = (value: string, options: string[]): AnswerSpec => ({ kind: 'word', value, options });
export const mis = (answer: AnswerSpec, feedback: string): Misconception => ({ answer, feedback });

/** Keep only misconceptions that differ from the right answer and from each other. */
export function misNum(correct: number, list: [number, string][]): Misconception[] {
  const seen = new Set<number>([correct]);
  const out: Misconception[] = [];
  for (const [v, f] of list) {
    if (!Number.isFinite(v) || v < 0 || seen.has(v)) continue;
    seen.add(v);
    out.push(mis(num(v), f));
  }
  return out;
}

export const NAMES = [
  'Ava', 'Ben', 'Carlos', 'Dina', 'Ethan', 'Fatima', 'Grace', 'Hiro', 'Isla', 'Jamal', 'Kiara', 'Leo',
  'Maya', 'Noah', 'Olivia', 'Priya', 'Quinn', 'Ravi', 'Sofia', 'Theo', 'Uma', 'Victor', 'Wendy', 'Zane'
];

export const SURNAMES = ['Adams', 'Brooks', 'Chen', 'Diaz', 'Evans', 'Foster', 'Garcia', 'Hill', 'Kim', 'Lopez', 'Moore', 'Patel'];

export function names(rng: Rng, n: number): string[] {
  return rng.sample(NAMES, n);
}

export const fmtN = (n: number) => n.toLocaleString('en-US');

export function cents(c: number): string {
  return c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`;
}

/** Retry a generator until `ok` holds; protects against unlucky random draws. */
export function until<T>(make: () => T, ok: (v: T) => boolean, tries = 500): T {
  for (let i = 0; i < tries; i++) {
    const v = make();
    if (ok(v)) return v;
  }
  throw new Error('generator could not satisfy constraints');
}

export function digitSum(n: number): number {
  return String(n).split('').reduce((s, d) => s + +d, 0);
}

export function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));
}

/* ---------------- SVG helpers ---------------- */

const svgOpen = (w: number, h: number, label: string) =>
  `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}" class="figure" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`;

/** Column arithmetic like
 *    2AA
 *  +  AA
 *  -----
 *    310
 */
export function columnFigure(top: string, bottom: string, op: '+' | '-', result: string): string {
  const width = Math.max(top.length, bottom.length + 2, result.length) * 22 + 30;
  const x = width - 12;
  const t = (y: number, s: string) =>
    `<text x="${x}" y="${y}" text-anchor="end" font-size="30" fill="currentColor" stroke="none" letter-spacing="6">${s}</text>`;
  const opX = x - bottom.length * 22 - 26;
  return (
    svgOpen(width, 140, `${top} ${op === '+' ? 'plus' : 'minus'} ${bottom} equals ${result}`) +
    t(34, top) +
    t(74, bottom) +
    `<text x="${opX}" y="74" font-size="30" fill="currentColor" stroke="none">${op === '-' ? '−' : '+'}</text>` +
    `<line x1="${opX - 4}" y1="88" x2="${x + 4}" y2="88"/>` +
    t(124, result) +
    '</svg>'
  );
}

/** Points on a line with labelled distances above (top) and below (bottom). */
export function segmentFigure(
  points: string[],
  positions: number[],
  top: { from: number; to: number; label: string }[],
  bottom: { from: number; to: number; label: string }[]
): string {
  const W = 420;
  const max = positions[positions.length - 1];
  const px = (p: number) => 20 + (p / max) * (W - 40);
  const brace = (b: { from: number; to: number; label: string }, y: number, dir: number) => {
    const x1 = px(positions[b.from]);
    const x2 = px(positions[b.to]);
    return `<path d="M${x1} ${y + 8 * dir} V${y} H${x2} V${y + 8 * dir}" stroke-width="1.5"/>` +
      `<text x="${(x1 + x2) / 2}" y="${y - 6 * -dir + (dir < 0 ? 18 : -6)}" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor" stroke="none">${b.label}</text>`;
  };
  let s = svgOpen(W, 150, 'points on a line');
  s += `<line x1="${px(0)}" y1="75" x2="${px(max)}" y2="75"/>`;
  points.forEach((p, i) => {
    const x = px(positions[i]);
    s += `<circle cx="${x}" cy="75" r="4" fill="currentColor"/>`;
    s += `<text x="${x}" y="${75 + (bottom.length ? -14 : 24)}" text-anchor="middle" font-size="16" fill="currentColor" stroke="none" font-weight="700">${p}</text>`;
  });
  top.forEach((b, i) => (s += brace(b, 30 - (i % 2) * 0, 1)));
  bottom.forEach((b) => (s += brace(b, 118, -1)));
  return s + '</svg>';
}

/** Triangle split by lines from the top corner into `sections` pieces, optional cross line. */
export function fanFigure(sections: number, crossLine: boolean): string {
  const apex = [150, 14];
  const y = 190;
  const xs = Array.from({ length: sections + 1 }, (_, i) => 20 + (i * 260) / sections);
  let s = svgOpen(300, 205, `a triangle cut into ${sections} sections`);
  s += `<polygon points="${apex.join(',')} ${xs[0]},${y} ${xs[sections]},${y}" stroke-linejoin="round"/>`;
  for (let i = 1; i < sections; i++) s += `<line x1="${apex[0]}" y1="${apex[1]}" x2="${xs[i]}" y2="${y}"/>`;
  if (crossLine) {
    const t = 0.55;
    const lx = apex[0] + (xs[0] - apex[0]) * t;
    const rx = apex[0] + (xs[sections] - apex[0]) * t;
    const ly = apex[1] + (y - apex[1]) * t;
    s += `<line x1="${lx}" y1="${ly}" x2="${rx}" y2="${ly}"/>`;
  }
  return s + '</svg>';
}

export function gridFigure(rows: number, cols: number): string {
  const cw = Math.min(60, 280 / cols);
  const ch = Math.min(50, 150 / rows);
  const W = cols * cw + 20;
  const H = rows * ch + 20;
  let s = svgOpen(W, H, `a ${rows} by ${cols} grid of rectangles`);
  s += `<rect x="10" y="10" width="${cols * cw}" height="${rows * ch}"/>`;
  for (let c = 1; c < cols; c++) s += `<line x1="${10 + c * cw}" y1="10" x2="${10 + c * cw}" y2="${10 + rows * ch}"/>`;
  for (let r = 1; r < rows; r++) s += `<line x1="10" y1="${10 + r * ch}" x2="${10 + cols * cw}" y2="${10 + r * ch}"/>`;
  return s + '</svg>';
}

/** Three-circle Venn diagram. regions: [onlyA, onlyB, onlyC, AB, AC, BC, ABC]. */
export function vennFigure(labels: [string, string, string], r: number[]): string {
  const [a, b, c, ab, ac, bc, abc] = r;
  const t = (x: number, y: number, v: number | string, size = 17, weight = 600) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="currentColor" stroke="none">${v}</text>`;
  return (
    svgOpen(320, 290, 'three overlapping circles with numbers') +
    `<circle cx="115" cy="110" r="80"/><circle cx="205" cy="110" r="80"/><circle cx="160" cy="185" r="80"/>` +
    t(40, 26, labels[0], 18, 800) + t(280, 26, labels[1], 18, 800) + t(160, 284, labels[2], 18, 800) +
    t(85, 95, a) + t(235, 95, b) + t(160, 228, c) + t(160, 80, ab) + t(118, 165, ac) + t(202, 165, bc) + t(160, 136, abc) +
    '</svg>'
  );
}

export const SHAPES = {
  square: { glyph: '■', say: 'square' },
  circle: { glyph: '●', say: 'circle' },
  triangle: { glyph: '▲', say: 'triangle' },
  star: { glyph: '★', say: 'star' }
} as const;

/** Replace shape glyphs and the empty box with words for text-to-speech. */
export function speakable(text: string): string {
  return text
    .replace(/■/g, ' square ')
    .replace(/●/g, ' circle ')
    .replace(/▲/g, ' triangle ')
    .replace(/□/g, ' box ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/−/g, ' minus ')
    .replace(/ - /g, ' minus ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' equals ')
    .replace(/_{2,}/g, ' blank ')
    .replace(/¢/g, ' cents')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
