/**
 * Explanation scenes (pure data). A scene is a list of steps; each step has a voice-over line and the
 * full picture at that moment. The player animates between pictures: shapes with the same id move,
 * new ones appear (lines draw themselves), missing ones fade out.
 *
 *   const s = new SceneBuilder(360, 200);
 *   s.add(text('q', 180, 30, '42 − □ = 27'));  s.step('Start with the question.');
 *   s.set('q', { role: 'accent' });             s.step('The box is the jump back from 42 to 27.', { reveal: true });
 */

export type Role = 'ink' | 'muted' | 'accent' | 'good' | 'bad' | 'warn' | 'fill' | 'line' | 'star' | 's1' | 's2' | 'none';

export interface Shape {
  id: string;
  kind: 'rect' | 'circle' | 'path' | 'text' | 'line';
  /** Position (moves animate). For rect/text it's the top-left / anchor point; for circle the centre. */
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  /** Path data, relative to (x, y). */
  d?: string;
  /** Line end, relative to (x, y). */
  x2?: number;
  y2?: number;
  text?: string;
  size?: number;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  fill?: Role;
  stroke?: Role;
  sw?: number;
  /** Rotation in degrees around (x, y) (clock hands). Animates. */
  rot?: number;
  /** Draw the stroke in when it first appears. */
  draw?: boolean;
  dash?: boolean;
  /** Pulse once when it appears or changes. */
  pulse?: boolean;
  opacity?: number;
  rx?: number;
}

export interface SceneStep {
  /** Voice-over and caption. */
  say: string;
  shapes: Shape[];
  /** True when this step gives the answer away (hints stop before the first one). */
  reveal?: boolean;
}

export interface Scene {
  w: number;
  h: number;
  steps: SceneStep[];
}

export class SceneBuilder {
  private shapes = new Map<string, Shape>();
  readonly steps: SceneStep[] = [];
  constructor(readonly w = 360, readonly h = 220) {}

  add(...shapes: Shape[]): this {
    for (const s of shapes) this.shapes.set(s.id, { ...s });
    return this;
  }
  set(id: string, patch: Partial<Shape>): this {
    const s = this.shapes.get(id);
    if (s) this.shapes.set(id, { ...s, ...patch });
    return this;
  }
  /** Apply the same patch to every shape whose id starts with `prefix`. */
  setAll(prefix: string, patch: Partial<Shape>): this {
    for (const [id, s] of this.shapes) if (id.startsWith(prefix)) this.shapes.set(id, { ...s, ...patch });
    return this;
  }
  remove(...ids: string[]): this {
    for (const id of ids) {
      if (id.endsWith('*')) for (const k of [...this.shapes.keys()]) k.startsWith(id.slice(0, -1)) && this.shapes.delete(k);
      else this.shapes.delete(id);
    }
    return this;
  }
  has(id: string): boolean {
    return this.shapes.has(id);
  }
  /** Snapshot the current picture as a step. Pulses are one-shot. */
  step(say: string, opts: { reveal?: boolean } = {}): this {
    say = say.replace(/M\.\./g, 'M.').replace(/\.\.(?!\.)/g, '.'); // "9:35 A.M.." → "9:35 A.M."
    this.steps.push({ say, shapes: [...this.shapes.values()].map((s) => ({ ...s })), ...(opts.reveal ? { reveal: true } : {}) });
    for (const [id, s] of this.shapes) if (s.pulse) this.shapes.set(id, { ...s, pulse: false });
    return this;
  }
  build(): Scene {
    return { w: this.w, h: this.h, steps: this.steps };
  }
}

/* ---------------- shape helpers ---------------- */

export const text = (id: string, x: number, y: number, t: string | number, o: Partial<Shape> = {}): Shape => ({
  id, kind: 'text', x, y, text: String(t), size: 18, weight: 600, anchor: 'middle', fill: 'ink', ...o
});
export const rect = (id: string, x: number, y: number, w: number, h: number, o: Partial<Shape> = {}): Shape => ({
  id, kind: 'rect', x, y, w, h, fill: 'fill', stroke: 'line', sw: 1.5, rx: 6, ...o
});
export const circle = (id: string, x: number, y: number, r: number, o: Partial<Shape> = {}): Shape => ({
  id, kind: 'circle', x, y, r, fill: 'fill', stroke: 'line', sw: 1.5, ...o
});
export const line = (id: string, x: number, y: number, x2: number, y2: number, o: Partial<Shape> = {}): Shape => ({
  id, kind: 'line', x, y, x2, y2, stroke: 'line', sw: 2, fill: 'none', ...o
});
export const path = (id: string, x: number, y: number, d: string, o: Partial<Shape> = {}): Shape => ({
  id, kind: 'path', x, y, d, stroke: 'accent', sw: 2.5, fill: 'none', ...o
});

/** Hop arc from x1 to x2 (absolute), above a baseline at y. */
export function arc(id: string, x1: number, x2: number, y: number, o: Partial<Shape> = {}): Shape {
  const h = Math.min(60, Math.max(18, Math.abs(x2 - x1) * 0.45));
  return path(id, x1, y, `M0 0 Q${(x2 - x1) / 2} ${-h * 2} ${x2 - x1} 0`, { draw: true, ...o });
}

/** Square bracket under/over a span, with a label. */
export function brace(id: string, x1: number, x2: number, y: number, label: string, up = false, o: Partial<Shape> = {}): Shape[] {
  const t = up ? -8 : 8;
  return [
    path(`${id}-b`, x1, y, `M0 ${t} V0 H${x2 - x1} V${t}`, { stroke: 'muted', sw: 1.5, draw: true, ...o }),
    text(`${id}-t`, (x1 + x2) / 2, y + (up ? -14 : 24), label, { size: 15, fill: 'ink', ...o, stroke: undefined })
  ];
}
