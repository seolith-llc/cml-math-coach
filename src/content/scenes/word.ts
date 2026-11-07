import { bars, brace, circle, hop, line, marker, money, numberLine, path, rect, rowLabel, scene, seg, spread, text, W } from './kit';

/** Ages: n people each grow by 1 a year, so the total grows by n a year. */
export function agesYearsScene(names: string[], ages: number[], yrs: number, total: number) {
  const s = scene();
  const b = bars(Math.max(...ages) + yrs);
  const now = ages.reduce((a, x) => a + x, 0);
  names.forEach((n, i) => {
    rowLabel(s, `n${i}`, 40 + i * 44, n);
    seg(s, `a${i}`, b, 0, ages[i], 40 + i * 44, 's1', String(ages[i]));
  });
  s.add(text('sum', W / 2, 190, `now: ${now} together`, { size: 17 }));
  s.step(`Right now their ages add to ${now}.`);
  names.forEach((_, i) => seg(s, `g${i}`, b, ages[i], 1, 40 + i * 44, 's2'));
  s.set('sum', { text: `+${names.length} each year` });
  s.step(`Each year every one of them is 1 older, so the total grows by ${names.length}.`);
  s.set('sum', { text: `${total} − ${now} = ${total - now} more needed` });
  s.step(`We need ${total} − ${now} = ${total - now} more.`);
  names.forEach((_, i) => seg(s, `g${i}`, b, ages[i], yrs, 40 + i * 44, 's2', `+${yrs}`));
  s.set('sum', { text: `${total - now} ÷ ${names.length} = ${yrs} years`, fill: 'good', pulse: true });
  s.step(`${total - now} ÷ ${names.length} = ${yrs} years.`, { reveal: true });
  return s.build();
}

/** Timeline: the sibling's age now, the child's age then, now and later. */
export function agesTimelineScene(x: string, sib: number, ago: number, later: number) {
  const s = scene();
  const now = sib + ago;
  const nl = numberLine(s, sib - 2, now + later + 2, [sib, now, now + later]);
  marker(s, nl, 'b', sib, 's2');
  s.add(text('bl', nl.pos(sib), nl.y - 40, 'brother now', { size: 13, fill: 'muted' }));
  s.step(`The brother is ${sib} now.`);
  s.add(text('xl', nl.pos(sib), nl.y - 58, `${x}, ${ago} yr ago`, { size: 13, fill: 's1' }));
  s.step(`${ago} year${ago > 1 ? 's' : ''} ago, ${x} was ${sib}.`);
  hop(s, nl, 'h1', sib, now, `+${ago}`, 's1');
  marker(s, nl, 'x', now, 's1');
  s.step(`So ${x} is ${sib} + ${ago} = ${now} now.`);
  hop(s, nl, 'h2', now, now + later, `+${later}`, 'good');
  marker(s, nl, 'f', now + later, 'good');
  s.step(`In ${later} years: ${now} + ${later} = ${now + later}.`, { reveal: true });
  return s.build();
}

/** Moving people between rooms until one has twice the other. */
export function transferScene(a: number, b: number, f: number, k: number) {
  const s = scene();
  const total = a + b;
  const bb = bars(Math.max(a, b, 2 * f));
  rowLabel(s, 'ra', 50, 'Room A');
  rowLabel(s, 'rb', 110, 'Room B');
  seg(s, 'A', bb, 0, a, 50, 's1', String(a));
  seg(s, 'B', bb, 0, b, 110, 's2', String(b));
  s.step(`Room A has ${a}, Room B has ${b}. ${total} people in all.`);
  s.add(text('t', W / 2, 180, `${total} ÷ 3 = ${f}`, { size: 18 }));
  s.step(`Twice as many means 3 equal parts: ${total} ÷ 3 = ${f}. A gets 1 part, B gets 2.`);
  s.remove('A', 'A-t');
  seg(s, 'A', bb, 0, f, 50, 's1', String(f));
  seg(s, 'mv', bb, f, k, 50, 'accent', `${k}`);
  s.step(`Room A must end with ${f}, so ${a} − ${f} = ${k} people move.`);
  s.set('mv', { y: 110, x: bb.x0 + bb.px(b) }).set('mv-t', { y: 125, x: bb.x0 + bb.px(b + k / 2) });
  s.set('t', { text: `${f} and ${2 * f}: twice as many ✓`, fill: 'good', pulse: true });
  s.step(`Move ${k}. Now A has ${f} and B has ${2 * f}.`, { reveal: true });
  return s.build();
}

/** Giving marbles: one side loses, the other gains. */
export function marblesScene(x: string, y: string, z: string, a: number, b: number, c: number, d: number) {
  const s = scene();
  const bb = bars(a);
  rowLabel(s, 'rx', 50, x);
  rowLabel(s, 'ry', 110, y);
  seg(s, 'X', bb, 0, a, 50, 's1', String(a));
  seg(s, 'Y', bb, 0, b, 110, 's2', String(b));
  s.step(`${x} has ${a} marbles, ${y} has ${b}.`);
  seg(s, 'gc', bb, a - c, c, 50, 'accent', String(c));
  s.step(`${x} gives ${c} to ${y}…`);
  s.set('gc', { x: bb.x0 + bb.px(b), y: 110 }).set('gc-t', { x: bb.x0 + bb.px(b + c / 2), y: 125 });
  seg(s, 'gd', bb, a - c - d, d, 50, 'warn', String(d));
  s.step(`…and ${d} to ${z}.`);
  s.set('gd', { x: W + 40, opacity: 0 }).set('gd-t', { x: W + 40, opacity: 0 });
  s.remove('X', 'X-t');
  seg(s, 'X', bb, 0, a - c - d, 50, 's1', String(a - c - d));
  s.step(`${x} now has ${a} − ${c} − ${d} = ${a - c - d}. ${y} has ${b} + ${c} = ${b + c}.`);
  const diff = a - c - d - (b + c);
  s.add(...brace('df', bb.x0 + bb.px(b + c), bb.x0 + bb.px(a - c - d), 160, String(diff), false, { fill: 'good' }));
  s.step(`${a - c - d} − ${b + c} = ${diff} more.`, { reveal: true });
  return s.build();
}

/** Three kinds compared to a base amount, then the total. */
export function threeBarsScene(labels: string[], base: number, more: number, fewer: number, unit = (n: number) => String(n)) {
  const s = scene();
  const vals = [base, base + more, base - fewer];
  const b = bars(base + more);
  rowLabel(s, 'l0', 30, labels[0]);
  seg(s, 'b0', b, 0, base, 30, 's1', unit(base));
  s.step(`Start with what we know: ${labels[0]} is ${unit(base)}.`);
  rowLabel(s, 'l1', 80, labels[1]);
  seg(s, 'b1', b, 0, base, 80, 's1', unit(base));
  seg(s, 'b1x', b, base, more, 80, 's2', `+${unit(more)}`);
  s.step(`${labels[1]}: ${unit(more)} more, so ${unit(vals[1])}.`);
  rowLabel(s, 'l2', 130, labels[2]);
  seg(s, 'b2', b, 0, base - fewer, 130, 's1', unit(vals[2]));
  s.add(rect('b2x', b.x0 + b.px(base - fewer), 130, b.px(fewer), 30, { fill: 'none', stroke: 'bad', dash: true, sw: 2 }));
  s.step(`${labels[2]}: ${unit(fewer)} fewer/less, so ${unit(vals[2])}.`);
  const total = vals.reduce((a, x) => a + x, 0);
  s.add(text('t', W / 2, 196, `${vals.map(unit).join(' + ')} = ${unit(total)}`, { size: 18, fill: 'good', weight: 700, pulse: true }));
  s.step(`Add all three: ${unit(total)}.`, { reveal: true });
  return s.build();
}

export const moneyBars = (labels: string[], base: number, more: number, less: number) => threeBarsScene(labels, base, more, less, money);

/** Heads and legs (or seats and wheels, tables and chairs): pretend all are the small kind, then upgrade. */
export function headsLegsScene(kind: { a: string; b: string; la: number; lb: number; leg: string }, heads: number, bCount: number) {
  const s = scene();
  const per = kind.lb - kind.la;
  const n = heads;
  const cols = Math.min(n, 12);
  const x = (i: number) => 24 + (i % 12) * ((W - 48) / Math.max(1, cols - 1 || 1));
  const y = (i: number) => 52 + Math.floor(i / 12) * 76;
  for (let i = 0; i < n; i++) s.add(circle(`h${i}`, cols === 1 ? W / 2 : x(i), y(i), 10, { fill: 'fill', stroke: 'ink', sw: 2 }));
  s.add(text('cap', W / 2, 200, `${n} ${kind.a === 'tables with 4 chairs' ? 'tables' : 'heads'}`, { size: 17 }));
  s.step(`There are ${n} in all.`);
  const legs = (i: number, k: number, role: 'muted' | 'accent', from = 0) => {
    for (let j = from; j < k; j++) {
      const off = (j - (k - 1) / 2) * 5;
      s.add(line(`l${i}-${j}`, (cols === 1 ? W / 2 : x(i)) + off, y(i) + 10, off * 0.6, 18, { stroke: role, sw: 2, draw: true }));
    }
  };
  for (let i = 0; i < n; i++) legs(i, kind.la, 'muted');
  s.set('cap', { text: `${n} × ${kind.la} = ${n * kind.la} ${kind.leg}` });
  s.step(`Pretend they are all ${kind.a}: ${n} × ${kind.la} = ${n * kind.la} ${kind.leg}.`);
  const total = n * kind.la + bCount * per;
  s.set('cap', { text: `need ${total}: ${total - n * kind.la} more` });
  s.step(`But there are ${total}. That's ${total - n * kind.la} extra.`);
  for (let i = 0; i < bCount; i++) {
    legs(i, kind.lb, 'accent', kind.la);
    s.set(`h${i}`, { fill: 'accent', stroke: 'accent' });
  }
  s.set('cap', { text: `${total - n * kind.la} ÷ ${per} = ${bCount} ${kind.b}`, fill: 'good', pulse: true });
  s.step(`Each of the ${kind.b} adds ${per}. ${total - n * kind.la} ÷ ${per} = ${bCount} ${kind.b}.`, { reveal: true });
  return s.build();
}

/** Counting legs of dogs, cats and chickens, group by group. */
export function legsCountScene(dogs: number, cats: number, hens: number) {
  const s = scene();
  const groups: [string, number, number][] = [['dogs', dogs, 4], ['cats', cats, 4], ['chickens', hens, 2]];
  let y = 40, total = 0;
  for (const [name, count, k] of groups) {
    rowLabel(s, `g${name}`, y - 15, name);
    for (let i = 0; i < count; i++) {
      const cx = 110 + i * 32;
      s.add(circle(`${name}${i}`, cx, y, 9, { fill: 'fill', stroke: 'ink', sw: 2 }));
      for (let j = 0; j < k; j++) s.add(line(`${name}${i}-${j}`, cx + (j - (k - 1) / 2) * 5, y + 9, 0, 12, { stroke: k === 4 ? 's1' : 's2', sw: 2, draw: true }));
    }
    total += count * k;
    s.add(text(`t${name}`, W - 16, y, `${count} × ${k} = ${count * k}`, { size: 14, anchor: 'end' }));
    s.step(`${count} ${name} with ${k} legs: ${count * k}.`);
    y += 52;
  }
  s.add(text('tot', W / 2, 204, `${total} legs`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`Add them up: ${total} legs.`, { reveal: true });
  return s.build();
}

/** Same rate: put the items in equal groups, price one group, scale up. */
export function unitRateScene(thing: string, g: number, q: number, i: number, j: number) {
  const s = scene();
  const box = (id: string, k: number, y: number, role: 's1' | 's2') => {
    const x = 20 + k * 52;
    s.add(rect(`${id}${k}`, x, y, 46, 34, { fill: role, stroke: role }), text(`${id}${k}-t`, x + 23, y + 17, `${g}`, { size: 14, weight: 700 }));
  };
  for (let k = 0; k < i; k++) box('a', k, 40, 's1');
  s.add(text('at', W - 10, 57, money(q * i), { anchor: 'end', size: 16, weight: 700 }));
  s.step(`${g * i} ${thing} make ${i} groups of ${g}, costing ${money(q * i)}.`);
  for (let k = 0; k < i; k++) s.add(text(`ap${k}`, 43 + k * 52, 90, money(q), { size: 13, fill: 'accent' }));
  s.step(`One group costs ${money(q * i)} ÷ ${i} = ${money(q)}.`);
  for (let k = 0; k < Math.min(j, 6); k++) box('b', k, 120, 's2');
  if (j > 6) s.add(text('more', 20 + 6 * 52 + 10, 137, `+${j - 6}`, { size: 14, anchor: 'start' }));
  s.add(text('bt', W / 2, 190, `${j} × ${money(q)} = ${money(q * j)}`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`${g * j} ${thing} are ${j} groups: ${j} × ${money(q)} = ${money(q * j)}.`, { reveal: true });
  return s.build();
}

/** A board cut one way, then another. */
export function boardScene(n: number, a: number, b: number) {
  const s = scene();
  const L = n * a, x0 = 20, w = W - 40, px = (v: number) => (v / L) * w;
  for (let k = 0; k < n; k++) s.add(rect(`p${k}`, x0 + px(k * a), 60, px(a) - 2, 30, { fill: 's1', stroke: 's1' }), text(`p${k}-t`, x0 + px(k * a + a / 2), 75, a, { size: 13, weight: 700 }));
  s.step(`${n} pieces of ${a} feet each.`);
  s.add(text('L', W / 2, 30, `${n} × ${a} = ${L} feet`, { size: 18, weight: 700 }));
  s.step(`The whole board is ${n} × ${a} = ${L} feet.`);
  for (let k = 0; k < L / b; k++) s.add(rect(`q${k}`, x0 + px(k * b), 120, px(b) - 2, 30, { fill: 's2', stroke: 's2' }), text(`q${k}-t`, x0 + px(k * b + b / 2), 135, b, { size: 13, weight: 700 }));
  s.add(text('ans', W / 2, 190, `${L} ÷ ${b} = ${L / b} pieces`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`Cut into ${b}-foot pieces: ${L} ÷ ${b} = ${L / b}.`, { reveal: true });
  return s.build();
}

/** People × weeks grid of sheds. */
export function shedsScene(sheds: number, weeks: number, people: number, times: number) {
  const s = scene();
  const cw = 46, chh = 30, x0 = 90, y0 = 40;
  for (let p = 0; p < people; p++) s.add(text(`pl${p}`, 40, y0 + p * (chh + 8) + chh / 2, `person ${p + 1}`, { size: 13, fill: 'muted' }));
  for (let t = 0; t < times; t++) s.add(text(`wl${t}`, x0 + t * (cw + 8) + cw / 2, y0 - 16, `${weeks} wk`, { size: 12, fill: 'muted' }));
  s.add(rect('c00', x0, y0, cw, chh, { fill: 's1', stroke: 's1' }), text('c00-t', x0 + cw / 2, y0 + chh / 2, sheds, { size: 14, weight: 700 }));
  s.step(`1 person builds ${sheds} in ${weeks} weeks.`);
  for (let p = 0; p < people; p++) for (let t = 0; t < times; t++) {
    if (!p && !t) continue;
    s.add(rect(`c${p}${t}`, x0 + t * (cw + 8), y0 + p * (chh + 8), cw, chh, { fill: t ? 's2' : 's1', stroke: t ? 's2' : 's1' }), text(`c${p}${t}-t`, x0 + t * (cw + 8) + cw / 2, y0 + p * (chh + 8) + chh / 2, sheds, { size: 14, weight: 700 }));
  }
  s.step(`${people} people for ${times} times as long: fill the grid.`);
  s.add(text('ans', W / 2, 200, `${people} × ${times} × ${sheds} = ${people * times * sheds} sheds`, { size: 18, weight: 700, fill: 'good', pulse: true }));
  s.step(`${people * times} boxes of ${sheds}: ${people * times * sheds} sheds.`, { reveal: true });
  return s.build();
}

/** Baskets: the peaches from k baskets are shared among the rest. */
export function basketsScene(n: number, k: number, e: number, x: number) {
  const s = scene();
  const xs = spread(n, 30, W - 30);
  xs.forEach((cx, i) => s.add(path(`b${i}`, cx - 14, 120, 'M0 0 L4 22 H24 L28 0 Z', { stroke: 'ink', sw: 2, fill: 'fill' }), text(`b${i}-t`, cx, 108, '?', { size: 13, fill: 'muted' })));
  s.step(`${n} baskets, each with the same number of peaches.`);
  for (let i = 0; i < k; i++) s.set(`b${i}`, { opacity: 0.3 }).set(`b${i}-t`, { text: '0' });
  s.step(`Empty ${k} basket${k > 1 ? 's' : ''}…`);
  for (let i = k; i < n; i++) s.set(`b${i}-t`, { text: `+${e}`, fill: 'accent' });
  s.add(text('m', W / 2, 180, `${n - k} × ${e} = ${(n - k) * e} moved`, { size: 17 }));
  s.step(`…and each of the other ${n - k} gets ${e} more: ${(n - k) * e} peaches moved.`);
  s.set('m', { text: `${(n - k) * e} ÷ ${k} = ${x} in each`, fill: 'good', pulse: true });
  for (let i = 0; i < k; i++) s.set(`b${i}-t`, { text: String(x), fill: 'good' });
  s.step(`They came from ${k} basket${k > 1 ? 's' : ''}: ${(n - k) * e} ÷ ${k} = ${x} each.`, { reveal: true });
  return s.build();
}

/** Working backwards: run the story in reverse, undoing each step. */
export function backwardsScene(ops: { label: string; inverse: string; value: number }[], start: number, end: number) {
  const s = scene();
  const n = ops.length;
  const xs = spread(n + 1, 34, W - 34);
  s.add(circle('n0', xs[0], 110, 22, { fill: 'fill', stroke: 'line' }), text('n0-t', xs[0], 110, '?', { size: 16, weight: 700 }));
  ops.forEach((op, i) => {
    s.add(path(`a${i}`, xs[i] + 24, 110, `M0 0 H${xs[i + 1] - xs[i] - 48}`, { stroke: 'muted', draw: true }), text(`a${i}-t`, (xs[i] + xs[i + 1]) / 2, 86, op.label, { size: 13, fill: 'muted' }));
    s.add(circle(`n${i + 1}`, xs[i + 1], 110, 22, { fill: 'fill', stroke: 'line' }), text(`n${i + 1}-t`, xs[i + 1], 110, i === n - 1 ? end : '', { size: 15, weight: 700 }));
  });
  s.step(`The story forward, ending at ${end}.`);
  let v = end;
  for (let i = n - 1; i >= 0; i--) {
    v = ops[i].value;
    s.add(text(`r${i}`, (xs[i] + xs[i + 1]) / 2, 146, ops[i].inverse, { size: 14, fill: 'accent', weight: 700 }));
    s.set(`n${i}-t`, { text: i === 0 ? String(start) : String(v), fill: i === 0 ? 'good' : 'ink', pulse: true });
    s.step(`Undo "${ops[i].label}": ${ops[i].inverse} gives ${i === 0 ? start : v}.`, i === 0 ? { reveal: true } : {});
  }
  return s.build();
}

/** "Gave $20 more than she had": two equal parts plus the extra. */
export function gaveMoreScene(y: string, had: number, extra: number, now: number) {
  const s = scene();
  const b = bars(now);
  rowLabel(s, 'r', 80, y);
  seg(s, 'h', b, 0, had, 80, 's1', '?');
  s.step(`${y} had some money.`);
  seg(s, 'g', b, had, had, 80, 's1', '?');
  seg(s, 'x', b, 2 * had, extra, 80, 's2', `$${extra}`);
  s.add(...brace('t', b.x0, b.x0 + b.px(now), 130, `$${now}`, false));
  s.step(`Got the same again plus $${extra}: $${now} in all.`);
  s.set('x', { opacity: 0.25 }).set('t-t', { text: `$${now} − $${extra} = $${now - extra}` });
  s.step(`Without the extra: $${now - extra} is two equal parts.`);
  s.set('h-t', { text: `$${had}` }).set('g-t', { text: `$${had}` });
  s.step(`Each part is $${had}.`);
  s.set('x', { opacity: 1 }).add(text('ans', W / 2, 40, `gave $${had} + $${extra} = $${had + extra}`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`The gift was $${had} + $${extra} = $${had + extra}.`, { reveal: true });
  return s.build();
}


/** Three prices: the second relative to the first, the third relative to the second. */
export function shoppingScene(first: number, more: number, less: number) {
  const s = scene();
  const second = first + more, third = second - less, total = first + second + third;
  const b = bars(second);
  rowLabel(s, 'l0', 30, '1st');
  seg(s, 'b0', b, 0, first, 30, 's1', money(first));
  s.step(`The first item costs ${money(first)}.`);
  rowLabel(s, 'l1', 80, '2nd');
  seg(s, 'b1', b, 0, first, 80, 's1');
  seg(s, 'b1x', b, first, more, 80, 's2', `+${money(more)}`);
  s.step(`The second costs ${money(more)} more: ${money(second)}.`);
  rowLabel(s, 'l2', 130, '3rd');
  seg(s, 'b2', b, 0, third, 130, 's1', money(third));
  s.add(rect('b2x', b.x0 + b.px(third), 130, b.px(less), 30, { fill: 'none', stroke: 'bad', dash: true, sw: 2 }));
  s.step(`The third costs ${money(less)} less than the second: ${money(third)}.`);
  s.add(text('t', W / 2, 196, `${money(first)} + ${money(second)} + ${money(third)} = ${money(total)}`, { size: 17, fill: 'good', weight: 700, pulse: true }));
  s.step(`All three together: ${money(total)}.`, { reveal: true });
  return s.build();
}
