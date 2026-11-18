/**
 * Phase 4 "make kids think" families (docs/REDESIGN.md §4, step083): original puzzle types.
 * - magic squares: find the total from a full line, then a missing number (level 3: one hidden box first);
 * - rule machines: find the rule from in → out pairs, use it (level 3: work backwards from an output).
 */
import type { Topic } from '../../core/types';
import type { Rng } from '../../core/rng';
import { misNum, num, until } from './helpers';
import { magicScene, ruleScene } from '../scenes/thinkers';

/* ---------------- magic squares ---------------- */

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const LO_SHU = [2, 7, 6, 9, 5, 1, 4, 3, 8];
const SYMMETRIES: ((i: number) => number)[] = [
  (i) => i,
  (i) => (i % 3) * 3 + (2 - Math.floor(i / 3)), // rotate
  (i) => 8 - i,
  (i) => (2 - (i % 3)) * 3 + Math.floor(i / 3),
  (i) => Math.floor(i / 3) * 3 + (2 - (i % 3)), // mirror
  (i) => (2 - Math.floor(i / 3)) * 3 + (i % 3),
  (i) => (i % 3) * 3 + Math.floor(i / 3), // transpose
  (i) => (2 - (i % 3)) * 3 + (2 - Math.floor(i / 3))
];

/** Which boxes can be filled in order (each from a line with exactly one gap), starting from what is shown. */
function solveOrder(shown: boolean[], values: number[], ask: number): { cell: number; line: number[]; value: number }[] | null {
  const known = [...shown];
  if (!LINES.some((l) => l.every((i) => known[i]))) return null; // the total must be findable
  const order: { cell: number; line: number[]; value: number }[] = [];
  while (!known[ask]) {
    let found: { cell: number; line: number[] } | null = null;
    for (const l of LINES) {
      const gaps = l.filter((i) => !known[i]);
      if (gaps.length === 1 && (gaps[0] === ask || !found)) {
        found = { cell: gaps[0], line: l };
        if (gaps[0] === ask) break;
      }
    }
    if (!found) return null;
    known[found.cell] = true;
    order.push({ ...found, value: values[found.cell] });
    if (found.cell === ask) break;
  }
  return order;
}

interface Magic { values: number[]; shown: boolean[]; ask: number; order: { cell: number; line: number[]; value: number }[]; total: number; full: number[] }

function makeMagic(rng: Rng, grade: number, level: number): Magic {
  return until(() => {
    const step = grade === 2 ? (level === 3 ? rng.int(1, 2) : 1) : rng.int(1, level === 3 ? 5 : 3);
    const base = grade === 2 ? rng.int(1, level === 1 ? 3 : 6) : rng.int(2, level === 1 ? 10 : 20);
    const sym = SYMMETRIES[rng.int(0, 7)];
    const values = Array.from({ length: 9 }, (_, i) => base + (LO_SHU[sym(i)] - 1) * step);
    const ask = rng.int(0, 8);
    const blanks = level === 3 ? rng.int(3, 4) : 2;
    const hidden = new Set<number>([ask]);
    while (hidden.size < blanks) hidden.add(rng.int(0, 8));
    const shown = values.map((_, i) => !hidden.has(i));
    const order = solveOrder(shown, values, ask) ?? [];
    const full = LINES.find((l) => l.every((i) => shown[i])) ?? [];
    return { values, shown, ask, order, total: values[0] + values[4] + values[8], full };
  }, (m) => m.order.length > 0 && m.full.length > 0 && (level === 3 ? m.order.length >= 2 : m.order.length === 1));
}

export const magicSquare: Topic = {
  id: 'magic-square',
  title: 'Magic squares',
  category: 'Puzzles',
  grades: [2, 3],
  strategy: 'Use logical reasoning',
  guide: {
    idea: 'In a magic square, every row, every column and both diagonals add up to the same total. Find a full line to learn the total, then fill a line that has only one empty box.',
    tips: ['Add a full line first: that is the total for every line.', 'Look for a line with just one empty box.', 'Total take away the numbers you know gives the empty box.'],
    traps: ['Answering with the total instead of the missing number.', 'Starting with a line that has two empty boxes.']
  },
  generate: ({ grade, level, rng }) => {
    const m = makeMagic(rng, grade, level);
    const grid = m.values.map((v, i) => (m.shown[i] ? v : null));
    const answer = m.values[m.ask];
    const rows = [0, 1, 2].map((r) => grid.slice(r * 3, r * 3 + 3).map((v, c) => (r * 3 + c === m.ask ? '?' : v ?? '_')).join('  ')).join(' / ');
    const sayRows = [0, 1, 2].map((r) => grid.slice(r * 3, r * 3 + 3).map((v, c) => (r * 3 + c === m.ask ? 'question mark' : v ?? 'blank')).join(', ')).join('. Next row: ');
    const tellTotal = level === 1;
    const last = m.order[m.order.length - 1];
    const knownInLast = last.line.filter((i) => i !== m.ask).map((i) => m.values[i]);
    const first = m.order[0];
    return {
      scene: magicScene(grid, [...m.full], m.total, m.order, m.ask),
      text: `In this magic square, **every row, column and diagonal** adds up to the same total${tellTotal ? ` (**${m.total}**)` : ''}. Rows: ${rows}. What number goes in the **?** box?`,
      speech: `In this magic square, every row, column and diagonal adds up to the same total${tellTotal ? `, ${m.total}` : ''}. First row: ${sayRows}. What number goes where the question mark is?`,
      answer: num(answer),
      hints: [
        tellTotal ? `Every line adds up to ${m.total}.` : `Find a full line and add it up: that is the total for every line.`,
        m.order.length > 1 ? `The ? box has no line with just one gap yet. Fill another box first: look for a line with only one empty box.` : `Look at a line through the ? box where every other box is filled.`,
        `Total take away the numbers you know in that line.`
      ],
      steps: [
        `A full line: ${m.full.map((i) => m.values[i]).join(' + ')} = ${m.total}. Every line adds to ${m.total}.`,
        ...m.order.map((o) => `${o.cell === m.ask ? 'The ? box' : 'A hidden box'}: ${m.total} − ${o.line.filter((i) => i !== o.cell).map((i) => m.values[i]).join(' − ')} = ${o.value}.`)
      ],
      misconceptions: misNum(answer, [
        [m.total, `${m.total} is the total of a whole line. The ? box is only one of its three numbers.`],
        [knownInLast[0] + knownInLast[1], `That's the two numbers you know added together. Take them away from the total instead.`],
        ...(m.order.length > 1 ? ([[first.value, `${first.value} goes in a different box (the one you fill first). Now use it to find the ? box.`]] as [number, string][]) : [])
      ])
    };
  }
};

/* ---------------- rule machines ---------------- */

interface Rule { f: (x: number) => number; inv: (y: number) => number | null; text: string; steps: (x: number) => string; back: (y: number) => string }

function makeRule(rng: Rng, grade: number, level: number): Rule {
  const add = (k: number): Rule => ({ f: (x) => x + k, inv: (y) => y - k, text: `+ ${k}`, steps: (x) => `${x} + ${k} = ${x + k}`, back: (y) => `${y} − ${k} = ${y - k}` });
  const sub = (k: number): Rule => ({ f: (x) => x - k, inv: (y) => y + k, text: `− ${k}`, steps: (x) => `${x} − ${k} = ${x - k}`, back: (y) => `${y} + ${k} = ${y + k}` });
  const mul = (k: number): Rule => ({ f: (x) => x * k, inv: (y) => (y % k === 0 ? y / k : null), text: `× ${k}`, steps: (x) => `${x} × ${k} = ${x * k}`, back: (y) => `${y} ÷ ${k} = ${y / k}` });
  const two = (k: number, c: number, plus: boolean): Rule => ({
    f: (x) => x * k + (plus ? c : -c),
    inv: (y) => { const t = plus ? y - c : y + c; return t % k === 0 ? t / k : null; },
    text: `× ${k}, then ${plus ? '+' : '−'} ${c}`,
    steps: (x) => `${x} × ${k} = ${x * k}, then ${x * k} ${plus ? '+' : '−'} ${c} = ${x * k + (plus ? c : -c)}`,
    back: (y) => { const t = plus ? y - c : y + c; return `undo ${plus ? '+' : '−'} ${c}: ${y} ${plus ? '−' : '+'} ${c} = ${t}; undo × ${k}: ${t} ÷ ${k} = ${t / k}`; }
  });
  if (grade === 2) {
    if (level === 1) return rng.next() < 0.5 ? add(rng.int(3, 9)) : sub(rng.int(2, 6));
    if (level === 2) return rng.next() < 0.5 ? mul(rng.int(2, 3)) : add(rng.int(11, 19));
    return two(2, rng.int(1, 5), rng.next() < 0.6);
  }
  if (level === 1) return rng.next() < 0.5 ? mul(rng.int(2, 5)) : add(rng.int(12, 29));
  return two(rng.int(2, 5), rng.int(1, 9), rng.next() < 0.5);
}

export const ruleMachine: Topic = {
  id: 'rule-machine',
  title: 'Rule machines',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Find the rule',
  guide: {
    idea: 'A number goes in, the machine does the same thing to it every time, and a new number comes out. Find the rule that works for every pair, then use it. To find what went in, undo the steps in the opposite order.',
    tips: ['Guess a rule from the first pair, then check it on every pair.', 'If adding doesn\'t fit every pair, try times, or times-then-add.', 'Working backwards: undo the last step first.'],
    traps: ['A rule that fits only the first pair.', 'Continuing the list of outputs instead of using the rule.']
  },
  generate: ({ grade, level, rng }) => {
    const r = makeRule(rng, grade, level);
    const backwards = level === 3;
    const ins = until(() => Array.from({ length: 4 }, () => rng.int(grade === 2 ? 2 : 3, grade === 2 ? 12 : 15)), (xs) => new Set(xs).size === 4 && xs.every((x) => r.f(x) > 0));
    const pairs = ins.slice(0, 3).map((x) => [x, r.f(x)] as [number, number]);
    const x = ins[3];
    const y = r.f(x);
    const answer = backwards ? x : y;
    const table = pairs.map(([a, b]) => `${a} → ${b}`).join(', ');
    const outs = pairs.map((p) => p[1]);
    const nextInList = outs[2] + (outs[2] - outs[1]);
    return {
      scene: ruleScene(pairs, r.text, backwards ? { output: y } : { input: x }, answer, backwards ? r.back(y) : r.steps(x)),
      text: backwards
        ? `A rule machine changes every number the same way: ${table}. **${y}** came out. **What number went in?**`
        : `A rule machine changes every number the same way: ${table}. What comes out when **${x}** goes in?`,
      speech: backwards
        ? `A rule machine changes every number the same way. ${pairs.map(([a, b]) => `${a} becomes ${b}`).join('. ')}. ${y} came out. What number went in?`
        : `A rule machine changes every number the same way. ${pairs.map(([a, b]) => `${a} becomes ${b}`).join('. ')}. What comes out when ${x} goes in?`,
      answer: num(answer),
      hints: [
        'What happens to the first number? Check that the same rule works for the other pairs too.',
        `The rule is: ${r.text}.`,
        backwards ? 'Undo the rule: do the opposite steps, last step first.' : `Now do the rule to ${x}.`
      ],
      steps: [`Every pair fits the rule ${r.text}.`, backwards ? `Work backwards: ${r.back(y)}.` : r.steps(x)],
      misconceptions: misNum(answer, [
        [nextInList, 'That continues the list of outputs. Use the rule on the new number instead.'],
        ...(backwards ? ([[r.f(y), `That runs ${y} through the machine forwards. We need the number that went in.`]] as [number, string][]) : [])
      ])
    };
  }
};
