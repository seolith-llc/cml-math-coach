/**
 * Figures for the CogAT-style nonverbal and picture items. One geometry, two outputs:
 * SVG markup (question pictures and tap targets) and scene shapes (animated explanations).
 */
import { path, type Role, type Shape } from '../../core/scene';

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'pentagon' | 'hexagon' | 'arrow' | 'plus';
export type Fill = 'empty' | 'solid' | 'grey';
export type Size = 'S' | 'L';

export interface Fig {
  shape: ShapeKind;
  fill: Fill;
  size: Size;
  /** Degrees clockwise; only visible on shapes that point (arrow, triangle). */
  rot: number;
  count: 1 | 2 | 3;
}

export const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'pentagon', 'hexagon', 'arrow', 'plus'];
export const POINTY: ShapeKind[] = ['arrow', 'triangle'];
export const FILLS: Fill[] = ['empty', 'solid', 'grey'];

export const SHAPE_WORD: Record<ShapeKind, string> = {
  circle: 'circle', square: 'square', triangle: 'triangle', diamond: 'diamond', star: 'star', pentagon: 'pentagon', hexagon: 'hexagon', arrow: 'arrow', plus: 'plus sign'
};
export const FILL_WORD: Record<Fill, string> = { empty: 'white', solid: 'black', grey: 'grey' };
export const DIRECTION: Record<number, string> = { 0: 'up', 90: 'right', 180: 'down', 270: 'left' };

const r1 = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L')} Z`;
const regular = (n: number, r: number, start = -90) =>
  poly(Array.from({ length: n }, (_, i) => {
    const a = ((start + (i * 360) / n) * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  }));

/** Outline of one shape centred on (0, 0), pointing up. */
export function shapeD(kind: ShapeKind, r: number): string {
  switch (kind) {
    case 'circle': return `M${-r} 0 a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
    case 'square': { const s = r1(r * 0.82); return `M${-s} ${-s} H${s} V${s} H${-s} Z`; }
    case 'triangle': return poly([[0, -r], [r * 0.95, r * 0.7], [-r * 0.95, r * 0.7]]);
    case 'diamond': return poly([[0, -r], [r * 0.72, 0], [0, r], [-r * 0.72, 0]]);
    case 'star': return poly(Array.from({ length: 10 }, (_, i) => {
      const a = ((-90 + i * 36) * Math.PI) / 180, rr = i % 2 ? r * 0.45 : r;
      return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
    }));
    case 'pentagon': return regular(5, r);
    case 'hexagon': return regular(6, r, 0);
    case 'arrow': return poly([[0, -r], [r * 0.72, -r * 0.1], [r * 0.26, -r * 0.1], [r * 0.26, r], [-r * 0.26, r], [-r * 0.26, -r * 0.1], [-r * 0.72, -r * 0.1]]);
    case 'plus': { const t = r * 0.32; return poly([[-t, -r], [t, -r], [t, -t], [r, -t], [r, t], [t, t], [t, r], [-t, r], [-t, t], [-r, t], [-r, -t], [-t, -t]]); }
  }
}

interface Part { x: number; y: number; d: string; rot: number }

/** Where each copy of a figure goes inside a cell of the given size (centre-relative). */
function parts(f: Fig, cell: number): Part[] {
  const big = f.size === 'L' ? cell * 0.38 : cell * 0.22;
  const r = f.count === 1 ? big : f.count === 2 ? big * 0.56 : big * 0.5;
  const at: [number, number][] =
    f.count === 1 ? [[0, 0]] : f.count === 2 ? [[-cell * 0.21, 0], [cell * 0.21, 0]] : [[0, -cell * 0.19], [-cell * 0.21, cell * 0.17], [cell * 0.21, cell * 0.17]];
  return at.map(([x, y]) => ({ x, y, d: shapeD(f.shape, r), rot: f.rot }));
}

const svgFill = (f: Fill) => (f === 'empty' ? 'fill="none"' : f === 'solid' ? 'fill="currentColor"' : 'fill="currentColor" fill-opacity="0.4"');

export function svgBox(w: number, h: number, label: string, inner: string): string {
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}" class="figure" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" font-family="system-ui, sans-serif">${inner}</svg>`;
}

/** SVG markup for a figure drawn in a cell centred on (cx, cy). */
export function figMarkup(f: Fig, cx: number, cy: number, cell: number): string {
  return parts(f, cell).map((p) => `<path transform="translate(${r1(cx + p.x)} ${r1(cy + p.y)}) rotate(${p.rot})" d="${p.d}" ${svgFill(f.fill)}/>`).join('');
}

export const figSvg = (f: Fig, size = 72) => svgBox(size, size, describe(f), figMarkup(f, size / 2, size / 2, size));

/** Scene shapes for a figure; ids are `${id}-0`, `${id}-1`, … */
export function figShapes(f: Fig, id: string, cx: number, cy: number, cell: number, o: Partial<Shape> = {}): Shape[] {
  const role: Role = f.fill === 'empty' ? 'fill' : f.fill === 'solid' ? 'ink' : 'muted';
  return parts(f, cell).map((p, i) => path(`${id}-${i}`, cx + p.x, cy + p.y, p.d, { rot: p.rot, fill: role, stroke: 'ink', sw: 2.5, ...o }));
}

export function describe(f: Fig): string {
  const n = f.count === 1 ? 'a' : f.count === 2 ? 'two' : 'three';
  const size = f.size === 'L' ? 'big' : 'small';
  const pointing = POINTY.includes(f.shape) && f.rot ? ` pointing ${DIRECTION[f.rot]}` : '';
  return `${n} ${size} ${FILL_WORD[f.fill]} ${SHAPE_WORD[f.shape]}${f.count > 1 ? 's' : ''}${pointing}`;
}

export const sameFig = (a: Fig, b: Fig) =>
  a.shape === b.shape && a.fill === b.fill && a.size === b.size && a.count === b.count && (POINTY.includes(a.shape) ? a.rot % 360 === b.rot % 360 : true);

/* ---------------- dots (Grade 2 picture quantities) ---------------- */

/** Dots in rows of five, like a ten frame. */
export function dotsMarkup(n: number, x0: number, y0: number, gap = 14): string {
  return Array.from({ length: n }, (_, i) => `<circle cx="${x0 + (i % 5) * gap}" cy="${y0 + Math.floor(i / 5) * gap}" r="5" fill="currentColor" stroke="none"/>`).join('');
}
export const dotsSvg = (n: number) => svgBox(76, 76, `${n} dots`, dotsMarkup(n, 10, 38 - (Math.ceil(n / 5) - 1) * 7));

/* ---------------- abacus (Grade 2 number series) ---------------- */

const BEAD = 11;
/** One rod with `n` beads stacked from the bottom. */
export function rodMarkup(n: number, x: number, top: number, h: number): string {
  let s = `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + h}" stroke-width="2"/>`;
  for (let i = 0; i < n; i++) s += `<ellipse cx="${x}" cy="${top + h - 7 - i * (BEAD + 2)}" rx="14" ry="${BEAD / 2}" fill="currentColor" fill-opacity="0.8" stroke="none"/>`;
  return s;
}
export const rodSvg = (n: number) => svgBox(44, 130, `${n} beads`, rodMarkup(n, 22, 6, 118) + `<line x1="4" y1="124" x2="40" y2="124"/>`);

/* ---------------- paper folding ---------------- */

export type Fold = 'v' | 'h' | 'd';
export type Pt = [number, number];

/** Reflect a point (unit square) back across a fold line when the paper opens. */
export const unfold = (p: Pt, f: Fold): Pt => (f === 'v' ? [1 - p[0], p[1]] : f === 'h' ? [p[0], 1 - p[1]] : [p[1], p[0]]);

/** Every hole after opening all folds (last fold opens first). */
export function holesAfter(p: Pt, folds: Fold[]): Pt[] {
  let pts: Pt[] = [p];
  for (const f of [...folds].reverse()) pts = [...pts, ...pts.map((q) => unfold(q, f))];
  const key = (q: Pt) => `${q[0].toFixed(3)},${q[1].toFixed(3)}`;
  return [...new Map(pts.map((q) => [key(q), q])).values()];
}

/** The part of the square still showing after the folds (polygon in unit coords). */
export function foldedOutline(folds: Fold[]): Pt[] {
  let x0 = 0, y0 = 0;
  for (const f of folds) {
    if (f === 'v') x0 = 0.5;
    if (f === 'h') y0 = 0.5;
  }
  if (folds.includes('d')) return [[0, 0], [1, 1], [0, 1]];
  return [[x0, y0], [1, y0], [1, 1], [x0, 1]];
}

const scalePts = (pts: Pt[], x: number, y: number, s: number) => pts.map(([a, b]) => `${r1(x + a * s)},${r1(y + b * s)}`).join(' ');

export function paperMarkup(x: number, y: number, s: number, holes: Pt[]): string {
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="2"/>` + holes.map(([a, b]) => `<circle cx="${r1(x + a * s)}" cy="${r1(y + b * s)}" r="${r1(s * 0.07)}" fill="currentColor" stroke="none"/>`).join('');
}
export const paperSvg = (holes: Pt[]) => svgBox(72, 72, `paper with ${holes.length} hole${holes.length === 1 ? '' : 's'}`, paperMarkup(8, 8, 56, holes));

/** The question strip: the square, each fold, then the punched folded paper. */
export function foldStripSvg(folds: Fold[], hole: Pt): string {
  const s = 84, gap = 34, panels = folds.length + 1;
  let inner = '';
  for (let k = 0; k <= folds.length; k++) {
    const x = 10 + k * (s + gap), y = 12;
    const shown = foldedOutline(folds.slice(0, k));
    if (k > 0) inner += `<polygon points="${scalePts(foldedOutline([]), x, y, s)}" stroke-dasharray="3 4" stroke-width="1.5" opacity="0.45"/>`;
    inner += `<polygon points="${scalePts(shown, x, y, s)}"/>`;
    if (k < folds.length) {
      const f = folds[k];
      // only the part of the fold line that lies on the paper as it is now
      const xs = shown.map((p) => p[0]), ys = shown.map((p) => p[1]);
      const [lx, hx, ly, hy] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const line: [Pt, Pt] = f === 'v' ? [[0.5, ly], [0.5, hy]] : f === 'h' ? [[lx, 0.5], [hx, 0.5]] : [[0, 0], [1, 1]];
      const [a, b] = line.map(([p, q]) => [x + p * s, y + q * s]);
      inner += `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" stroke-dasharray="5 4" stroke-width="2"/>`;
      inner += `<path d="M${x + s + 6} ${y + s / 2} h${gap - 12}" stroke-width="2"/><path d="M${x + s + gap - 10} ${y + s / 2 - 5} l5 5 l-5 5" stroke-width="2"/>`;
    } else {
      inner += `<circle cx="${r1(x + hole[0] * s)}" cy="${r1(y + hole[1] * s)}" r="${r1(s * 0.07)}" fill="currentColor" stroke="none"/>`;
    }
  }
  return svgBox(10 + panels * (s + gap) - gap + 10, s + 24, `paper folded ${folds.length === 1 ? 'once' : 'twice'}, then a hole is punched`, inner);
}
