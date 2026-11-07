import { bars, brace, circle, fmt, hop, line, marker, numberLine, path, rect, rowLabel, scene, seg, spread, text, tick, W, type Shape } from './kit';

/** a − □ = b: the box is the jump from a back down to b. */
export function missingScene(a: number, b: number, follow?: { c: number }) {
  const s = scene();
  const box = a - b;
  const pad = Math.max(2, Math.round(box * 0.3));
  const nl = numberLine(s, b - pad, a + pad, [b, a]);
  s.add(text('q', W / 2, 30, `${a} − □ = ${b}`, { size: 24, weight: 700 }));
  s.step('Here is the puzzle. The box is a hidden number.');
  marker(s, nl, 'a', a, 'accent');
  s.step(`Start at ${a} on the number line.`);
  hop(s, nl, 'j', a, b, '− □');
  marker(s, nl, 'b', b, 'accent');
  s.step(`Taking away the box lands on ${b}.`);
  s.add(...brace('gap', nl.pos(b), nl.pos(a), nl.y + 40, '?'));
  s.step(`So the box is the gap between ${b} and ${a}.`);
  s.set('gap-t', { text: String(box), fill: 'good', size: 20, pulse: true }).set('j-l', { text: `− ${box}`, fill: 'good' }).set('q', { text: `${a} − ${box} = ${b}` });
  s.step(`${a} − ${b} = ${box}. The box is ${box}.`, { reveal: true });
  if (follow) {
    s.add(text('f', W / 2, 62, `${follow.c} + ${box} = ${follow.c + box}`, { size: 22, weight: 700, fill: 'good', pulse: true }));
    s.step(`Last step: ${follow.c} + ${box} = ${follow.c + box}.`, { reveal: true });
  }
  return s.build();
}

/** a − b = c + □: work out the left side, then find the jump from c up to it. */
export function balanceEqScene(a: number, b: number, c: number) {
  const s = scene();
  const left = a - b, box = left - c;
  const nl = numberLine(s, Math.min(c, left) - 3, a + 3, [a, left, c]);
  s.add(text('q', W / 2, 30, `${a} − ${b} = ${c} + □`, { size: 24, weight: 700 }));
  s.step('Both sides of the equals sign are worth the same.');
  marker(s, nl, 'a', a);
  hop(s, nl, 'j1', a, left, `− ${b}`, 's2');
  marker(s, nl, 'l', left, 's2');
  s.step(`First the left side: ${a} − ${b} = ${left}.`);
  marker(s, nl, 'c', c, 'accent');
  s.add(...brace('gap', nl.pos(c), nl.pos(left), nl.y + 40, '?'));
  s.step(`Now start at ${c}. How far up to ${left}?`);
  s.set('gap-t', { text: String(box), fill: 'good', size: 20, pulse: true }).set('q', { text: `${a} − ${b} = ${c} + ${box}` });
  s.step(`${left} − ${c} = ${box}. The box is ${box}.`, { reveal: true });
  return s.build();
}

/** Two results as bars; the difference is the extra piece. */
export function compareScene(e1: string, r1: number, e2: string, r2: number) {
  const s = scene();
  const b = bars(Math.max(r1, r2));
  rowLabel(s, 'l1', 60, e1);
  rowLabel(s, 'l2', 110, e2);
  s.step('Two problems. Work out each one first.');
  seg(s, 'b1', b, 0, r1, 60, 's1', fmt(r1));
  s.step(`${e1} = ${r1}.`);
  seg(s, 'b2', b, 0, r2, 110, 's2', fmt(r2));
  s.step(`${e2} = ${r2}.`);
  const lo = Math.min(r1, r2), hi = Math.max(r1, r2);
  s.add(rect('diff', b.x0 + b.px(lo), r1 > r2 ? 60 : 110, b.px(hi - lo), 30, { fill: 'none', stroke: 'good', sw: 3, dash: true, pulse: true }));
  s.add(...brace('d', b.x0 + b.px(lo), b.x0 + b.px(hi), 160, String(hi - lo), false, { fill: 'good' }));
  s.step(`The extra piece is ${hi} − ${lo} = ${hi - lo}.`, { reveal: true });
  return s.build();
}

/** Sum and difference: remove the extra, halve, add the extra back. */
export function sumDiffScene(small: number, d: number, names = ['larger', 'smaller']) {
  const s = scene();
  const large = small + d, sum = small + large;
  const b = bars(large, 92, W - 60);
  rowLabel(s, 'n1', 50, names[0]);
  rowLabel(s, 'n2', 100, names[1]);
  seg(s, 'L', b, 0, small, 50, 's1');
  seg(s, 'X', b, small, d, 50, 's2');
  seg(s, 'S', b, 0, small, 100, 's1');
  s.add(...brace('tot', b.x0 + b.px(large) + 14, b.x0 + b.px(large) + 14, 75, `${sum} in all`, false));
  s.set('tot-b', { d: 'M0 -40 H6 V40 H0', x: b.x0 + b.px(large) + 8, y: 90 }).set('tot-t', { x: b.x0 + b.px(large) + 20, y: 172, anchor: 'end' });
  s.step(`Two numbers that add to ${sum}.`);
  s.set('X', { pulse: true }).add(text('X-t', b.x0 + b.px(small + d / 2), 65, String(d), { size: 15, weight: 700 }));
  s.step(`One is ${d} more. That's the orange extra piece.`);
  s.set('X', { opacity: 0.25 }).set('X-t', { opacity: 0.25 }).set('tot-t', { text: `${sum} − ${d} = ${sum - d}` });
  s.step(`Take the extra away: ${sum} − ${d} = ${sum - d}. Now the bars are equal.`);
  s.add(text('L-t', b.x0 + b.px(small / 2), 65, String(small), { size: 15, weight: 700 }), text('S-t', b.x0 + b.px(small / 2), 115, String(small), { size: 15, weight: 700, pulse: true }));
  s.step(`Half of ${sum - d} is ${small}. That's the ${names[1]}.`, { reveal: true });
  s.set('X', { opacity: 1 }).set('X-t', { opacity: 1 }).add(text('ans', b.x0 + b.px(large) / 2, 30, `${small} + ${d} = ${large}`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`Put the extra back: ${small} + ${d} = ${large}, the ${names[0]}.`, { reveal: true });
  return s.build();
}

/** Points a away from x and b away from y; the one in both lists. */
export function distanceScene(n: number, a: number, x: number, b: number, y: number) {
  const s = scene();
  const vals = [x - a, x + a, y - b, y + b, x, y];
  const nl = numberLine(s, Math.min(...vals) - 2, Math.max(...vals) + 2, [x, y]);
  marker(s, nl, 'x', x, 'ink');
  marker(s, nl, 'y', y, 'ink');
  s.step(`We need a number ${a} away from ${x} and ${b} away from ${y}.`);
  hop(s, nl, 'xa', x, x - a, String(a), 's1');
  hop(s, nl, 'xb', x, x + a, String(a), 's1');
  tick(s, nl.pos, nl.y, x - a, fmt(x - a), 'muted');
  tick(s, nl.pos, nl.y, x + a, fmt(x + a), 'muted');
  s.step(`${a} away from ${x}: ${x - a} or ${x + a}.`);
  hop(s, nl, 'ya', y, y - b, String(b), 's2');
  hop(s, nl, 'yb', y, y + b, String(b), 's2');
  tick(s, nl.pos, nl.y, y - b, fmt(y - b), 'muted');
  tick(s, nl.pos, nl.y, y + b, fmt(y + b), 'muted');
  s.step(`${b} away from ${y}: ${y - b} or ${y + b}.`);
  marker(s, nl, 'n', n, 'good');
  s.set(`tl${n}`, { fill: 'good', weight: 700, pulse: true });
  s.step(`${n} is in both lists. That's the answer.`, { reveal: true });
  return s.build();
}

/** Twice as far from x as from y: cut the gap in three, and go one gap past y. */
export function twiceFarScene(x: number, y: number) {
  const s = scene();
  const gap = y - x, inner = x + (2 * gap) / 3, outer = y + gap;
  const nl = numberLine(s, x - 2, outer + 2, [x, y]);
  marker(s, nl, 'x', x, 'ink');
  marker(s, nl, 'y', y, 'ink');
  s.step(`Find numbers twice as far from ${x} as from ${y}.`);
  for (let k = 1; k <= 2; k++) s.add(line(`cut${k}`, nl.pos(x + (k * gap) / 3), nl.y - 14, 0, 28, { stroke: 'accent', sw: 2, draw: true }));
  s.step(`The gap is ${gap}. Cut it into 3 equal pieces of ${gap / 3}.`);
  marker(s, nl, 'i', inner, 'good', fmt(inner));
  s.add(...brace('i2', nl.pos(x), nl.pos(inner), nl.y - 40, `${(2 * gap) / 3}`, true), ...brace('i1', nl.pos(inner), nl.pos(y), nl.y - 40, `${gap / 3}`, true));
  s.step(`${inner} is 2 pieces from ${x} and 1 piece from ${y}.`, { reveal: true });
  s.remove('i2*', 'i1*');
  marker(s, nl, 'o', outer, 'good', fmt(outer));
  hop(s, nl, 'oh', y, outer, String(gap), 'good');
  s.step(`Go past ${y} by the whole gap: ${outer} is ${gap} from ${y} and ${2 * gap} from ${x}.`, { reveal: true });
  return s.build();
}

/** Next number ending in 00 (or 000): jump up to the next hundred. */
export function roundUpScene(n: number, ans: number, unit: number) {
  const s = scene();
  const nl = numberLine(s, ans - unit, ans + unit * 0.15, [ans - unit, ans]);
  marker(s, nl, 'n', n, 'accent', fmt(n));
  s.step(`${fmt(n)} sits between ${fmt(ans - unit)} and ${fmt(ans)}.`);
  hop(s, nl, 'h', n, ans, `+${fmt(ans - n)}`, 'good');
  s.set(`tl${ans}`, { fill: 'good', weight: 700, pulse: true });
  s.step(`The next number ending in ${unit === 100 ? '00' : '000'} after it is ${fmt(ans)}.`, { reveal: true });
  return s.build();
}

/** Thermometer: down to zero, then past it. */
export function temperatureScene(above: number, below: number, falling: boolean) {
  const s = scene();
  const nl = numberLine(s, -below - 2, above + 2, [-below, 0, above]);
  s.set(`tl${-below}`, { text: `${below}° below` }).set('tl0', { text: '0°', fill: 'ink', weight: 700 }).set(`tl${above}`, { text: `${above}°` });
  const [from, to] = falling ? [above, -below] : [-below, above];
  marker(s, nl, 'a', from, 'accent');
  s.step(falling ? `It starts at ${above}°.` : `It starts at ${below}° below zero.`);
  hop(s, nl, 'h1', from, 0, `${Math.abs(from)}°`, 's1');
  s.step(`${falling ? 'Down' : 'Up'} to zero is ${Math.abs(from)}°.`);
  hop(s, nl, 'h2', 0, to, `${Math.abs(to)}°`, 's2');
  marker(s, nl, 'b', to, 'accent');
  s.step(`Then ${Math.abs(to)}° more past zero.`);
  s.add(text('ans', W / 2, 40, `${above} + ${below} = ${above + below}°`, { size: 22, weight: 700, fill: 'good', pulse: true }));
  s.step(`Add the two parts: ${above + below}°.`, { reveal: true });
  return s.build();
}

/** Depth: raising the lab makes it less deep. */
export function depthScene(depth: number, up: number) {
  const s = scene();
  const top = 30, bottom = 190, y = (d: number) => top + (d / depth) * (bottom - top);
  s.add(line('sea', 30, top, W - 60, 0, { stroke: 's1', sw: 3 }), text('sl', W - 22, top, 'surface', { size: 13, fill: 'muted', anchor: 'end' }));
  s.add(rect('lab', 150, y(depth) - 14, 60, 24, { fill: 's2', stroke: 's2' }), text('d', 230, y(depth), `${fmt(depth)} ft`, { anchor: 'start', size: 15 }));
  s.step(`The lab is ${fmt(depth)} feet below the surface.`);
  s.set('lab', { y: y(depth - up) - 14 }).set('d', { y: y(depth - up), text: `${fmt(depth - up)} ft`, fill: 'good', pulse: true });
  s.add(path('up', 180, y(depth), `M0 0 V${-(y(depth) - y(depth - up)) + 14}`, { stroke: 'accent', draw: true }));
  s.step(`Raised ${fmt(up)} feet: ${fmt(depth)} − ${fmt(up)} = ${fmt(depth - up)} feet below.`, { reveal: true });
  return s.build();
}

/** Pattern: dots with the jump between each pair. */
export function patternScene(nums: number[], ask: string, answer: number, intruder?: number) {
  const s = scene();
  const xs = spread(nums.length + (intruder === undefined ? 1 : 0), 34, W - 34);
  nums.forEach((v, i) => s.add(circle(`p${i}`, xs[i], 120, 20, { fill: 'fill', stroke: 'line' }), text(`p${i}-t`, xs[i], 120, v, { size: 16, weight: 700 })));
  s.step('Look at how the numbers change.');
  for (let i = 1; i < nums.length; i++) {
    if (intruder !== undefined && (nums[i] === intruder || nums[i - 1] === intruder)) continue;
    s.add(...arcText(`j${i}`, xs[i - 1], xs[i], `+${nums[i] - nums[i - 1]}`));
  }
  s.step(intruder === undefined ? 'Write the jump between each pair.' : 'Most jumps are the same size.');
  if (intruder !== undefined) {
    const i = nums.indexOf(intruder);
    s.set(`p${i}`, { stroke: 'bad', sw: 3, pulse: true }).set(`p${i}-t`, { fill: 'bad' });
    s.step(`${intruder} breaks the pattern. It doesn't belong.`, { reveal: true });
  } else {
    const k = nums.length;
    s.add(circle(`p${k}`, xs[k], 120, 20, { fill: 'good', stroke: 'good', pulse: true }), text(`p${k}-t`, xs[k], 120, answer, { size: 16, weight: 700, fill: 'fill' }));
    s.add(...arcText(`j${k}`, xs[k - 1], xs[k], `+${answer - nums[k - 1]}`, 'good'));
    s.step(`${ask} ${nums[k - 1]} + ${answer - nums[k - 1]} = ${answer}.`, { reveal: true });
  }
  return s.build();
}

/** Little hop between two pattern dots, with the jump written above. */
function arcText(id: string, x1: number, x2: number, label: string, role: 'accent' | 'good' = 'accent'): Shape[] {
  return [
    path(id, x1 + 14, 98, `M0 0 Q${(x2 - x1 - 28) / 2} -26 ${x2 - x1 - 28} 0`, { stroke: role, draw: true }),
    text(`${id}-l`, (x1 + x2) / 2, 70, label, { size: 14, fill: role, weight: 700 })
  ];
}

/** "Who am I?": filter a list of numbers clue by clue. */
export function riddleScene(cands: number[], groups: number, left: number, digitSum: number, answer: number) {
  const s = scene();
  const show = cands.slice(0, 18);
  const xs = (i: number) => 28 + (i % 6) * 60;
  const ys = (i: number) => 50 + Math.floor(i / 6) * 50;
  show.forEach((v, i) => s.add(rect(`c${i}`, xs(i) - 22, ys(i) - 16, 44, 32, { fill: 'fill', stroke: 'line' }), text(`c${i}-t`, xs(i), ys(i), v, { size: 16, weight: 600 })));
  s.step(`Numbers that make groups of ${groups} with ${left} left over.`);
  const sum = (v: number) => String(v).split('').reduce((a, d) => a + +d, 0);
  show.forEach((v, i) => {
    if (sum(v) !== digitSum) s.set(`c${i}`, { opacity: 0.25 }).set(`c${i}-t`, { opacity: 0.25 });
  });
  s.step(`Keep only those whose digits add to ${digitSum}.`);
  const k = show.indexOf(answer);
  if (k >= 0) s.set(`c${k}`, { fill: 'good', stroke: 'good', pulse: true }).set(`c${k}-t`, { fill: 'fill' });
  s.step(`${answer} is the only one left.`, { reveal: true });
  return s.build();
}

/** Count a digit: ones place first, then tens place. */
export function digitScene(start: number, end: number, d: number, ones: number, tens: number) {
  const s = scene();
  const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const cols = 10, cw = 34, ch = 22, x0 = 22, y0 = 26;
  nums.forEach((v, i) => s.add(text(`n${v}`, x0 + (i % cols) * cw + cw / 2, y0 + Math.floor(i / cols) * ch, v, { size: 12, weight: 500, fill: 'muted' })));
  s.step(`All the numbers from ${start} to ${end}.`);
  nums.forEach((v) => v % 10 === d && s.set(`n${v}`, { fill: 's1', weight: 800 }));
  s.add(text('c1', W / 2, 206, `ones place: ${ones}`, { size: 16, fill: 's1', weight: 700 }));
  s.step(`${d} in the ones place: ${ones} times.`);
  nums.forEach((v) => Math.floor(v / 10) % 10 === d && s.set(`n${v}`, { fill: v % 10 === d ? 'good' : 's2', weight: 800 }));
  s.set('c1', { text: `ones ${ones} + tens ${tens} = ${ones + tens}`, fill: 'good', pulse: true });
  s.step(`${d} in the tens place: ${tens} more. ${d}${d} counts twice. Total ${ones + tens}.`, { reveal: true });
  return s.build();
}

/** Multiply to P and add to S: list the factor pairs, find the one. */
export function factorScene(prod: number, sum: number, a: number, b: number) {
  const s = scene();
  const pairs: [number, number][] = [];
  for (let i = 1; i * i <= prod; i++) if (prod % i === 0) pairs.push([i, prod / i]);
  s.add(text('q', W / 2, 26, `× = ${prod}   + = ${sum}`, { size: 20, weight: 700 }));
  s.step(`List pairs that multiply to ${prod}.`);
  pairs.forEach(([x, y], i) => s.add(text(`p${i}`, W / 2, 62 + i * 26, `${x} × ${y}`, { size: 17, weight: 600 })));
  s.step('Here are all the pairs.');
  pairs.forEach(([x, y], i) => s.set(`p${i}`, { text: `${x} × ${y}  →  ${x} + ${y} = ${x + y}`, fill: x + y === sum ? 'good' : 'muted', pulse: x + y === sum }));
  s.step(`Add each pair. ${Math.min(a, b)} and ${Math.max(a, b)} add to ${sum}.`, { reveal: true });
  return s.build();
}

