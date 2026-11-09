/** CogAT-style Quantitative Battery: number analogies, number puzzles, number series (original items). */
import type { Grade, Topic } from '../../core/types';
import type { Rng } from '../../core/rng';
import { SceneBuilder, arc, brace, rect, text } from '../../core/scene';
import { bars, seg } from '../scenes/kit';
import { choicesFor, mc, retry } from './common';
import { dotsMarkup, dotsSvg, rodMarkup, rodSvg, svgBox } from './figures';

const W = 360, H = 220;
const nKey = (n: number) => String(n);
const dotsName = (n: number) => `${n} dot${n === 1 ? '' : 's'}`;
const beadName = (n: number) => `${n} bead${n === 1 ? '' : 's'}`;
const ok = (n: number, max = 99) => Number.isInteger(n) && n >= 0 && n <= max;

/* ======================= number analogies ======================= */

interface Rule { id: string; f: (x: number) => number; words: string; short: string }
const add = (k: number): Rule => ({ id: `+${k}`, f: (x) => x + k, words: `add ${k}`, short: `+ ${k}` });
const sub = (k: number): Rule => ({ id: `-${k}`, f: (x) => x - k, words: `take away ${k}`, short: `− ${k}` });
const times = (k: number): Rule => ({ id: `x${k}`, f: (x) => x * k, words: k === 2 ? 'double it' : `multiply by ${k}`, short: `× ${k}` });
const half: Rule = { id: '/2', f: (x) => x / 2, words: 'take half', short: '÷ 2' };
const ALL_RULES: Rule[] = [...Array.from({ length: 12 }, (_, i) => add(i + 1)), ...Array.from({ length: 12 }, (_, i) => sub(i + 1)), times(2), times(3), times(4), times(10), half];

function analogyFigure(pairs: [number, number | null][], grade: Grade): string {
  if (grade === 3) {
    const w = 104;
    return svgBox(pairs.length * (w + 10) + 10, 64, pairs.map(([a, b]) => `${a} becomes ${b ?? 'what'}`).join('; '), pairs.map(([a, b], i) => {
      const x = 10 + i * (w + 10);
      return `<rect x="${x}" y="10" width="${w}" height="44" rx="8" stroke-width="2"/><text x="${x + w / 2}" y="40" text-anchor="middle" font-size="22" font-weight="700" fill="currentColor" stroke="none">${a} → ${b ?? '?'}</text>`;
    }).join(''));
  }
  const bw = 80, rowH = 70;
  return svgBox(2 * bw + 60, pairs.length * rowH + 10, pairs.map(([a, b]) => `${a} dots become ${b ?? 'how many'}`).join('; '), pairs.map(([a, b], i) => {
    const y = 8 + i * rowH;
    const box = (x: number, n: number | null) => `<rect x="${x}" y="${y}" width="${bw}" height="${rowH - 10}" rx="8" stroke-width="2" ${n === null ? 'stroke-dasharray="5 5"' : ''}/>` +
      (n === null ? `<text x="${x + bw / 2}" y="${y + rowH / 2 + 4}" text-anchor="middle" font-size="26" font-weight="700" fill="currentColor" stroke="none">?</text>` : dotsMarkup(n, x + 12, y + (rowH - 10) / 2 - (Math.ceil(n / 5) - 1) * 7));
    return box(4, a) + `<path d="M${bw + 12} ${y + rowH / 2 - 5} h36 m-7 -6 l7 6 l-7 6" stroke-width="2.5"/>` + box(bw + 56, b);
  }).join(''));
}

function analogyScene(pairs: [number, number][], q: number, rule: Rule, ans: number) {
  const s = new SceneBuilder(W, H);
  const rowY = (i: number) => 40 + i * 60;
  [...pairs, [q, NaN] as [number, number]].forEach(([a, b], i) => {
    s.add(rect(`l${i}`, 60, rowY(i) - 22, 70, 44, { fill: 'fill', stroke: 'line', rx: 8 }), text(`a${i}`, 95, rowY(i), a, { size: 22, weight: 700 }));
    s.add(text(`ar${i}`, 165, rowY(i), '→', { size: 22, fill: 'muted' }));
    s.add(rect(`r${i}`, 200, rowY(i) - 22, 70, 44, { fill: 'fill', stroke: 'line', rx: 8, dash: Number.isNaN(b) }), text(`b${i}`, 235, rowY(i), Number.isNaN(b) ? '?' : b, { size: 22, weight: 700, fill: Number.isNaN(b) ? 'muted' : 'ink' }));
  });
  s.step('Each number on the left becomes the number on the right, by the same rule.');
  s.set('l0', { stroke: 'accent', sw: 3 }).set('r0', { stroke: 'accent', sw: 3 });
  s.add(text('t0', 315, rowY(0), rule.short, { size: 18, weight: 700, fill: 'accent', pulse: true }));
  s.step(`${pairs[0][0]} becomes ${pairs[0][1]}. ${rule.words[0].toUpperCase()}${rule.words.slice(1)}?`);
  s.set('l0', { stroke: 'line', sw: 1.5 }).set('r0', { stroke: 'line', sw: 1.5 }).set('l1', { stroke: 'accent', sw: 3 }).set('r1', { stroke: 'accent', sw: 3 });
  s.add(text('t1', 315, rowY(1), rule.short, { size: 18, weight: 700, fill: 'accent', pulse: true }));
  s.step(`Check the second pair: ${pairs[1][0]} ${rule.short} = ${pairs[1][1]}. The rule works for both.`);
  s.set('l1', { stroke: 'line', sw: 1.5 }).set('r1', { stroke: 'line', sw: 1.5 }).set('r2', { stroke: 'good', sw: 3, dash: false });
  s.set('b2', { text: String(ans), fill: 'good', pulse: true }).add(text('t2', 315, rowY(2), rule.short, { size: 18, weight: 700, fill: 'good' }));
  s.step(`So ${q} ${rule.short} = ${ans}.`, { reveal: true });
  return s.build();
}

export const numberAnalogies: Topic = {
  id: 'cogat-number-analogies',
  title: 'Number analogies',
  category: 'Quantitative',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Find the rule',
  guide: {
    idea: 'The first two pairs follow the same rule, like "add 3" or "double it". Find a rule that works for BOTH pairs, then use it on the last number.',
    tips: ['Is the second number bigger or smaller? That tells you add/multiply or take away/halve.', 'Test your rule on the second pair before you trust it.', 'Doubling and "add the same number" can look alike on one pair. Check both!'],
    traps: ['Using a rule that only fits the first pair.']
  },
  generate: ({ grade, rng }) => retry(() => {
    const pool: Rule[] = grade === 2 ? [add(1), add(2), add(3), add(4), sub(1), sub(2), sub(3), times(2)] : [add(rng.int(2, 9)), sub(rng.int(2, 9)), times(2), times(3), half, times(10), add(rng.int(10, 12))];
    const rule = rng.pick(pool);
    const max = grade === 2 ? 10 : 99;
    const ins = rng.sample(Array.from({ length: grade === 2 ? 10 : 19 }, (_, i) => i + (grade === 2 ? 1 : 2)), 3);
    const outs = ins.map(rule.f);
    if (!outs.every((v) => ok(v, max) && v > 0) || ins.some((v, i) => v === outs[i])) return null;
    const [a, b, c] = ins;
    const ans = rule.f(c);
    // unique: every rule that fits both pairs gives the same answer
    const fits = ALL_RULES.filter((r) => r.f(a) === outs[0] && r.f(b) === outs[1]);
    if (fits.some((r) => r.f(c) !== ans)) return null;
    const firstOnly = ALL_RULES.filter((r) => r.f(a) === outs[0] && r.f(b) !== outs[1]).map((r) => r.f(c));
    const wrong = [...firstOnly, ans + 1, ans - 1, c, ans + 2, ans - 2, outs[1], ans + 10].filter((v) => ok(v, max) && v > 0);
    const m = mc(rng, ans, wrong, choicesFor(grade), nKey, grade === 2 ? dotsName : String, grade === 2 ? dotsSvg : undefined);
    if (!m) return null;
    const pairs: [number, number][] = [[a, outs[0]], [b, outs[1]]];
    return {
      text: grade === 2 ? 'The dots change the same way in each row. Which box goes with the last one?' : 'The numbers in each pair go together in the same way. Which number goes with the last one?',
      speech: grade === 2
        ? `${a} dots becomes ${outs[0]} dots. ${b} dots becomes ${outs[1]} dots. ${c} dots becomes how many?`
        : `${a} goes with ${outs[0]}. ${b} goes with ${outs[1]}. What goes with ${c}?`,
      figure: analogyFigure([...pairs, [c, null]], grade),
      answer: m.answer,
      hints: [`How do you get from ${a} to ${outs[0]}?`, `Does the same rule turn ${b} into ${outs[1]}? The rule is: ${rule.words}.`],
      steps: [`${a} ${rule.short} = ${outs[0]} and ${b} ${rule.short} = ${outs[1]}: the rule is ${rule.words}.`, `${c} ${rule.short} = ${ans}.`],
      misconceptions: firstOnly.flatMap((v) => m.miss(v, 'That rule works for the first pair, but check the second pair: it does not work there.')),
      scene: analogyScene(pairs, c, rule, ans)
    };
  })
};

/* ======================= number puzzles ======================= */

function puzzleScene(left: [number, number], right: number, ans: number, eq: string) {
  const s = new SceneBuilder(W, H);
  const total = left[0] + left[1];
  const b = bars(total, 60, W - 30);
  s.add(text('eq', W / 2, 26, eq, { size: 22, weight: 700 }));
  seg(s, 'L1', b, 0, left[0], 70, 's1', String(left[0]));
  seg(s, 'L2', b, left[0], left[1], 70, 's1', String(left[1]));
  seg(s, 'R1', b, 0, right, 130, 's2', String(right));
  s.add(rect('R2', b.x0 + b.px(right), 130, Math.max(2, b.px(ans)), 30, { fill: 'none', stroke: 'muted', dash: true, rx: 4 }), text('R2-t', b.x0 + b.px(right) + b.px(ans) / 2, 145, '?', { size: 16, weight: 700, fill: 'muted' }));
  s.step('Both sides must be the same amount, like two bars of the same length.');
  s.add(...brace('tot', b.x0, b.x0 + b.px(total), 62, `${left[0]} + ${left[1]} = ${total}`, true, { fill: 'accent' }));
  s.step(`The side we know: ${left[0]} + ${left[1]} = ${total}.`);
  s.add(...brace('need', b.x0 + b.px(right), b.x0 + b.px(total), 168, `${total} − ${right}`, false));
  s.step(`The other side has ${right}. It still needs ${total} − ${right}.`);
  s.set('R2', { fill: 'good', stroke: 'good', dash: false }).set('R2-t', { text: String(ans), fill: 'ink', pulse: true });
  s.step(`${total} − ${right} = ${ans}.`, { reveal: true });
  return s.build();
}

export const numberPuzzles: Topic = {
  id: 'cogat-number-puzzles',
  title: 'Number puzzles',
  category: 'Quantitative',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Write a number sentence',
  guide: {
    idea: 'An equals sign means both sides are the same amount. Work out the side you know, then find what the "?" must be to match it.',
    tips: ['Add up the side with no "?" first.', 'Then ask: what number makes the other side the same?', 'Check by putting your answer in.'],
    traps: ['Answering with the total instead of the missing part.']
  },
  generate: ({ grade, rng }) => retry(() => {
    const max = grade === 2 ? 10 : 40;
    const a = rng.int(1, grade === 2 ? 5 : 19), b = rng.int(1, grade === 2 ? 5 : 19), total = a + b;
    if (total > max) return null;
    const c = rng.int(1, total - 1), ans = total - c;
    if (c === a || c === b) return null; // "1 + ? = 1 + 17" is a giveaway
    const form = grade === 2 ? 0 : rng.int(0, 2);
    const eq = form === 0 ? `${c} + ? = ${a} + ${b}` : form === 1 ? `? + ${c} = ${a} + ${b}` : `${a} + ${b} − ${c} = ?`;
    const wrong = [total, total + c, ans + 1, ans - 1, c, a, b, ans + 2].filter((v) => v > 0 && v <= max + 10);
    const m = mc(rng, ans, wrong, choicesFor(grade), nKey, grade === 2 ? dotsName : String, grade === 2 ? dotsSvg : undefined);
    if (!m) return null;
    const figure = grade === 2
      ? svgBox(250, 170, `${a} and ${b} dots on top, ${c} dots and a missing box below`,
        `<rect x="6" y="6" width="238" height="74" rx="10" stroke-width="2"/><rect x="6" y="90" width="238" height="74" rx="10" stroke-width="2"/>` +
        dotsMarkup(a, 22, 36 - (Math.ceil(a / 5) - 1) * 7) + `<text x="125" y="51" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor" stroke="none">+</text>` + dotsMarkup(b, 150, 36 - (Math.ceil(b / 5) - 1) * 7) +
        dotsMarkup(c, 22, 120 - (Math.ceil(c / 5) - 1) * 7) + `<text x="125" y="135" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor" stroke="none">+</text><rect x="150" y="100" width="76" height="54" rx="8" stroke-dasharray="5 5" stroke-width="2"/><text x="188" y="136" text-anchor="middle" font-size="26" font-weight="700" fill="currentColor" stroke="none">?</text>`)
      : svgBox(300, 64, eq, `<text x="150" y="42" text-anchor="middle" font-size="28" font-weight="700" fill="currentColor" stroke="none">${eq}</text>`);
    return {
      text: grade === 2 ? 'The bottom row needs the same number of dots as the top row. Which box makes them the same?' : `What number goes in place of the "?" ${form === 2 ? '' : 'to make both sides equal'}?`,
      speech: grade === 2 ? `The top row has ${a} dots and ${b} dots. The bottom row has ${c} dots and a missing box. Which box gives the bottom row the same number of dots?` : eq.replace('?', 'what').replace('−', 'minus').replace(/\+/g, 'plus').replace('=', 'equals'),
      figure,
      answer: m.answer,
      hints: [`Add the side you know: ${a} + ${b}.`, `${a} + ${b} = ${total}. What do you add to ${c} to get ${total}?`],
      steps: [`${a} + ${b} = ${total}.`, `${c} + ${ans} = ${total}, so ? = ${ans}.`],
      misconceptions: m.miss(total, `${total} is the whole side. The question mark is only the missing part: ${total} − ${c}.`),
      scene: puzzleScene([a, b], c, ans, grade === 2 ? `${a} + ${b} = ${c} + ?` : eq)
    };
  })
};

/* ======================= number series ======================= */

interface Series { terms: number[]; next: number; say: string; diffs?: string[]; group?: number }

function makeSeries(rng: Rng, grade: Grade): Series | null {
  const kind = grade === 2 ? rng.pick(['up', 'down', 'repeat2', 'up2']) : rng.pick(['up', 'down', 'alt', 'grow', 'double', 'repeat3']);
  const n = grade === 2 ? 5 : 6;
  const terms: number[] = [];
  switch (kind) {
    case 'up': case 'up2': case 'down': {
      const k = grade === 2 ? (kind === 'up2' ? 2 : 1) : rng.int(2, 9);
      const step = kind === 'down' ? -k : k;
      const start = kind === 'down' ? rng.int(grade === 2 ? 6 : 40, grade === 2 ? 9 : 90) : rng.int(1, grade === 2 ? 2 : 30);
      for (let i = 0; i <= n; i++) terms.push(start + i * step);
      return { terms: terms.slice(0, n), next: terms[n], say: `${step > 0 ? 'Add' : 'Take away'} ${k} each time.`, diffs: Array(n).fill(step > 0 ? `+${k}` : `−${k}`) };
    }
    case 'alt': {
      const up = rng.int(3, 9), down = rng.int(1, up - 1);
      let v = rng.int(2, 20);
      for (let i = 0; i <= n; i++) { terms.push(v); v += i % 2 ? -down : up; }
      return { terms: terms.slice(0, n), next: terms[n], say: `Add ${up}, then take away ${down}, again and again.`, diffs: Array.from({ length: n }, (_, i) => (i % 2 ? `−${down}` : `+${up}`)) };
    }
    case 'grow': {
      let v = rng.int(1, 10);
      const k0 = rng.int(1, 2);
      for (let i = 0; i <= n; i++) { terms.push(v); v += k0 + i; }
      return { terms: terms.slice(0, n), next: terms[n], say: `The jumps grow by one each time: +${k0}, +${k0 + 1}, +${k0 + 2}…`, diffs: Array.from({ length: n }, (_, i) => `+${k0 + i}`) };
    }
    case 'double': {
      let v = rng.int(1, 3);
      for (let i = 0; i <= 5; i++) { terms.push(v); v *= 2; }
      return { terms: terms.slice(0, 5), next: terms[5], say: 'Each number is double the one before.', diffs: Array(5).fill('×2') };
    }
    case 'repeat2': case 'repeat3': {
      const len = kind === 'repeat2' ? 2 : 3;
      const block = rng.sample(Array.from({ length: grade === 2 ? 8 : 30 }, (_, i) => i + 1), len);
      for (let i = 0; i <= n; i++) terms.push(block[i % len]);
      return { terms: terms.slice(0, n), next: terms[n], say: `The pattern ${block.join(', ')} repeats.`, group: len };
    }
  }
  return null;
}

function seriesScene(sr: Series, beads: boolean) {
  const s = new SceneBuilder(W, H);
  const all = [...sr.terms, sr.next];
  const gap = (W - 40) / all.length, x = (i: number) => 20 + gap * (i + 0.5), y = 120;
  all.forEach((v, i) => {
    const last = i === all.length - 1;
    s.add(rect(`b${i}`, x(i) - 20, y - 20, 40, 40, { fill: 'fill', stroke: last ? 'muted' : 'line', dash: last, rx: 8 }), text(`v${i}`, x(i), y, last ? '?' : v, { size: 18, weight: 700, fill: last ? 'muted' : 'ink' }));
  });
  s.step(beads ? 'Count the beads on each rod.' : 'Look at how the numbers change from one to the next.');
  if (sr.diffs) {
    sr.terms.slice(1).forEach((_, i) => s.add(arc(`h${i}`, x(i) + 6, x(i + 1) - 6, y - 24, { stroke: 'accent' }), text(`d${i}`, (x(i) + x(i + 1)) / 2, y - 64, sr.diffs![i], { size: 14, weight: 700, fill: 'accent' })));
    s.step(sr.say);
  } else {
    for (let g = 0; g * sr.group! < sr.terms.length; g++) {
      const i0 = g * sr.group!, i1 = Math.min(sr.terms.length, i0 + sr.group!) - 1;
      s.add(...brace(`g${g}`, x(i0) - 18, x(i1) + 18, y + 30, '', false, { stroke: g % 2 ? 's2' : 's1' }));
    }
    s.step(sr.say);
  }
  const k = all.length - 1;
  if (sr.diffs) s.add(arc(`h${k}`, x(k - 1) + 6, x(k) - 6, y - 24, { stroke: 'good' }), text(`d${k}`, (x(k - 1) + x(k)) / 2, y - 64, sr.diffs[k - 1], { size: 14, weight: 700, fill: 'good' }));
  s.set(`b${k}`, { stroke: 'good', sw: 3, dash: false }).set(`v${k}`, { text: String(sr.next), fill: 'good', pulse: true });
  s.step(`The next one is ${sr.next}${beads ? ' beads' : ''}.`, { reveal: true });
  return s.build();
}

export const numberSeries: Topic = {
  id: 'cogat-number-series',
  title: 'Number series',
  category: 'Quantitative',
  track: 'cogat',
  grades: [2, 3],
  strategy: 'Look for a pattern',
  guide: {
    idea: 'Find how each number (or each rod of beads) changes to the next one. Then keep the pattern going one more step.',
    tips: ['Write the jump between each pair: +2, +2, +2…', 'Jumps can take turns (+5, −2, +5, −2) or grow (+1, +2, +3).', 'Some patterns just repeat: 3, 7, 3, 7…'],
    traps: ['Only looking at the last two numbers.']
  },
  generate: ({ grade, rng }) => retry(() => {
    const sr = makeSeries(rng, grade);
    if (!sr || sr.next < 0 || (grade === 2 && (sr.next > 9 || sr.terms.some((t) => t > 9 || t < 0)))) return null;
    const last = sr.terms[sr.terms.length - 1], prev = sr.terms[sr.terms.length - 2];
    const wrong = [last + (last - prev), last, sr.next + 1, sr.next - 1, sr.terms[0], prev, sr.next + 2].filter((v) => v >= 0 && (grade === 3 || v <= 9));
    const m = mc(rng, sr.next, wrong, choicesFor(grade), nKey, grade === 2 ? beadName : String, grade === 2 ? rodSvg : undefined);
    if (!m) return null;
    const figure = grade === 2
      ? svgBox(sr.terms.length * 46 + 64, 136, `rods with ${sr.terms.join(', ')} beads, then a missing rod`,
        sr.terms.map((t, i) => rodMarkup(t, 26 + i * 46, 6, 118)).join('') + `<line x1="4" y1="124" x2="${sr.terms.length * 46 + 60}" y2="124"/><text x="${26 + sr.terms.length * 46}" y="80" text-anchor="middle" font-size="28" font-weight="700" fill="currentColor" stroke="none">?</text>`)
      : svgBox(sr.terms.length * 50 + 60, 56, `${sr.terms.join(', ')}, what comes next`,
        [...sr.terms, '?'].map((t, i) => `<rect x="${6 + i * 50}" y="8" width="44" height="40" rx="8" stroke-width="2" ${t === '?' ? 'stroke-dasharray="5 5"' : ''}/><text x="${28 + i * 50}" y="35" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor" stroke="none">${t}</text>`).join(''));
    return {
      text: grade === 2 ? 'The beads on the rods follow a pattern. Which rod comes next?' : 'What number comes next?',
      speech: grade === 2 ? `The rods have ${sr.terms.join(', ')} beads. Which rod comes next?` : `${sr.terms.join(', ')}. What number comes next?`,
      figure,
      answer: m.answer,
      hints: ['How does each one change to the next?', sr.say],
      steps: [sr.say, `Next: ${sr.next}.`],
      misconceptions: sr.diffs && sr.diffs[0] !== sr.diffs[1] ? m.miss(last + (last - prev), 'That repeats the last jump. Look at the jumps in order: they follow their own pattern.') : [],
      scene: seriesScene(sr, grade === 2)
    };
  })
};
