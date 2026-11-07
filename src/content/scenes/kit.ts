/**
 * Drawing kit for explanation scenes: number lines, bars, coins, clocks, calendars, people, grids.
 * Every helper adds shapes to a SceneBuilder with stable ids, so later steps can move or recolour them.
 */
import { SceneBuilder, arc, brace, circle, line, path, rect, text, type Role, type Shape } from '../../core/scene';

export { SceneBuilder, arc, brace, circle, line, path, rect, text };
export type { Role, Shape };

export const W = 360;
export const H = 220;
export const fmt = (n: number) => n.toLocaleString('en-US');
export const money = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`);

/* ---------------- number line ---------------- */

export interface NumberLine {
  pos: (v: number) => number;
  y: number;
}

/** Horizontal number line from min to max, with labelled ticks. */
export function numberLine(s: SceneBuilder, min: number, max: number, ticks: number[], y = 150, x0 = 26, x1 = W - 26): NumberLine {
  const pos = (v: number) => x0 + ((v - min) / (max - min || 1)) * (x1 - x0);
  s.add(line('nl', x0 - 8, y, x1 - x0 + 16, 0, { stroke: 'muted', sw: 2 }));
  for (const t of [...new Set(ticks)]) tick(s, pos, y, t);
  return { pos, y };
}

export function tick(s: SceneBuilder, pos: (v: number) => number, y: number, v: number, label: string | number = fmt(v), role: Role = 'muted') {
  s.add(line(`tk${v}`, pos(v), y - 6, 0, 12, { stroke: 'muted', sw: 1.5 }), text(`tl${v}`, pos(v), y + 22, label, { size: 15, fill: role, weight: 500 }));
}

/** A labelled dot on the line. */
export function marker(s: SceneBuilder, nl: NumberLine, id: string, v: number, role: Role = 'accent', label?: string) {
  s.add(circle(id, nl.pos(v), nl.y, 7, { fill: role, stroke: 'fill', sw: 2, pulse: true }));
  if (label !== undefined) s.add(text(`${id}-l`, nl.pos(v), nl.y + 22, label, { size: 15, fill: role, weight: 700 }));
}

/** A hop along the line with its size written above the arc. */
export function hop(s: SceneBuilder, nl: NumberLine, id: string, from: number, to: number, label: string, role: Role = 'accent') {
  const x1 = nl.pos(from), x2 = nl.pos(to);
  const lift = Math.min(60, Math.max(18, Math.abs(x2 - x1) * 0.45));
  s.add(arc(id, x1, x2, nl.y - 8, { stroke: role }), text(`${id}-l`, (x1 + x2) / 2, nl.y - 8 - lift - 12, label, { size: 16, fill: role, weight: 700 }));
}

/* ---------------- bars (tape diagrams) ---------------- */

export interface Bars {
  /** Pixel width for a value. */
  px: (v: number) => number;
  x0: number;
}

export function bars(max: number, x0 = 92, x1 = W - 40): Bars {
  return { px: (v: number) => (Math.max(0, v) / (max || 1)) * (x1 - x0), x0 };
}

/** One labelled bar segment. */
export function seg(s: SceneBuilder, id: string, b: Bars, from: number, len: number, y: number, role: Role = 's1', label?: string, h = 30) {
  s.add(rect(id, b.x0 + b.px(from), y, Math.max(2, b.px(len)), h, { fill: role, stroke: role === 's2' ? 's2' : role === 's1' ? 's1' : role, sw: 1.5, rx: 4 }));
  if (label !== undefined) s.add(text(`${id}-t`, b.x0 + b.px(from) + b.px(len) / 2, y + h / 2, label, { size: 15, weight: 700 }));
}

export function rowLabel(s: SceneBuilder, id: string, y: number, label: string, h = 30) {
  s.add(text(id, 8, y + h / 2, label, { anchor: 'start', size: 15, fill: 'muted', weight: 600 }));
}

/* ---------------- coins ---------------- */

const COIN: Record<number, { r: number; label: string; role: Role }> = {
  1: { r: 12, label: '1', role: 'warn' },
  5: { r: 14, label: '5', role: 'muted' },
  10: { r: 11, label: '10', role: 'muted' },
  25: { r: 16, label: '25', role: 'muted' },
  50: { r: 18, label: '50', role: 'muted' }
};

export function coin(s: SceneBuilder, id: string, x: number, y: number, value: number, o: Partial<Shape> = {}) {
  const c = COIN[value] ?? COIN[1];
  s.add(circle(id, x, y, c.r, { fill: 'fill', stroke: c.role === 'warn' ? 'warn' : 'muted', sw: 2.5, ...o }), text(`${id}-v`, x, y, c.label, { size: c.r > 13 ? 13 : 11, weight: 700, fill: c.role === 'warn' ? 'warn' : 'ink' }));
}

/* ---------------- clock ---------------- */

export function clockFace(s: SceneBuilder, cx: number, cy: number, r: number) {
  s.add(circle('cf', cx, cy, r, { fill: 'fill', stroke: 'ink', sw: 2.5 }));
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2;
    s.add(text(`cn${n}`, cx + Math.sin(a) * (r - 16), cy - Math.cos(a) * (r - 16), n, { size: 13, weight: 600, fill: 'muted' }));
  }
  s.add(circle('cc', cx, cy, 4, { fill: 'ink', stroke: 'none' }));
}

/** Hands for a time given in minutes after midnight. Rotation animates between steps. */
export function hands(s: SceneBuilder, cx: number, cy: number, r: number, minutes: number) {
  // Angles keep growing with time, so hands always turn forward (never spin back past 12).
  if (!s.has('hh')) s.add(line('hh', cx, cy, 0, -(r * 0.5), { stroke: 'ink', sw: 5 }), line('mh', cx, cy, 0, -(r * 0.78), { stroke: 'accent', sw: 3 }));
  s.set('hh', { rot: (minutes / 60) * 30 }).set('mh', { rot: minutes * 6 });
}

export const clockText = (minutes: number) => {
  const h24 = Math.floor(minutes / 60) % 24;
  return `${h24 % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h24 < 12 ? 'A.M.' : 'P.M.'}`;
};

/* ---------------- people & items ---------------- */

/** A little person (head + body) for family and logic puzzles. */
export function person(s: SceneBuilder, id: string, x: number, y: number, role: Role, label?: string) {
  s.add(circle(`${id}-h`, x, y, 9, { fill: role, stroke: 'none' }), path(`${id}-b`, x, y + 11, 'M-11 22 Q0 -6 11 22 Z', { fill: role, stroke: 'none' }));
  if (label) s.add(text(`${id}-n`, x, y + 44, label, { size: 13, fill: 'ink', weight: 600 }));
}

/** A row of evenly spaced x positions. */
export function spread(n: number, x0 = 30, x1 = W - 30): number[] {
  if (n === 1) return [(x0 + x1) / 2];
  return Array.from({ length: n }, (_, i) => x0 + (i * (x1 - x0)) / (n - 1));
}

/** Text on several lines (SVG text doesn't wrap). */
export function lines(s: SceneBuilder, id: string, x: number, y: number, t: string[], o: Partial<Shape> = {}) {
  t.forEach((l, i) => s.add(text(`${id}${i}`, x, y + i * 24, l, o)));
}

export const scene = () => new SceneBuilder(W, H);
