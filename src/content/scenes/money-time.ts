import { bars, brace, circle, clockFace, clockText, coin, hands, hop, marker, money, numberLine, rect, rowLabel, scene, seg, spread, text, W } from './kit';

/* ---------------- money ---------------- */

/** Coins grouped by kind, counted biggest first, then (optionally) the change. */
export function coinsScene(groups: [number, number][], cost?: number) {
  const s = scene();
  const kinds = groups.filter(([, n]) => n > 0).sort((a, b) => b[0] - a[0]);
  let y = 34, total = 0;
  kinds.forEach(([v, n]) => {
    for (let i = 0; i < Math.min(n, 9); i++) coin(s, `c${v}-${i}`, 30 + i * 36, y, v);
    if (n > 9) s.add(text(`c${v}-more`, 30 + 9 * 36, y, `+${n - 9}`, { size: 14 }));
    y += 44;
  });
  s.step('Sort the coins by kind.');
  y = 34;
  kinds.forEach(([v, n]) => {
    total += v * n;
    s.add(text(`t${v}`, W - 10, y, `${n} × ${v}¢ = ${money(v * n)}`, { size: 14, anchor: 'end', fill: 'accent', weight: 700 }));
    s.step(`${n} coin${n > 1 ? 's' : ''} of ${v}¢: ${money(v * n)}.`);
    y += 44;
  });
  s.add(text('tot', W / 2, 200, cost === undefined ? `Total ${money(total)}` : `${money(total)} − ${money(cost)} = ${money(total - cost)}`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(cost === undefined ? `Altogether: ${money(total)}.` : `${money(total)} to start, minus ${money(cost)}: ${money(total - cost)} left.`, { reveal: true });
  return s.build();
}

/** Smallest (or largest) amount: line up the coins and take from the cheap (or rich) end. */
export function pickCoinsScene(all: number[], take: number, smallest: boolean) {
  const s = scene();
  const sorted = [...all].sort((a, b) => (smallest ? a - b : b - a));
  const xs = spread(sorted.length, 24, W - 24);
  all.forEach((v, i) => coin(s, `k${i}`, 24 + i * ((W - 48) / Math.max(1, all.length - 1)), 70, v));
  s.step('Here are all the coins.');
  const used = new Set<number>();
  sorted.forEach((v, j) => {
    const i = all.findIndex((x, k) => x === v && !used.has(k));
    used.add(i);
    s.set(`k${i}`, { x: xs[j], y: 110 }).set(`k${i}-v`, { x: xs[j], y: 110 });
  });
  s.step(`Line them up from the ${smallest ? 'least' : 'most'} valuable.`);
  s.add(rect('sel', xs[0] - 22, 84, xs[take - 1] - xs[0] + 44, 52, { fill: 'none', stroke: 'good', sw: 3, rx: 12, draw: false, pulse: true }));
  const sum = sorted.slice(0, take).reduce((a, x) => a + x, 0);
  s.add(text('t', W / 2, 180, `${sorted.slice(0, take).join(' + ')} = ${money(sum)}`, { size: 17, weight: 700, fill: 'good' }));
  s.step(`Take the first ${take}: ${money(sum)}.`, { reveal: true });
  return s.build();
}

/** Every order of nickels and dimes that makes the price. */
export function nickelDimeScene(price: number) {
  const s = scene();
  const out: number[][] = [];
  const rec = (left: number, acc: number[]) => {
    if (left === 0) return void out.push(acc);
    if (left >= 5) rec(left - 5, [...acc, 5]);
    if (left >= 10) rec(left - 10, [...acc, 10]);
  };
  rec(price, []);
  const byMix = new Map<number, number[][]>();
  for (const o of out) byMix.set(o.filter((x) => x === 10).length, [...(byMix.get(o.filter((x) => x === 10).length) ?? []), o]);
  const perRow = 2;
  let row = 0, col = 0;
  s.add(text('h', W / 2, 18, `${price}¢ with nickels (5) and dimes (10)`, { size: 15, fill: 'muted' }));
  s.step('List every way, sorted by how many dimes.');
  let count = 0;
  for (const [d, list] of [...byMix.entries()].sort((a, b) => b[0] - a[0])) {
    for (const o of list) {
      const x0 = 14 + col * (W / perRow), y0 = 44 + row * 32;
      o.forEach((v, k) => coin(s, `w${count}-${k}`, x0 + 14 + k * 26, y0, v));
      count++;
      col++;
      if (col === perRow) { col = 0; row++; }
    }
    s.step(`${d} dime${d === 1 ? '' : 's'}: ${list.length} order${list.length === 1 ? '' : 's'}.`);
  }
  s.add(text('t', W / 2, 206, `${out.length} ways`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`${out.length} different ways in all.`, { reveal: true });
  return s.build();
}

/** Different amounts from a set of coins, by how many coins are used. */
export function amountsScene(values: number[]) {
  const s = scene();
  values.forEach((v, i) => coin(s, `c${i}`, 40 + i * 44, 30, v));
  s.step('Use one coin, two coins, three coins…');
  const seen = new Set<number>();
  let n = 0;
  for (let k = 1; k <= values.length; k++) {
    const sums: number[] = [];
    for (let m = 1; m < 1 << values.length; m++) {
      if (m.toString(2).split('').filter((b) => b === '1').length !== k) continue;
      let t = 0;
      values.forEach((v, i) => m & (1 << i) && (t += v));
      if (!seen.has(t)) { seen.add(t); sums.push(t); }
    }
    sums.forEach((t) => {
      s.add(rect(`a${n}`, 16 + (n % 6) * 56, 64 + Math.floor(n / 6) * 34, 50, 26, { fill: 'fill', stroke: 'line' }), text(`a${n}-t`, 41 + (n % 6) * 56, 77 + Math.floor(n / 6) * 34, money(t), { size: 13, weight: 600 }));
      n++;
    });
    s.step(`Using ${k} coin${k > 1 ? 's' : ''}: ${sums.length} new amount${sums.length === 1 ? '' : 's'}.`);
  }
  s.add(text('t', W / 2, 206, `${seen.size} amounts`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`${seen.size} different amounts.`, { reveal: true });
  return s.build();
}

/** Two of the same fruit, then swap one for the other kind. */
export function twoFruitScene(f1: string, f2: string, a: number, b: number) {
  const s = scene();
  const bb = bars(a + b);
  rowLabel(s, 'r1', 50, `2 ${f1}s`);
  seg(s, 'p1', bb, 0, a, 50, 's1', f1);
  seg(s, 'p2', bb, a, a, 50, 's1', f1);
  s.add(text('c1', W - 8, 65, money(2 * a), { anchor: 'end', size: 15, weight: 700 }));
  s.step(`Two ${f1}s cost ${money(2 * a)}.`);
  s.set('p1-t', { text: money(a) }).set('p2-t', { text: money(a) });
  s.step(`So one ${f1} costs ${money(a)}.`);
  rowLabel(s, 'r2', 120, `${f1} + ${f2}`);
  seg(s, 'q1', bb, 0, a, 120, 's1', money(a));
  seg(s, 'q2', bb, a, b, 120, 's2', '?');
  s.add(text('c2', W - 8, 135, money(a + b), { anchor: 'end', size: 15, weight: 700 }));
  s.step(`One ${f1} and one ${f2} cost ${money(a + b)}.`);
  s.set('q2-t', { text: money(b), fill: 'good', pulse: true });
  s.step(`${money(a + b)} − ${money(a)} = ${money(b)} for the ${f2}.`, { reveal: true });
  return s.build();
}

/** Two shopping lists: double one, compare, the difference is the pears. */
export function fruitListsScene(x1: number, y1: number, y2: number, t1: number, t2: number, pear: number) {
  const s = scene();
  const row = (id: string, y: number, nb: number, np: number, total: string) => {
    for (let i = 0; i < nb; i++) s.add(circle(`${id}b${i}`, 24 + i * 22, y, 9, { fill: 'star', stroke: 'none' }));
    for (let i = 0; i < np; i++) s.add(circle(`${id}p${i}`, 24 + (nb + i) * 22 + 8, y, 9, { fill: 'good', stroke: 'none' }));
    s.add(text(`${id}t`, W - 10, y, total, { anchor: 'end', size: 15, weight: 700 }));
  };
  row('A', 40, x1, y1, money(t1));
  row('B', 80, 2 * x1, y2, money(t2));
  s.add(text('k', W / 2, 200, 'yellow = banana · green = pear', { size: 13, fill: 'muted' }));
  s.step('Two shopping lists.');
  row('D', 130, 2 * x1, 2 * y1, money(2 * t1));
  s.step(`Double the first list: ${2 * x1} bananas and ${2 * y1} pears cost ${money(2 * t1)}.`);
  const dp = 2 * y1 - y2;
  s.set('k', { text: `${dp} pear${dp > 1 ? 's' : ''} = ${money(2 * t1)} − ${money(t2)} = ${money(2 * t1 - t2)}` });
  s.step(`Same bananas, so the ${dp} extra pear${dp > 1 ? 's' : ''} cost ${money(2 * t1 - t2)}.`);
  s.set('k', { text: `1 pear = ${money(pear)}`, fill: 'good', pulse: true, size: 20 });
  s.step(`One pear costs ${money(pear)}.`, { reveal: true });
  return s.build();
}

/** Visit fee + hourly rate: the difference between two bills is the extra hours. */
export function feeScene(h1: number, h2: number, t1: number, t2: number, rate: number, fee: number) {
  const s = scene();
  const b = bars(t2);
  rowLabel(s, 'r1', 50, `${h1} h`);
  rowLabel(s, 'r2', 110, `${h2} h`);
  seg(s, 'f1', b, 0, fee, 50, 's2', 'fee');
  for (let i = 0; i < h1; i++) seg(s, `h1${i}`, b, fee + i * rate, rate, 50, 's1');
  seg(s, 'f2', b, 0, fee, 110, 's2', 'fee');
  for (let i = 0; i < h2; i++) seg(s, `h2${i}`, b, fee + i * rate, rate, 110, 's1');
  s.add(text('t1', W - 6, 65, `$${t1}`, { anchor: 'end', size: 14, weight: 700 }), text('t2', W - 6, 125, `$${t2}`, { anchor: 'end', size: 14, weight: 700 }));
  s.step('Each bill is the fee plus an amount for every hour.');
  s.add(text('d', W / 2, 180, `${h2 - h1} hour${h2 - h1 > 1 ? 's' : ''} = $${t2} − $${t1} = $${t2 - t1}`, { size: 16 }));
  s.step(`The difference is ${h2 - h1} extra hour${h2 - h1 > 1 ? 's' : ''}: $${t2 - t1}, so 1 hour is $${rate}.`);
  s.set('f1-t', { text: `$${fee}`, fill: 'good', pulse: true }).set('d', { text: `$${t1} − ${h1} × $${rate} = $${fee}`, fill: 'good' });
  s.step(`The fee: $${t1} − ${h1} × $${rate} = $${fee}.`, { reveal: true });
  return s.build();
}

/* ---------------- time ---------------- */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Month grid: the 1st, then the same weekday every 7 days, then count to the day. */
export function calendarScene(start: number, n: number) {
  const s = scene();
  const cw = 46, ch = 28, x0 = 18, y0 = 34;
  DAY_NAMES.forEach((d, i) => s.add(text(`h${i}`, x0 + i * cw + cw / 2, 16, d, { size: 12, fill: 'muted', weight: 700 })));
  for (let day = 1; day <= 31; day++) {
    const k = start + day - 1;
    s.add(rect(`d${day}`, x0 + (k % 7) * cw + 2, y0 + Math.floor(k / 7) * ch, cw - 4, ch - 4, { fill: 'fill', stroke: 'line', rx: 5 }), text(`d${day}-t`, x0 + (k % 7) * cw + cw / 2, y0 + Math.floor(k / 7) * ch + ch / 2 - 2, day, { size: 12, weight: 500 }));
  }
  s.set('d1', { fill: 's1', stroke: 's1', pulse: true });
  s.step(`The 1st is a ${FULL[start]}.`);
  for (let day = 8; day <= n; day += 7) s.set(`d${day}`, { fill: 's1', stroke: 's1' });
  s.step(`Every 7 days it's ${FULL[start]} again: ${[1, 8, 15, 22, 29].filter((d) => d <= n).join(', ')}.`);
  for (let day = 1; day <= 31; day++) if (day !== n && (day - 1) % 7 !== 0) s.set(`d${day}`, { opacity: 0.35 }).set(`d${day}-t`, { opacity: 0.35 });
  s.set(`d${n}`, { fill: 'good', stroke: 'good', pulse: true }).set(`h${(start + n - 1) % 7}`, { fill: 'good' });
  s.step(`Count on to the ${n}th: it's a ${FULL[(start + n - 1) % 7]}.`, { reveal: true });
  return s.build();
}

/** N days from today: whole weeks land on the same day; only the leftover days move. */
export function daysAheadScene(start: number, n: number) {
  const s = scene();
  const cx = W / 2, cy = 110, r = 72;
  DAY_NAMES.forEach((d, i) => {
    const a = ((i - start) / 7) * Math.PI * 2;
    s.add(circle(`w${i}`, cx + Math.sin(a) * r, cy - Math.cos(a) * r, 20, { fill: i === start ? 's1' : 'fill', stroke: i === start ? 's1' : 'line' }), text(`w${i}-t`, cx + Math.sin(a) * r, cy - Math.cos(a) * r, d, { size: 12, weight: 700 }));
  });
  s.add(text('c', cx, cy, 'today', { size: 14, fill: 'muted' }));
  s.step(`Today is ${FULL[start]}.`);
  s.set('c', { text: `${n} = ${Math.floor(n / 7)}×7 + ${n % 7}`, size: 15, fill: 'ink' });
  s.step(`${n} days is ${Math.floor(n / 7)} whole weeks and ${n % 7} more day${n % 7 === 1 ? '' : 's'}.`);
  s.step(`After whole weeks it's ${FULL[start]} again.`);
  for (let k = 1; k <= n % 7; k++) s.set(`w${(start + k) % 7}`, { fill: k === n % 7 ? 'good' : 's1', stroke: k === n % 7 ? 'good' : 's1', pulse: k === n % 7 });
  s.set('c', { text: FULL[(start + n) % 7], fill: 'good', size: 18 });
  s.step(`Move ${n % 7} more: ${FULL[(start + n) % 7]}.`, { reveal: true });
  return s.build();
}

/** Clock: start time, add hours, add minutes. */
export function elapsedScene(start: number, addH: number, addM: number) {
  const s = scene();
  const cx = 90, cy = 110, r = 80;
  clockFace(s, cx, cy, r);
  hands(s, cx, cy, r, start);
  s.add(text('t', 270, 90, clockText(start), { size: 22, weight: 700 }), text('n', 270, 125, 'now', { size: 14, fill: 'muted' }));
  s.step(`It's ${clockText(start)}.`);
  hands(s, cx, cy, r, start + addH * 60);
  s.set('t', { text: clockText(start + addH * 60) }).set('n', { text: `+ ${addH} h` });
  s.step(`Add ${addH} hour${addH > 1 ? 's' : ''}: ${clockText(start + addH * 60)}.`, addM ? {} : { reveal: true });
  if (addM) {
    hands(s, cx, cy, r, start + addH * 60 + addM);
    s.set('t', { text: clockText(start + addH * 60 + addM), fill: 'good', pulse: true }).set('n', { text: `+ ${addM} min` });
    s.step(`Add ${addM} minutes: ${clockText(start + addH * 60 + addM)}.`, { reveal: true });
  }
  return s.build();
}

/** Halfway between two times, then back by the wait. */
export function halfwayScene(t1: number, gap: number, wait: number) {
  const s = scene();
  const mid = t1 + gap / 2, now = mid - wait;
  const nl = numberLine(s, t1 - 2, t1 + gap + 2, [t1, t1 + gap]);
  s.set(`tl${t1}`, { text: clockText(t1).replace(' P.M.', '').replace(' A.M.', '') }).set(`tl${t1 + gap}`, { text: clockText(t1 + gap).replace(' P.M.', '').replace(' A.M.', '') });
  s.step(`From ${clockText(t1)} to ${clockText(t1 + gap)} is ${gap} minutes.`);
  marker(s, nl, 'm', mid, 's2', clockText(mid).replace(/ [AP]\.M\./, ''));
  s.step(`Halfway is ${gap / 2} minutes in: ${clockText(mid)}.`);
  hop(s, nl, 'b', mid, now, `− ${wait} min`, 'good');
  marker(s, nl, 'n', now, 'good');
  s.add(text('ans', W / 2, 40, `now: ${clockText(now)}`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`That's ${wait} minutes from now, so it's ${clockText(now)}.`, { reveal: true });
  return s.build();
}

/** Two watches drifting apart each hour until they're 60 minutes apart. */
export function watchesScene(fast: number, slow: number, start: number, hours: number) {
  const s = scene();
  const b = bars(60, 40, W - 30);
  s.add(text('h', W / 2, 30, `apart: +${fast} and −${slow} each hour`, { size: 15, fill: 'muted' }));
  s.step(`Each hour they drift ${fast} + ${slow} = ${fast + slow} minutes further apart.`);
  for (let k = 0; k < Math.min(hours, 12); k++) seg(s, `g${k}`, b, k * (fast + slow), fast + slow, 80, k % 2 ? 's2' : 's1');
  s.add(...brace('t', b.x0, b.x0 + b.px(60), 130, '60 minutes'));
  s.step(`60 ÷ ${fast + slow} = ${hours} hours to reach a full hour.`);
  s.add(text('ans', W / 2, 190, `${clockText(start)} + ${hours} h = ${clockText(start + hours * 60)}`, { size: 18, weight: 700, fill: 'good', pulse: true }));
  s.step(`${clockText(start)} plus ${hours} hours is ${clockText(start + hours * 60)}.`, { reveal: true });
  return s.build();
}

/** The minute hand passes numbers in m minutes; the hour hand takes an hour per number. */
export function handsTravelScene(mins: number) {
  const s = scene();
  const cx = 110, cy = 110, r = 84;
  clockFace(s, cx, cy, r);
  hands(s, cx, cy, r, 0);
  s.set('hh', { opacity: 0.25 });
  s.step('Watch the minute hand.');
  hands(s, cx, cy, r, mins);
  s.add(text('t', 280, 100, `${mins} min`, { size: 20, weight: 700 }), text('n', 280, 130, `= ${mins / 5} numbers`, { size: 15 }));
  s.set('hh', { rot: 0 });
  s.step(`In ${mins} minutes it moves ${mins / 5} numbers (5 minutes each).`);
  s.set('mh', { opacity: 0.25 }).set('hh', { opacity: 1, rot: (mins / 5) * 30 });
  s.set('t', { text: `${mins / 5} hours`, fill: 'good', pulse: true }).set('n', { text: '1 number = 1 hour' });
  s.step(`The hour hand needs 1 hour per number: ${mins / 5} hours.`, { reveal: true });
  return s.build();
}

/** Hours to minutes, 60 at a time, plus a quarter/half/three-quarter hour. */
export function minutesScene(h: number, extra: number) {
  const s = scene();
  const b = bars(h * 60 + extra, 24, W - 24);
  for (let i = 0; i < h; i++) {
    seg(s, `h${i}`, b, i * 60, 60, 80, 's1', '60');
    s.step(i === 0 ? 'Each hour is 60 minutes.' : `${i + 1} hours: ${(i + 1) * 60} minutes.`);
  }
  if (extra) {
    seg(s, 'x', b, h * 60, extra, 80, 's2', String(extra));
    s.step(`The extra part of an hour is ${extra} minutes.`);
  }
  s.add(text('t', W / 2, 160, `${h} × 60${extra ? ` + ${extra}` : ''} = ${h * 60 + extra} minutes`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`${h * 60 + extra} minutes in all.`, { reveal: true });
  return s.build();
}

/** Roasting: how many pounds fit in one hour, then how many hours. */
export function roastScene(per: number, lbs: number) {
  const s = scene();
  const perHour = 60 / per, hours = lbs / perHour;
  const b = bars(lbs, 24, W - 24);
  for (let i = 0; i < lbs; i++) seg(s, `p${i}`, b, i, 1, 70, 's1', '', 26);
  s.step(`${lbs} pounds, ${per} minutes each.`);
  for (let i = 0; i < hours; i++) s.add(...brace(`h${i}`, b.x0 + b.px(i * perHour), b.x0 + b.px((i + 1) * perHour), 110, '1 h'));
  s.step(`${perHour} pounds take one hour (${perHour} × ${per} = 60 minutes).`);
  s.add(text('t', W / 2, 180, `${lbs} ÷ ${perHour} = ${hours} hours`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`${lbs} ÷ ${perHour} = ${hours} hours.`, { reveal: true });
  return s.build();
}

/* ---------------- length ---------------- */

/** Yards and feet turned into inches, then added. */
export function lengthScene(y: number, f: number, i: number) {
  const s = scene();
  const total = 36 * y + 12 * f + i;
  const b = bars(total, 24, W - 24);
  for (let k = 0; k < y; k++) seg(s, `y${k}`, b, k * 36, 36, 60, 's1', '1 yd');
  for (let k = 0; k < f; k++) seg(s, `f${k}`, b, 36 * y + k * 12, 12, 60, 's2', '1 ft');
  if (i) seg(s, 'i', b, 36 * y + 12 * f, i, 60, 'accent', `${i}`);
  s.step(`${y} yard${y > 1 ? 's' : ''}, ${f} ${f > 1 ? 'feet' : 'foot'} and ${i} inches.`);
  for (let k = 0; k < y; k++) s.set(`y${k}-t`, { text: '36 in' });
  s.step('A yard is 3 feet, which is 36 inches.');
  for (let k = 0; k < f; k++) s.set(`f${k}-t`, { text: '12' });
  s.step('A foot is 12 inches.');
  s.add(text('t', W / 2, 150, `${y} × 36 + ${f} × 12 + ${i} = ${total} inches`, { size: 18, weight: 700, fill: 'good', pulse: true }));
  s.step(`Add them all in inches: ${total}.`, { reveal: true });
  return s.build();
}

/** Points on a line: overlapping spans, subtract to find the missing piece. */
export function segmentsScene(ab: number, bc: number, cd: number, unit: string) {
  const s = scene();
  const nl = numberLine(s, 0, ab + bc + cd, []);
  const pts: [string, number][] = [['A', 0], ['B', ab], ['C', ab + bc], ['D', ab + bc + cd]];
  pts.forEach(([n, v]) => {
    s.add(circle(`p${n}`, nl.pos(v), nl.y, 6, { fill: 'ink', stroke: 'none' }), text(`p${n}-t`, nl.pos(v), nl.y + 22, n, { size: 16, weight: 700 }));
  });
  s.add(...brace('ab', nl.pos(0), nl.pos(ab), nl.y - 24, `${ab}${unit}`, true));
  s.add(...brace('bd', nl.pos(ab), nl.pos(ab + bc + cd), nl.y - 66, `${bc + cd}${unit}`, true));
  s.add(...brace('ac', nl.pos(0), nl.pos(ab + bc), nl.y + 40, `${ab + bc}${unit}`));
  s.step('Here are the three distances we know.');
  s.add(...brace('bc', nl.pos(ab), nl.pos(ab + bc), nl.y - 24, `${bc}${unit}`, true, { stroke: 'accent', fill: 'accent' }));
  s.step(`B to C = A to C − A to B = ${ab + bc} − ${ab} = ${bc}.`);
  s.add(...brace('cd', nl.pos(ab + bc), nl.pos(ab + bc + cd), nl.y - 24, `${cd}${unit}`, true, { stroke: 'good', fill: 'good', pulse: true }));
  s.step(`C to D = B to D − B to C = ${bc + cd} − ${bc} = ${cd}.`, { reveal: true });
  return s.build();
}

/** Midpoints: half of each part, then add the halves. */
export function midpointsScene(pr: number, rt: number) {
  const s = scene();
  const nl = numberLine(s, 0, pr + rt, []);
  const pts: [string, number][] = [['P', 0], ['Q', pr / 2], ['R', pr], ['S', pr + rt / 2], ['T', pr + rt]];
  pts.forEach(([n, v]) => s.add(circle(`p${n}`, nl.pos(v), nl.y, 6, { fill: n === 'Q' || n === 'S' ? 'accent' : 'ink', stroke: 'none' }), text(`p${n}-t`, nl.pos(v), nl.y + 22, n, { size: 16, weight: 700 })));
  s.add(...brace('pr', nl.pos(0), nl.pos(pr), nl.y - 66, `${pr}`, true), ...brace('rt', nl.pos(pr), nl.pos(pr + rt), nl.y - 66, `${rt}`, true));
  s.step('Q is halfway along P to R; S is halfway along R to T.');
  s.add(...brace('qr', nl.pos(pr / 2), nl.pos(pr), nl.y - 24, `${pr / 2}`, true, { stroke: 's1', fill: 's1' }), ...brace('rs', nl.pos(pr), nl.pos(pr + rt / 2), nl.y - 24, `${rt / 2}`, true, { stroke: 's2', fill: 's2' }));
  s.step(`Q to R is half of ${pr}: ${pr / 2}. R to S is half of ${rt}: ${rt / 2}.`);
  s.add(...brace('qs', nl.pos(pr / 2), nl.pos(pr + rt / 2), nl.y + 40, `${pr / 2 + rt / 2}`, false, { stroke: 'good', fill: 'good', pulse: true }));
  s.step(`Q to S = ${pr / 2} + ${rt / 2} = ${pr / 2 + rt / 2}.`, { reveal: true });
  return s.build();
}


