import type { Problem } from './types';
import { formatAnswer } from './answer';
import { SceneBuilder, rect, text, type Scene } from './scene';

/** Split a sentence into lines that fit the stage (SVG text doesn't wrap). */
export function wrap(s: string, max = 32): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of s.split(/\s+/)) {
    if (cur && (cur + ' ' + word).length > max) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Whiteboard explanation built from the worked steps: each step writes itself in, earlier steps
 * slide up and fade, and the answer lands in a green chip. Used when a topic has no custom picture.
 */
export function stepsScene(p: Problem): Scene {
  const W = 360, H = 230, LH = 24, TOP = 16, BOTTOM = 168;
  const s = new SceneBuilder(W, H);
  let blocks: { ids: string[]; lines: string[] }[] = [];
  p.steps.forEach((step, i) => {
    const lines = wrap(step.replace(/\s*✔\s*$/, ''));
    blocks.push({ ids: lines.map((_, k) => `s${i}-${k}`), lines });
    // Lay out from the bottom up: newest at the bottom, older ones above and dimmed.
    let y = BOTTOM;
    const placed: typeof blocks = [];
    for (let b = blocks.length - 1; b >= 0; b--) {
      const blk = blocks[b];
      y -= blk.lines.length * LH;
      if (y < TOP) {
        s.remove(...blk.ids);
        continue;
      }
      blk.lines.forEach((l, k) => {
        const id = blk.ids[k];
        const props = { x: W / 2, y: y + k * LH + LH / 2, opacity: b === blocks.length - 1 ? 1 : 0.4, size: 18, weight: b === blocks.length - 1 ? 600 : 500 };
        if (s.has(id)) s.set(id, props);
        else s.add(text(id, props.x, props.y, l, props));
      });
      y -= 10;
      placed.unshift(blk);
    }
    blocks = placed;
    s.step(step, { reveal: i === 0 });
  });
  const ans = formatAnswer(p.answer);
  s.add(rect('ans-bg', W / 2 - 110, 184, 220, 38, { fill: 'good', stroke: 'none', rx: 19, pulse: true }), text('ans', W / 2, 203, ans, { fill: 'fill', size: 20, weight: 700 }));
  s.step(`The answer is ${ans}.`, { reveal: true });
  return s.build();
}

/** The scene for a problem: its own picture if the topic has one, otherwise the whiteboard. */
export function sceneFor(p: Problem): Scene {
  return p.scene ?? stepsScene(p);
}
