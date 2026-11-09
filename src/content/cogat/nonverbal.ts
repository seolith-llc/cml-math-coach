/** CogAT-style Nonverbal Battery: figure matrices, paper folding, figure classification (original items). */
import type { Grade, Topic } from '../../core/types';
import type { Rng } from '../../core/rng';
import { SceneBuilder, circle, line, path, rect, text } from '../../core/scene';
import { choicesFor, mc, retry } from './common';
import {
  DIRECTION, FILLS, FILL_WORD, POINTY, SHAPES, SHAPE_WORD, describe, figMarkup, figShapes, figSvg, foldStripSvg, foldedOutline, holesAfter,
  paperSvg, sameFig, svgBox, unfold, type Fig, type Fold, type Pt
} from './figures';

const W = 360, H = 220;
const figKey = (f: Fig) => `${f.shape}|${f.fill}|${f.size}|${f.count}|${POINTY.includes(f.shape) ? ((f.rot % 360) + 360) % 360 : 0}`;
const NON_POINTY = SHAPES.filter((s) => !POINTY.includes(s));
/** Groups of 2 or 3 are always drawn small, so size only means something for a single shape. */
const norm = (f: Fig): Fig => (f.count > 1 ? { ...f, size: 'S' } : f);
const looksBig = (f: Fig) => f.count === 1 && f.size === 'L';

/* ======================= figure matrices ======================= */

type Attr = 'fill' | 'size' | 'count' | 'rot';
interface Change { attr: Attr; to: Fig[Attr] }

function changeWords(c: Change, from: Fig): string {
  switch (c.attr) {
    case 'fill': return `turns ${FILL_WORD[c.to as Fig['fill']]}`;
    case 'size': return c.to === 'S' ? 'gets smaller' : 'gets bigger';
    case 'count': return `goes from ${from.count} to ${c.to}`;
    case 'rot': return ((c.to as number) - from.rot + 360) % 360 === 180 ? 'turns upside down' : `turns to point ${DIRECTION[((c.to as number) + 360) % 360]}`;
  }
}

const apply = (f: Fig, cs: Change[]): Fig => norm(cs.reduce((g, c) => ({ ...g, [c.attr]: c.to }), f));

function randomFig(rng: Rng, grade: Grade, pointy: boolean): Fig {
  return norm({
    shape: rng.pick(pointy ? POINTY : NON_POINTY),
    fill: rng.pick(FILLS),
    size: rng.pick(['S', 'L'] as const),
    rot: pointy ? rng.pick([0, 90, 180, 270]) : 0,
    count: grade === 2 ? 1 : rng.pick([1, 1, 2] as const)
  });
}

function pickChanges(rng: Rng, grade: Grade, a: Fig): Change[] {
  const attrs: Attr[] = POINTY.includes(a.shape) ? ['rot', 'fill', 'size'] : ['fill', 'size', 'count'];
  let chosen = rng.sample(attrs.filter((x) => x !== 'size' || a.count === 1), grade === 2 ? 1 : 2);
  // size and "how many" together would hide each other
  while (chosen.includes('size') && chosen.includes('count')) chosen = rng.sample(attrs, 2);
  return chosen.map((attr): Change => {
    switch (attr) {
      case 'fill': return { attr, to: rng.pick(FILLS.filter((f) => f !== a.fill)) };
      case 'size': return { attr, to: a.size === 'L' ? 'S' : 'L' };
      case 'count': return { attr, to: a.count === 1 ? rng.pick([2, 3] as const) : 1 };
      case 'rot': return { attr, to: (a.rot + rng.pick([90, 180, 270])) % 360 };
    }
  });
}

function matrixFigure(cells: (Fig | null)[]): string {
  const c = 84, g = 10, x0 = 10, y0 = 10;
  let inner = '';
  cells.forEach((f, i) => {
    const x = x0 + (i % 2) * (c + g), y = y0 + Math.floor(i / 2) * (c + g);
    inner += `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="8" stroke-width="2" ${f ? '' : 'stroke-dasharray="5 5"'}/>`;
    inner += f ? figMarkup(f, x + c / 2, y + c / 2, c) : `<text x="${x + c / 2}" y="${y + c / 2 + 10}" text-anchor="middle" font-size="30" font-weight="700" fill="currentColor" stroke="none">?</text>`;
  });
  return svgBox(2 * c + g + 20, 2 * c + g + 20, 'two rows of boxes; the last box is missing', inner);
}

function matrixScene(a: Fig, b: Fig, c: Fig, d: Fig, cs: Change[]) {
  const s = new SceneBuilder(W, H);
  const cell = 86, x0 = 24, y0 = 18, g = 10;
  const pos = (i: number) => [x0 + (i % 2) * (cell + g), y0 + Math.floor(i / 2) * (cell + g)] as const;
  [a, b, c, null].forEach((f, i) => {
    const [x, y] = pos(i);
    s.add(rect(`cell${i}`, x, y, cell, cell, { fill: 'fill', stroke: 'line', rx: 8, dash: !f }));
    if (f) s.add(...figShapes(f, `f${i}`, x + cell / 2, y + cell / 2, cell));
  });
  s.add(text('q', pos(3)[0] + cell / 2, pos(3)[1] + cell / 2, '?', { size: 30, weight: 700, fill: 'muted' }));
  s.step('Each row follows the same rule. The top row shows the rule.');
  s.set('cell0', { stroke: 'accent', sw: 3 }).set('cell1', { stroke: 'accent', sw: 3 });
  const words = cs.map((ch) => changeWords(ch, a));
  s.add(path('arrow0', pos(0)[0] + cell - 10, y0 - 6, `M0 0 Q${(cell + g) / 2 + 10} -14 ${cell + g + 20} 0`, { stroke: 'accent', sw: 2.5, draw: true }));
  words.forEach((w, i) => s.add(text(`w${i}`, 290, 40 + i * 24, w, { size: 15, fill: 'accent', weight: 700 })));
  s.step(`From the first box to the second, the shape ${words.join(' and ')}.`);
  s.set('cell0', { stroke: 'line', sw: 1.5 }).set('cell1', { stroke: 'line', sw: 1.5 }).set('cell2', { stroke: 's2', sw: 3 });
  s.step(`The bottom row starts with ${describe(c)}.`);
  s.remove('q');
  s.set('cell3', { stroke: 'good', sw: 3, dash: false });
  s.add(...figShapes(d, 'f3', pos(3)[0] + cell / 2, pos(3)[1] + cell / 2, cell, { pulse: true }));
  s.add(path('arrow1', pos(2)[0] + cell - 10, pos(2)[1] + cell + 6, `M0 0 Q${(cell + g) / 2 + 10} 14 ${cell + g + 20} 0`, { stroke: 'good', sw: 2.5, draw: true }));
  s.step(`Make the same change: ${describe(d)}.`, { reveal: true });
  return s.build();
}

export const figureMatrices: Topic = {
  id: 'cogat-matrices',
  title: 'Figure matrices',
  category: 'Nonverbal',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Find the rule',
  guide: {
    idea: 'The top row shows a change. Say the change in words ("it gets smaller", "it turns black"). Then do the same change to the bottom row.',
    tips: ['Check shape, colour, size, how many, and which way it points.', 'Say the rule out loud before you look at the answers.', 'Cross out answers that break the rule.'],
    traps: ['Picking the answer that looks like the box next to it.', 'Making only one of two changes.']
  },
  generate: ({ grade, rng }) => retry(() => {
    const pointy = rng.chance(0.35);
    const a = randomFig(rng, grade, pointy);
    const cs = pickChanges(rng, grade, a);
    const b = apply(a, cs);
    const c: Fig = { ...a, shape: rng.pick((pointy ? POINTY : NON_POINTY).filter((s) => s !== a.shape)) };
    if (grade === 3 && rng.chance(0.5) && !cs.some((x) => x.attr === 'fill')) c.fill = rng.pick(FILLS.filter((f) => f !== a.fill));
    const d = apply(c, cs);
    const wrong = ([
      c,
      { ...b },
      ...cs.map((ch) => apply(c, cs.filter((x) => x !== ch))),
      ...(d.count === 1 ? [{ ...d, size: d.size === 'L' ? 'S' : 'L' } as Fig] : []),
      { ...d, fill: rng.pick(FILLS.filter((f) => f !== d.fill)) },
      { ...d, shape: a.shape },
      { ...d, count: d.count === 1 ? 2 : 1 },
      { ...d, rot: (d.rot + 180) % 360 }
    ] as Fig[]).map(norm);
    const m = mc(rng, d, wrong, choicesFor(grade), figKey, describe, (f) => figSvg(f));
    if (!m || [a, b, c].some((f) => sameFig(f, d))) return null;
    const rule = cs.map((ch) => changeWords(ch, a)).join(' and ');
    return {
      text: 'Which picture goes in the empty box?',
      speech: `Look at the boxes. In the top row, the picture ${rule}. Which picture goes in the empty box?`,
      figure: matrixFigure([a, b, c, null]),
      answer: m.answer,
      hints: ['Look at the top row. What changed from the first box to the second?', `The picture ${rule}. Do the same to the bottom row.`],
      steps: [`Top row: the picture ${rule}.`, `Bottom row starts with ${describe(c)}.`, `Same change: ${describe(d)}.`],
      misconceptions: [
        ...m.miss(c, 'That is the same as the first box in the row. Something has to change.'),
        ...m.miss(b, 'That copies the top row. The bottom row keeps its own shape.'),
        ...cs.flatMap((ch) => (cs.length > 1 ? m.miss(apply(c, cs.filter((x) => x !== ch)), 'Close! The top row makes two changes. This picture only has one of them.') : []))
      ],
      scene: matrixScene(a, b, c, d, cs)
    };
  })
};

/* ======================= paper folding ======================= */

const CELLS = [0.125, 0.375, 0.625, 0.875];
const ptsKey = (ps: Pt[]) => ps.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).sort().join(';');
const ROW = ['top', 'upper middle', 'lower middle', 'bottom'], COL = ['left', 'left middle', 'right middle', 'right'];
const where = ([x, y]: Pt) => `${ROW[CELLS.indexOf(y)]} ${COL[CELLS.indexOf(x)]}`;
const holesName = (ps: Pt[]) => `${ps.length} hole${ps.length === 1 ? '' : 's'}: ${[...ps].sort((p, q) => p[1] - q[1] || p[0] - q[0]).map(where).join(', ')}`;
const FOLD_WORD: Record<Fold, string> = { v: 'in half from left to right', h: 'in half from top to bottom', d: 'corner to corner' };

function visible(p: Pt, folds: Fold[]): boolean {
  if (folds.includes('v') && p[0] < 0.5) return false;
  if (folds.includes('h') && p[1] < 0.5) return false;
  if (folds.includes('d') && !(p[1] > p[0])) return false;
  return true;
}

function foldScene(folds: Fold[], hole: Pt, holes: Pt[]) {
  const s = new SceneBuilder(W, H);
  const S = 150, x = 105, y = 30;
  const outline = (pts: Pt[]) => `M${pts.map(([a, b]) => `${(a * S).toFixed(1)} ${(b * S).toFixed(1)}`).join(' L')} Z`;
  s.add(path('ghost', x, y, outline(foldedOutline([])), { stroke: 'line', sw: 1.5, dash: true, fill: 'none' }));
  s.add(path('paper', x, y, outline(foldedOutline(folds)), { stroke: 'ink', sw: 2.5, fill: 'fill' }));
  s.add(circle('h0', x + hole[0] * S, y + hole[1] * S, 8, { fill: 'ink', stroke: 'none', pulse: true }));
  s.step(`The paper was folded ${folds.map((f) => FOLD_WORD[f]).join(', then ')}. Then one hole was punched through every layer.`);
  let shown: Pt[] = [hole];
  [...folds].reverse().forEach((f, k) => {
    const left = folds.slice(0, folds.length - 1 - k);
    const fl: [Pt, Pt] = f === 'v' ? [[0.5, 0], [0.5, 1]] : f === 'h' ? [[0, 0.5], [1, 0.5]] : [[0, 0], [1, 1]];
    s.add(line(`fold${k}`, x + fl[0][0] * S, y + fl[0][1] * S, (fl[1][0] - fl[0][0]) * S, (fl[1][1] - fl[0][1]) * S, { stroke: 'accent', sw: 2, dash: true }));
    s.set('paper', { d: outline(foldedOutline(left)) });
    const added = shown.map((p) => unfold(p, f));
    shown = [...shown, ...added];
    added.forEach((p, i) => s.add(circle(`h${k + 1}-${i}`, x + p[0] * S, y + p[1] * S, 8, { fill: 'accent', stroke: 'none', pulse: true })));
    s.step(`Open ${k === 0 ? 'the last' : 'the next'} fold. Every hole is copied across the fold line, like in a mirror.`, k === 0 ? { reveal: true } : {});
  });
  s.setAll('h', { fill: 'good' });
  s.add(text('n', 300, y + S / 2, `${holes.length} hole${holes.length > 1 ? 's' : ''}`, { size: 18, weight: 700, fill: 'good' }));
  s.step(`Open paper: ${holes.length} hole${holes.length > 1 ? 's' : ''}.`, { reveal: true });
  return s.build();
}

export const paperFolding: Topic = {
  id: 'cogat-paper-folding',
  title: 'Paper folding',
  category: 'Nonverbal',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Act it out',
  guide: {
    idea: 'When you open a fold, each hole gets a twin on the other side of the fold line, the same distance away, like a mirror.',
    tips: ['Open the folds one at a time, the last fold first.', 'Count the layers: one fold makes 2 holes, two folds make 4.', 'Try it with real paper and a pencil!'],
    traps: ['Forgetting the mirror hole.', 'Mirroring across the wrong line.']
  },
  generate: ({ grade, rng }) => retry(() => {
    const folds: Fold[] = grade === 2 ? [rng.pick(['v', 'h', 'd'] as const)] : rng.pick([['v', 'h'], ['h', 'v'], ['v', 'h'], ['d']] as Fold[][]);
    const hole: Pt = [rng.pick(CELLS), rng.pick(CELLS)];
    if (!visible(hole, folds)) return null;
    const right = holesAfter(hole, folds);
    const swap = (f: Fold): Fold => (f === 'v' ? 'h' : f === 'h' ? 'v' : rng.pick(['v', 'h'] as const));
    const nudged: Pt = [CELLS[Math.min(3, CELLS.indexOf(hole[0]) + 1)] ?? hole[0], hole[1]];
    const wrong: Pt[][] = [
      [hole],
      holesAfter(hole, folds.map(swap)),
      ...(folds.length > 1 ? [holesAfter(hole, folds.slice(1)), holesAfter(hole, folds.slice(0, 1))] : []),
      holesAfter(nudged, folds),
      folds.length > 1 ? holesAfter(hole, [folds[0]]).map((p) => [p[0], 1 - p[1]] as Pt) : [hole, [hole[0], 1 - hole[1]], [1 - hole[0], hole[1]]],
      holesAfter([hole[0], CELLS[3 - CELLS.indexOf(hole[1])]], folds)
    ];
    const m = mc(rng, right, wrong, choicesFor(grade), ptsKey, holesName, paperSvg);
    if (!m) return null;
    const how = folds.map((f) => FOLD_WORD[f]).join(', then ');
    return {
      text: 'The paper is folded and a hole is punched. What does it look like when it is opened?',
      speech: `A square paper is folded ${how}. Then a hole is punched. What does the paper look like when it is unfolded?`,
      figure: foldStripSvg(folds, hole),
      answer: m.answer,
      hints: [`How many layers does the hole go through? ${folds.length === 1 ? 'Two layers make 2 holes.' : 'Four layers make 4 holes.'}`, 'Open the last fold first. The hole gets a mirror twin across the fold line.'],
      steps: [`Folded ${how}: the hole goes through ${2 ** folds.length} layers.`, `Opening makes ${right.length} holes, mirrored across each fold line.`],
      misconceptions: [
        ...m.miss([hole], 'The hole goes through every layer of the folded paper, so there is more than one hole.'),
        ...m.miss(holesAfter(hole, folds.map(swap)), 'Those holes are mirrored across the wrong line. Look at where the fold was.')
      ],
      scene: foldScene(folds, hole, right)
    };
  })
};

/* ======================= figure classification ======================= */

type Rule = 'shape' | 'fill' | 'size' | 'count' | 'rot';
const ruleWords = (r: Rule, f: Fig) =>
  r === 'shape' ? `they are all ${SHAPE_WORD[f.shape]}s` : r === 'fill' ? `they are all ${FILL_WORD[f.fill]}` : r === 'size' ? `they are all ${f.size === 'L' ? 'big' : 'small'}` : r === 'count' ? `each box has ${f.count}` : `they all point ${DIRECTION[f.rot]}`;

function varied<T>(rng: Rng, pool: readonly T[]): T[] {
  // three values with at least two different ones
  for (;;) {
    const v = [rng.pick(pool), rng.pick(pool), rng.pick(pool)];
    if (new Set(v).size > 1) return v;
  }
}

function classifyScene(stim: Fig[], ans: Fig, rule: Rule) {
  const s = new SceneBuilder(W, H);
  const cell = 78, gap = 10, x0 = 12, y = 30;
  stim.forEach((f, i) => {
    s.add(rect(`c${i}`, x0 + i * (cell + gap), y, cell, cell, { fill: 'fill', stroke: 'line', rx: 8 }));
    s.add(...figShapes(f, `f${i}`, x0 + i * (cell + gap) + cell / 2, y + cell / 2, cell));
  });
  s.add(rect('c3', x0 + 3 * (cell + gap) + 6, y, cell, cell, { fill: 'fill', stroke: 'line', rx: 8, dash: true }), text('q', x0 + 3 * (cell + gap) + 6 + cell / 2, y + cell / 2, '?', { size: 28, weight: 700, fill: 'muted' }));
  s.step('How are these three alike?');
  const differ = (['shape', 'fill', 'size', 'count'] as Rule[]).filter((r) => r !== rule && new Set(stim.map((f) => (r === 'shape' ? f.shape : f[r]))).size > 1);
  const NAME: Record<Rule, string> = { shape: 'shapes', fill: 'colours', size: 'sizes', count: 'numbers of shapes', rot: 'directions' };
  if (differ.length) {
    s.add(text('d', W / 2, 150, `different ${differ.map((r) => NAME[r]).join(', ')}`, { size: 15, fill: 'muted', weight: 600 }));
    s.step(`Not the ${differ.map((r) => NAME[r]).join(' or the ')}: those change.`);
  }
  s.setAll('c', { stroke: 'accent', sw: 3 });
  s.set('c3', { stroke: 'line', sw: 1.5 });
  s.remove('d').add(text('rule', W / 2, 150, ruleWords(rule, stim[0]), { size: 18, fill: 'accent', weight: 700, pulse: true }));
  s.step(`Same: ${ruleWords(rule, stim[0])}.`, { reveal: true });
  s.remove('q').set('c3', { stroke: 'good', sw: 3, dash: false });
  s.add(...figShapes(ans, 'f3', x0 + 3 * (cell + gap) + 6 + cell / 2, y + cell / 2, cell, { pulse: true }));
  s.step(`The answer has that too: ${describe(ans)}.`, { reveal: true });
  return s.build();
}

export const figureClassification: Topic = {
  id: 'cogat-figure-classes',
  title: 'Figure classification',
  category: 'Nonverbal',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Find the rule',
  guide: {
    idea: 'Find what the three pictures have in common, like shape, colour, size, how many, or the way they point. Then pick the one that has it too.',
    tips: ['Check one thing at a time: shape, colour, size, number, direction.', 'If something changes between the three, it is not the rule.', 'Say the rule before you look at the answers.'],
    traps: ['Choosing a picture that looks like one of the three but breaks the rule.']
  },
  generate: ({ grade, rng }) => retry(() => classify(grade, rng)?.problem ?? null)
};

/** Exported for tests: the item plus the figures behind it. */
export function classify(grade: Grade, rng: Rng) {
  {
    const rules: Rule[] = grade === 2 ? ['shape', 'fill', 'size'] : ['shape', 'fill', 'size', 'count', 'rot'];
    const rule = rng.pick(rules);
    const shapesPool = rule === 'rot' ? POINTY : NON_POINTY;
    const fixed: Fig = { shape: rng.pick(shapesPool), fill: rng.pick(FILLS), size: rng.pick(['S', 'L'] as const), count: grade === 2 ? 1 : rng.pick([1, 2, 3] as const), rot: rule === 'rot' ? rng.pick([90, 180, 270]) : 0 };
    const shapes = rule === 'shape' ? [fixed.shape, fixed.shape, fixed.shape] : rule === 'rot' ? varied(rng, POINTY) : varied(rng, NON_POINTY);
    const fills = rule === 'fill' ? [fixed.fill, fixed.fill, fixed.fill] : varied(rng, FILLS);
    const sizes = rule === 'size' ? [fixed.size, fixed.size, fixed.size] : varied(rng, ['S', 'L'] as const);
    const counts = rule === 'count' ? [fixed.count, fixed.count, fixed.count] : grade === 2 || rule === 'size' ? [1, 1, 1] as const : varied(rng, [1, 2, 3] as const);
    if (rule === 'size') fixed.count = 1;
    const stim: Fig[] = [0, 1, 2].map((i) => norm({ shape: shapes[i], fill: fills[i], size: sizes[i], count: counts[i], rot: rule === 'rot' ? fixed.rot : 0 }));
    // "looks big" / "looks small" must not be an accidental shared trait
    if (rule !== 'size' && (stim.every(looksBig) || !stim.some(looksBig))) return null;
    if (stim.some((f, i) => stim.some((g, j) => i < j && sameFig(f, g)))) return null;
    // the rule must be the ONLY thing all three share
    // (Grade 2 always shows one of each, so "how many" never tells the answers apart.)
    const shared = (['shape', 'fill', 'size', 'count'] as const).filter((k) => !(grade === 2 && k === 'count') && new Set(stim.map((f) => f[k])).size === 1);
    if (shared.join() !== (rule === 'rot' ? '' : rule)) return null;
    const free = (): Fig => norm({
      shape: rule === 'shape' ? fixed.shape : rng.pick(shapesPool),
      fill: rule === 'fill' ? fixed.fill : rng.pick(FILLS),
      size: rule === 'size' ? fixed.size : rng.pick(['S', 'L'] as const),
      count: rule === 'count' || rule === 'size' ? fixed.count : grade === 2 ? 1 : rng.pick([1, 2, 3] as const),
      rot: rule === 'rot' ? fixed.rot : 0
    });
    const ans = free();
    if (stim.some((f) => sameFig(f, ans))) return null;
    const breaks = (): Fig => {
      const f = free();
      if (rule === 'shape') f.shape = rng.pick(NON_POINTY.filter((x) => x !== fixed.shape));
      if (rule === 'fill') f.fill = rng.pick(FILLS.filter((x) => x !== fixed.fill));
      if (rule === 'size') f.size = fixed.size === 'L' ? 'S' : 'L';
      if (rule === 'count') f.count = rng.pick(([1, 2, 3] as const).filter((x) => x !== fixed.count));
      if (rule === 'rot') f.rot = rng.pick([0, 90, 180, 270].filter((x) => x !== fixed.rot));
      return norm(f);
    };
    // tempting: looks like one of the three, but breaks the rule
    const lookalike = { ...stim[0] };
    if (rule === 'shape') lookalike.shape = rng.pick(NON_POINTY.filter((x) => x !== fixed.shape));
    if (rule === 'fill') lookalike.fill = rng.pick(FILLS.filter((x) => x !== fixed.fill));
    if (rule === 'size') lookalike.size = fixed.size === 'L' ? 'S' : 'L';
    if (rule === 'count') lookalike.count = fixed.count === 1 ? 2 : 1;
    if (rule === 'rot') lookalike.rot = (fixed.rot + 180) % 360;
    const m = mc(rng, ans, [norm(lookalike), ...Array.from({ length: 12 }, breaks)], choicesFor(grade), figKey, describe, (f) => figSvg(f));
    if (!m) return null;
    const cell = 80;
    const figure = svgBox(3 * (cell + 10) + 10, cell + 20, 'three pictures that go together', stim.map((f, i) => `<rect x="${10 + i * (cell + 10)}" y="10" width="${cell}" height="${cell}" rx="8" stroke-width="2"/>` + figMarkup(f, 10 + i * (cell + 10) + cell / 2, 10 + cell / 2, cell)).join(''));
    const problem = {
      text: 'The three pictures go together. Which picture goes with them?',
      speech: 'Look at the three pictures. They are alike in some way. Which answer goes with them?',
      figure,
      answer: m.answer,
      hints: ['Check one thing at a time: shape, colour, size, how many, which way.', `Something changes in every way but one. ${rule === 'rot' ? 'Look at the direction.' : 'What stays the same?'}`],
      steps: [`Same in all three: ${ruleWords(rule, stim[0])}.`, `Only one answer has that: ${describe(ans)}.`],
      misconceptions: m.miss(norm(lookalike), `It looks like the first picture, but it breaks the rule. In the three pictures, ${ruleWords(rule, stim[0])}.`),
      scene: classifyScene(stim, ans, rule)
    };
    return { problem, stim, options: m.items, ans };
  }
}
