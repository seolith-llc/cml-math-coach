import { circle, line, path, person, rect, scene, spread, text, W, type Role, type Shape } from './kit';
import { wrap } from '../../core/explain';
import { ordinal as ord } from '../../core/numberWords';

/* ---------------- logic ---------------- */

/** Ordering: after each clue, a slot is filled only when every remaining order agrees on it. */
export function orderScene<T extends string>(truth: T[], clues: { text: string; test: (o: T[]) => boolean }[], all: T[][]) {
  const s = scene();
  const n = truth.length;
  const xs = spread(n, 50, W - 50);
  xs.forEach((x, i) => s.add(rect(`slot${i}`, x - 34, 110, 68, 40, { fill: 'fill', stroke: 'line', rx: 8 }), text(`sl${i}`, x, 170, ord(i + 1), { size: 13, fill: 'muted' })));
  s.add(text('left', W / 2, 206, `${all.length} possible orders`, { size: 14, fill: 'muted', weight: 600 }));
  s.step(`${n} places to fill. There are ${all.length} ways to order ${n} people.`);
  let possible = all;
  clues.forEach((c, k) => {
    possible = possible.filter(c.test);
    s.set('left', { text: `${possible.length} possible order${possible.length === 1 ? '' : 's'}`, fill: possible.length === 1 ? 'good' : 'muted', pulse: true });
    wrap(c.text, 40).forEach((l, j) => s.add(text(`clue${j}`, W / 2, 30 + j * 22, l, { size: 15, fill: 'accent', weight: 600 })));
    for (let j = wrap(c.text, 40).length; j < 3; j++) s.remove(`clue${j}`);
    for (let i = 0; i < n; i++) {
      const who = new Set(possible.map((o) => o[i]));
      if (who.size === 1 && !s.has(`nm${i}`)) s.add(text(`nm${i}`, xs[i], 130, [...who][0], { size: 15, weight: 700, pulse: true }));
    }
    s.step(c.text, k === clues.length - 1 ? { reveal: true } : {});
  });
  for (let i = 0; i < n; i++) if (!s.has(`nm${i}`)) s.add(text(`nm${i}`, xs[i], 130, truth[i], { size: 15, weight: 700, pulse: true }));
  s.remove('clue*', 'left');
  s.add(text('done', W / 2, 50, truth.join(' → '), { size: 16, weight: 700, fill: 'good' }));
  s.step(`Only one order fits every clue: ${truth.join(', ')}.`, { reveal: true });
  return s.build();
}

/** Matching grid: ✗ where a clue rules a pairing out, ✓ once a row is decided. */
export function matchScene(people: string[], roles: string[], truth: string[], clues: { text: string; test: (a: string[]) => boolean }[], all: string[][]) {
  const s = scene();
  const cw = 80, ch = 34, x0 = 110, y0 = 64;
  roles.forEach((r, j) => s.add(text(`r${j}`, x0 + j * cw + cw / 2, y0 - 16, r.length > 10 ? r.split(' ')[0] : r, { size: 13, weight: 700, fill: 'muted' })));
  people.forEach((p, i) => {
    s.add(text(`p${i}`, 8, y0 + i * ch + ch / 2, p, { size: 14, anchor: 'start', weight: 600 }));
    roles.forEach((_, j) => s.add(rect(`c${i}${j}`, x0 + j * cw + 2, y0 + i * ch + 2, cw - 4, ch - 4, { fill: 'fill', stroke: 'line', rx: 6 })));
  });
  s.step('Make a grid: people down the side, choices across the top.');
  let possible = all;
  clues.forEach((c, k) => {
    possible = possible.filter(c.test);
    wrap(c.text, 40).forEach((l, j) => s.add(text(`clue${j}`, W / 2, 182 + j * 20, l, { size: 14, fill: 'accent', weight: 600 })));
    for (let j = wrap(c.text, 40).length; j < 2; j++) s.remove(`clue${j}`);
    people.forEach((_, i) => roles.forEach((r, j) => {
      const can = possible.some((a) => a[i] === r);
      const sure = possible.every((a) => a[i] === r);
      const id = `m${i}${j}`;
      if (!can && !s.has(id)) s.add(text(id, x0 + j * cw + cw / 2, y0 + i * ch + ch / 2, '✗', { size: 18, fill: 'bad', pulse: true }));
      if (sure && !s.has(id)) s.add(text(id, x0 + j * cw + cw / 2, y0 + i * ch + ch / 2, '✓', { size: 18, fill: 'good', pulse: true }));
    }));
    s.step(c.text, k === clues.length - 1 ? { reveal: true } : {});
  });
  s.remove('clue*');
  people.forEach((_, i) => roles.forEach((r, j) => {
    if (truth[i] === r) s.set(`c${i}${j}`, { fill: 'good', stroke: 'good' }).remove(`m${i}${j}`).add(text(`m${i}${j}`, x0 + j * cw + cw / 2, y0 + i * ch + ch / 2, '✓', { size: 18, fill: 'fill', weight: 800 }));
  }));
  s.step(`Each row and column has one ✓: ${people.map((p, i) => `${p} — ${truth[i]}`).join(', ')}.`, { reveal: true });
  return s.build();
}

/** Family: who counts as a sister or brother for the child who is talking. */
export function familyCountScene(boys: number, girls: number, name: string, isGirl: boolean, askSisters: boolean) {
  const s = scene();
  const kids = [...Array(girls).fill('g'), ...Array(boys).fill('b')];
  const xs = spread(kids.length, 40, W - 40);
  const me = isGirl ? 0 : girls;
  kids.forEach((k, i) => person(s, `k${i}`, xs[i], 70, k === 'g' ? 's2' : 's1', i === me ? name : undefined));
  s.step(`${girls} girl${girls > 1 ? 's' : ''} and ${boys} boy${boys > 1 ? 's' : ''}. ${name} is one of them.`);
  s.add(rect('me', xs[me] - 20, 54, 40, 80, { fill: 'none', stroke: 'ink', dash: true, rx: 10 }));
  s.step(`${name} is not ${isGirl ? 'her' : 'his'} own ${isGirl ? 'sister' : 'brother'}.`);
  const counted = kids.map((k, i) => i !== me && (askSisters ? k === 'g' : k === 'b'));
  kids.forEach((_, i) => !counted[i] && i !== me && s.set(`k${i}-h`, { opacity: 0.25 }).set(`k${i}-b`, { opacity: 0.25 }));
  const n = counted.filter(Boolean).length;
  s.add(text('t', W / 2, 190, `${n} ${askSisters ? 'sister' : 'brother'}${n === 1 ? '' : 's'}`, { size: 20, weight: 700, fill: 'good', pulse: true }));
  s.step(`Count the other ${askSisters ? 'girls' : 'boys'}: ${n}.`, { reveal: true });
  return s.build();
}

/** Family puzzle: try families row by row until both clues fit. */
export function familyTableScene(girl: string, boy: string, clues: string[], rows: string[], boys: number, girls: number) {
  const s = scene();
  wrap(clues[0], 44).forEach((l, i) => s.add(text(`c0${i}`, W / 2, 18 + i * 20, l, { size: 14, fill: 's2', weight: 600 })));
  wrap(clues[1], 44).forEach((l, i) => s.add(text(`c1${i}`, W / 2, 62 + i * 20, l, { size: 14, fill: 's1', weight: 600 })));
  s.step(`${girl} doesn't count herself, and ${boy} doesn't count himself.`);
  const shown: { id: string; t: string; ok: boolean }[] = [];
  rows.forEach((r, i) => {
    const ok = r.includes('✔');
    wrap(r.replace(/ ✔| ✗/, ok ? ' ✓' : ' ✗'), 50).forEach((t, j) => shown.push({ id: `r${i}-${j}`, t, ok }));
    s.remove('r*');
    shown.slice(-4).forEach((l, k) => s.add(text(l.id, W / 2, 112 + k * 22, l.t, { size: 13, fill: l.ok ? 'good' : 'muted', weight: l.ok ? 700 : 500 })));
    s.step(r.replace(/ ✔| ✗/, ''));
  });
  s.add(text('ans', W / 2, 206, `${boys} boy${boys > 1 ? 's' : ''} + ${girls} girl${girls > 1 ? 's' : ''} = ${boys + girls}`, { size: 18, weight: 700, fill: 'good', pulse: true }));
  s.step(`The family has ${boys} boy${boys > 1 ? 's' : ''} and ${girls} girl${girls > 1 ? 's' : ''}.`, { reveal: true });
  return s.build();
}

/* ---------------- counting ---------------- */

/** Fan of triangles: number the sections, then light up each triangle (or each size) in turn. */
export function trianglesScene(n: number, cross: boolean) {
  const s = scene();
  const apex = [180, 16], y = 190;
  const xs = Array.from({ length: n + 1 }, (_, i) => 40 + (i * 280) / n);
  const cy = apex[1] + (y - apex[1]) * 0.55;
  const at = (x: number, yy: number) => apex[0] + (x - apex[0]) * ((yy - apex[1]) / (y - apex[1]));
  const tri = (id: string, a: number, b: number, base: number, o: Partial<Shape> = {}) =>
    path(id, 0, 0, `M${apex[0]} ${apex[1]} L${at(xs[a], base)} ${base} L${at(xs[b], base)} ${base} Z`, { stroke: 'ink', sw: 2, fill: 'none', ...o });
  s.add(tri('outline', 0, n, y));
  for (let i = 1; i < n; i++) s.add(line(`ln${i}`, apex[0], apex[1], xs[i] - apex[0], y - apex[1], { stroke: 'ink', sw: 2 }));
  if (cross) s.add(line('cross', at(xs[0], cy), cy, at(xs[n], cy) - at(xs[0], cy), 0, { stroke: 'ink', sw: 2 }));
  s.step('Here is the figure.');
  for (let i = 0; i < n; i++) s.add(text(`num${i}`, (xs[i] + xs[i + 1]) / 2, y - 18, i + 1, { size: 15, fill: 'accent', weight: 700 }));
  s.step(`Number the ${n} sections.`);
  const all: [number, number][] = [];
  for (let size = 1; size <= n; size++) for (let a = 0; a + size <= n; a++) all.push([a, a + size]);
  const bases = cross ? [cy, y] : [y];
  let count = 0;
  for (const base of bases) {
    if (all.length <= 10 && !cross) {
      for (const [a, b] of all) {
        count++;
        s.remove('hl*').add(tri(`hl${count}`, a, b, base, { fill: 's1', stroke: 'accent', sw: 3, opacity: 0.55 }));
        s.add(text('count', 330, 30, count, { size: 24, weight: 800, fill: 'accent', pulse: true }));
        s.step(`${b - a === 1 ? `Section ${a + 1}` : `Sections ${a + 1} to ${b}`}: triangle ${count}.`);
      }
    } else {
      for (let size = 1; size <= n; size++) {
        const group = all.filter(([a, b]) => b - a === size);
        count += group.length;
        s.remove('hl*');
        group.forEach(([a, b], k) => s.add(tri(`hl${size}-${k}`, a, b, base, { fill: 'none', stroke: k % 2 ? 's2' : 'accent', sw: 3 })));
        s.add(text('count', 330, 30, count, { size: 24, weight: 800, fill: 'accent', pulse: true }));
        s.step(`${base === cy ? 'Top part, ' : ''}${size} section${size > 1 ? 's' : ''} together: ${group.length}. Running total ${count}.`);
      }
    }
  }
  s.remove('hl*').set('count', { fill: 'good' });
  s.step(`${count} triangles in all.`, { reveal: true });
  return s.build();
}

/** Grid of boxes: count rectangles (or squares) by size. */
export function rectanglesScene(rows: number, cols: number, squares: boolean) {
  const s = scene();
  const cw = Math.min(60, 280 / cols), ch = Math.min(46, 140 / rows), x0 = (W - cols * cw) / 2, y0 = 40;
  s.add(rect('g', x0, y0, cols * cw, rows * ch, { fill: 'fill', stroke: 'ink', sw: 2, rx: 0 }));
  for (let c = 1; c < cols; c++) s.add(line(`v${c}`, x0 + c * cw, y0, 0, rows * ch, { stroke: 'ink', sw: 2 }));
  for (let r = 1; r < rows; r++) s.add(line(`h${r}`, x0, y0 + r * ch, cols * cw, 0, { stroke: 'ink', sw: 2 }));
  s.step(`A grid of ${rows} row${rows > 1 ? 's' : ''} and ${cols} columns.`);
  let total = 0;
  const sizes: [number, number][] = [];
  for (let hh = 1; hh <= rows; hh++) for (let ww = 1; ww <= cols; ww++) if (!squares || hh === ww) sizes.push([hh, ww]);
  for (const [hh, ww] of sizes) {
    const k = (rows - hh + 1) * (cols - ww + 1);
    total += k;
    s.remove('hl*');
    s.add(rect('hl', x0 + 2, y0 + 2, ww * cw - 4, hh * ch - 4, { fill: 's1', stroke: 'accent', sw: 3, opacity: 0.8, rx: 3 }));
    s.add(text('count', W / 2, 200, `${hh}×${ww}: ${k}   total ${total}`, { size: 17, weight: 700, fill: 'accent', pulse: true }));
    s.step(`${ww} wide and ${hh} tall fits ${k} way${k > 1 ? 's' : ''}. Total ${total}.`);
  }
  s.remove('hl').set('count', { text: `${total} ${squares ? 'squares' : 'rectangles'}`, fill: 'good', size: 20 });
  s.step(`${total} ${squares ? 'squares' : 'rectangles'} in all.`, { reveal: true });
  return s.build();
}

/** Venn: light up the regions being added. */
export function vennScene(labels: [string, string, string], r: number[], regions: number[], question: string) {
  const s = scene();
  const C: [number, number][] = [[140, 88], [220, 88], [180, 152]];
  C.forEach(([x, y], i) => s.add(circle(`o${i}`, x, y, 64, { fill: 'none', stroke: 'ink', sw: 2 }), text(`ol${i}`, i === 2 ? x : i === 0 ? x - 60 : x + 60, i === 2 ? y + 76 : 16, labels[i], { size: 14, weight: 700 })));
  const pos: [number, number][] = [[112, 72], [248, 72], [180, 182], [180, 62], [142, 136], [218, 136], [180, 108]];
  r.forEach((v, i) => s.add(text(`n${i}`, pos[i][0], pos[i][1], v, { size: 15, weight: 600, fill: 'muted' })));
  s.step(question);
  let sum = 0;
  regions.forEach((ri, k) => {
    sum += r[ri];
    s.set(`n${ri}`, { fill: 'accent', weight: 800, size: 18, pulse: true });
    s.add(text('sum', 330, 200, sum, { size: 22, weight: 800, fill: 'accent', anchor: 'end', pulse: true }));
    s.step(k === 0 ? `Start with ${r[ri]}.` : `Add ${r[ri]}: ${sum}.`);
  });
  s.set('sum', { fill: 'good' });
  s.step(`${regions.map((i) => r[i]).join(' + ')} = ${sum}.`, { reveal: true });
  return s.build();
}

/** Handshakes: each person shakes with everyone after them. */
export function handshakesScene(n: number, games = false) {
  const who = games ? 'Team' : 'Friend', act = games ? 'plays' : 'shakes with';
  const s = scene();
  const cx = 140, cy = 112, R = 84;
  const pt = (i: number): [number, number] => [cx + Math.sin((i / n) * Math.PI * 2) * R, cy - Math.cos((i / n) * Math.PI * 2) * R];
  for (let i = 0; i < n; i++) s.add(circle(`p${i}`, ...pt(i), 13, { fill: 'fill', stroke: 'ink', sw: 2 }), text(`p${i}-t`, ...pt(i), i + 1, { size: 13, weight: 700 }));
  s.step(`${n} ${games ? 'teams' : 'friends'}.`);
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const [x1, y1] = pt(i), [x2, y2] = pt(j);
      const len = Math.hypot(x2 - x1, y2 - y1), ux = ((x2 - x1) / len) * 14, uy = ((y2 - y1) / len) * 14;
      s.add(line(`e${i}-${j}`, x1 + ux, y1 + uy, x2 - x1 - 2 * ux, y2 - y1 - 2 * uy, { stroke: i % 2 ? 's2' : 's1', sw: 1.5, draw: true }));
    }
    total += n - 1 - i;
    s.set(`p${i}`, { fill: 'accent', stroke: 'accent' }).set(`p${i}-t`, { fill: 'fill' });
    s.add(text('t', 300, 112, total, { size: 28, weight: 800, fill: 'accent', pulse: true }));
    s.step(`${who} ${i + 1} ${act} ${n - 1 - i} new ${who.toLowerCase()}${n - 1 - i === 1 ? '' : 's'}. Total ${total}.`);
  }
  s.set('t', { fill: 'good' });
  s.step(`${Array.from({ length: n - 1 }, (_, k) => n - 1 - k).join(' + ')} = ${total}.`, { reveal: true });
  return s.build();
}

/* ---------------- puzzles ---------------- */

/** Letter puzzle: columns, try digits, check. */
export function cryptScene(top: string, bottom: string, result: string, op: '+' | '-', letters: Record<string, number>) {
  const s = scene();
  const cols = Math.max(top.length, bottom.length, result.length);
  const cx = (i: number, len: number) => 220 - (len - 1 - i) * 34;
  const row = (id: string, str: string, y: number) => str.split('').forEach((ch, i) => s.add(text(`${id}${i}`, cx(i, str.length), y, ch, { size: 26, weight: 700, fill: /[A-Z]/.test(ch) ? 'accent' : 'ink' })));
  row('t', top, 40); row('b', bottom, 82); row('r', result, 136);
  s.add(text('op', cx(0, cols) - 40, 82, op === '+' ? '+' : '−', { size: 26, weight: 700 }), line('bar', cx(0, cols) - 54, 106, cols * 34 + 34, 0, { stroke: 'ink', sw: 2.5 }));
  s.step('Each letter is one digit. Start with the ones column.');
  s.add(rect('col', cx(cols - 1, cols) - 18, 20, 36, 136, { fill: 'none', stroke: 's2', sw: 2.5, rx: 8, pulse: true }));
  s.step('Look at the ones column. Which digit makes it work?');
  const sub = (str: string) => str.replace(/[A-Z]/g, (ch) => String(letters[ch]));
  const fill = (id: string, str: string) => str.split('').forEach((ch, i) => /[A-Z]/.test(ch) && s.set(`${id}${i}`, { text: String(letters[ch]), fill: 'good', pulse: true }));
  fill('t', top); fill('b', bottom); fill('r', result);
  s.remove('col');
  s.add(text('ans', W / 2, 190, Object.entries(letters).map(([k, v]) => `${k} = ${v}`).join(', '), { size: 20, weight: 700, fill: 'good' }));
  s.step(`${Object.entries(letters).map(([k, v]) => `${k} is ${v}`).join(', ')}. Check: ${sub(top)} ${op === '+' ? 'plus' : 'minus'} ${sub(bottom)} = ${sub(result)}.`, { reveal: true });
  return s.build();
}

/** Made-up operation: copy the recipe, swap in the numbers, work it out. */
export function recipeScene(show: string, parts: { a: number; b: number; calc: string }[], final?: string) {
  const s = scene();
  s.add(text('r', W / 2, 30, show.replace('a ★ b means ', 'a ★ b = '), { size: 18, weight: 700 }));
  s.step('The recipe: put the first number in for a and the second for b.');
  parts.forEach((p, i) => {
    const [lhs, ...rest] = p.calc.split(' = ');
    s.add(text(`q${i}`, W / 2, 80 + i * 60, `${p.a} ★ ${p.b}`, { size: 18, weight: 700, fill: 'accent' }));
    s.step(`Now ${p.a} star ${p.b}.`);
    s.set(`q${i}`, { text: `${p.a} ★ ${p.b} = ${lhs}` });
    s.step(`Swap in the numbers: ${lhs}.`);
    s.set(`q${i}`, { text: `${p.a} ★ ${p.b} = ${rest.join(' = ')}`, fill: 'good', pulse: true });
    s.step(`Work it out: ${rest.join(' = ')}.`, { reveal: true });
  });
  if (final) {
    s.add(text('f', W / 2, 200, final, { size: 20, weight: 700, fill: 'good', pulse: true }));
    s.step(final, { reveal: true });
  }
  return s.build();
}

/** Shape equations: each shape hides a number; solve one, use it in the next. */
export function shapeScene(eqs: string[], reveals: [string, string][], final: string) {
  const s = scene();
  eqs.forEach((e, i) => s.add(text(`e${i}`, W / 2, 40 + i * 40, e, { size: 22, weight: 700 })));
  s.step('Each shape stands for a number.');
  reveals.forEach(([say, line2], i) => {
    s.add(text(`v${i}`, W / 2, 40 + (eqs.length + i) * 36 + 10, line2, { size: 20, weight: 700, fill: 'accent', pulse: true }));
    s.step(say);
  });
  s.add(text('f', W / 2, 205, final, { size: 22, weight: 800, fill: 'good', pulse: true }));
  const said = final.replace(/■/g, 'square').replace(/▲/g, 'triangle').replace(/●/g, 'circle');
  s.step(`${said[0].toUpperCase()}${said.slice(1)}.`, { reveal: true });
  return s.build();
}

/** Packages: check each total in the range; the one that can't be made. */
export function packagesScene(a: number, b: number, L: number, bad: number) {
  const s = scene();
  const nums = Array.from({ length: 9 }, (_, i) => L + 1 + i);
  nums.forEach((v, i) => s.add(rect(`n${i}`, 14 + (i % 3) * 112, 34 + Math.floor(i / 3) * 52, 104, 40, { fill: 'fill', stroke: 'line' }), text(`n${i}-t`, 66 + (i % 3) * 112, 54 + Math.floor(i / 3) * 52, v, { size: 16, weight: 700 })));
  s.step(`Packs of ${a} and ${b}. Check every number from ${L + 1} to ${L + 9}.`);
  nums.forEach((v, i) => {
    let how = '';
    for (let k = 0; k * b <= v && !how; k++) if ((v - k * b) % a === 0) how = `${k ? `${k}×${b}` : ''}${k && v - k * b ? '+' : ''}${v - k * b ? `${(v - k * b) / a}×${a}` : ''}`;
    s.set(`n${i}`, { fill: how ? 's1' : 'bad', stroke: how ? 's1' : 'bad' }).set(`n${i}-t`, { text: how ? `${v} = ${how}` : `${v} ✗`, size: 13, fill: how ? 'ink' : 'fill', pulse: true });
    if (i % 3 === 2) {
      const row = nums.slice(i - 2, i + 1);
      s.step(row.includes(bad) ? `${bad} can't be made from packs of ${a} and ${b}.` : `${row.join(', ')}: each one can be made.`, row.includes(bad) ? { reveal: true } : {});
    }
  });
  s.step(`Every number can be made except ${bad}.`, { reveal: true });
  return s.build();
}

/** Balance: swap things for equal weights, then take the same off both sides. */
const GLYPH: Record<string, Role> = { '▲': 's1', '●': 's2', '■': 's1', '◆': 'good' };

export function balanceScene(left: string[], right: string[], steps: { say: string; left: string[]; right: string[]; reveal?: boolean }[], legend?: string) {
  const s = scene();
  const draw = (l: string[], r: string[]) => {
    s.remove('L*', 'R*');
    l.forEach((t, i) => s.add(text(`L${i}-${t}`, 40 + (i % 6) * 22, 100 - Math.floor(i / 6) * 24, t, { size: 20, fill: GLYPH[t] ?? 'ink' })));
    r.forEach((t, i) => s.add(text(`R${i}-${t}`, 210 + (i % 6) * 22, 100 - Math.floor(i / 6) * 24, t, { size: 20, fill: GLYPH[t] ?? 'ink' })));
  };
  if (legend) s.add(text('legend', W / 2, 204, legend, { size: 14, fill: 'muted', weight: 500 }));
  s.add(path('beam', 20, 120, 'M0 0 H320', { stroke: 'ink', sw: 3 }), path('stand', 170, 120, 'M0 0 L-16 50 H16 Z', { fill: 'line', stroke: 'ink', sw: 2 }));
  draw(left, right);
  s.step('Both sides weigh the same.');
  for (const st of steps) {
    draw(st.left, st.right);
    s.step(st.say, st.reveal ? { reveal: true } : {});
  }
  return s.build();
}

/** Palindrome: mirror pairs, fill what we know, then the missing digit. */
export function palindromeScene(template: (number | null)[], full: number[], digits: number[]) {
  const s = scene();
  const n = full.length, bw = 38, x0 = (W - n * (bw + 6)) / 2;
  const cx = (i: number) => x0 + i * (bw + 6) + bw / 2;
  full.forEach((_, i) => s.add(rect(`b${i}`, cx(i) - bw / 2, 100, bw, 46, { fill: 'fill', stroke: 'line', rx: 8 }), text(`b${i}-t`, cx(i), 123, template[i] ?? '', { size: 22, weight: 700 })));
  s.add(text('d', W / 2, 190, `use ${digits.join(', ')}`, { size: 15, fill: 'muted' }));
  s.step('The same forward and backward.');
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const j = n - 1 - i;
    s.add(path(`m${i}`, cx(i), 96, `M0 0 Q${(cx(j) - cx(i)) / 2} ${-30 - i * 10} ${cx(j) - cx(i)} 0`, { stroke: 'muted', sw: 1.5, dash: true }));
  }
  s.step('Matching places: first and last, second and second-to-last…');
  full.forEach((d, i) => {
    const j = n - 1 - i;
    if (template[i] === null && template[j] !== null) s.set(`b${i}-t`, { text: String(d), fill: 'accent', pulse: true });
  });
  s.step('Copy each digit into its mirror place.');
  full.forEach((d, i) => template[i] === null && template[n - 1 - i] === null && s.set(`b${i}-t`, { text: String(d), fill: 'good', pulse: true }));
  s.set('d', { text: full.join(''), fill: 'good', size: 22, weight: 700 });
  s.step(`The digit still missing fills the rest: ${full.join('')}.`, { reveal: true });
  return s.build();
}

/** Spot the palindrome: read each option backwards. */
export function spotPalScene(options: string[], answerIndex: number) {
  const s = scene();
  options.forEach((o, i) => s.add(text(`o${i}`, 90, 40 + i * 44, `(${String.fromCharCode(97 + i)}) ${o}`, { size: 18, weight: 600, anchor: 'start' })));
  s.step('Read each number backwards.');
  options.forEach((o, i) => {
    const back = o.replace(/,/g, '').split('').reverse().join('');
    const ok = i === answerIndex;
    s.add(text(`r${i}`, 250, 40 + i * 44, `${back} ${ok ? '✓' : '✗'}`, { size: 18, weight: 700, anchor: 'start', fill: ok ? 'good' : 'bad', pulse: true }));
    s.step(`${o} backwards is ${back}${ok ? ': the same!' : '.'}`, ok ? { reveal: true } : {});
  });
  return s.build();
}

/** Next palindrome: mirror the left half; bump the middle if that's too small. */
export function nextPalScene(n: number, mirror: number, next: number) {
  const s = scene();
  s.add(text('n', W / 2, 50, String(n), { size: 32, weight: 700, fill: 'muted' }));
  s.step(`Start from ${n}.`);
  s.add(text('m', W / 2, 110, String(mirror), { size: 32, weight: 700, fill: mirror > n ? 'good' : 'bad', pulse: true }));
  s.step(`Mirror the first half: ${mirror}. ${mirror > n ? 'It is bigger, so it works.' : `Not bigger than ${n}.`}`, mirror > n ? { reveal: true } : {});
  if (mirror <= n) {
    s.add(text('x', W / 2, 170, String(next), { size: 32, weight: 800, fill: 'good', pulse: true }));
    s.step(`Make the middle bigger: ${next}.`, { reveal: true });
  }
  return s.build();
}

/** Magic boards: shared circles count twice; fill the middle, then the pairs. */
export function boardScene(points: [number, number][], lines: number[][], target: number, solution: number[], shared: number[], explain: string[]) {
  const s = scene();
  const sx = (x: number) => 40 + x * 0.95, sy = (y: number) => 10 + y * 0.78;
  lines.forEach((l, i) => s.add(path(`ln${i}`, 0, 0, l.map((p, k) => `${k ? 'L' : 'M'}${sx(points[p][0])} ${sy(points[p][1])}`).join(' '), { stroke: 'line', sw: 3 })));
  points.forEach(([x, y], i) => s.add(circle(`c${i}`, sx(x), sy(y), 18, { fill: 'fill', stroke: 'ink', sw: 2 }), text(`c${i}-t`, sx(x), sy(y), '', { size: 18, weight: 800 })));
  s.add(text('goal', 320, 30, `= ${target}`, { size: 20, weight: 700, anchor: 'end' }));
  s.step(`Each line must add to ${target}.`);
  explain.forEach((e, i) => {
    if (i === explain.length - 1) {
      shared.forEach((k) => s.set(`c${k}`, { stroke: 'accent', sw: 3 }).set(`c${k}-t`, { text: String(solution[k]), fill: 'accent', pulse: true }));
    }
    s.step(e);
  });
  solution.forEach((d, k) => !shared.includes(k) && s.set(`c${k}-t`, { text: String(d), fill: 'good', pulse: true }));
  s.step(`Pair up the rest so every line makes ${target}.`, { reveal: true });
  return s.build();
}

/** Corner square: each side = two corners + two numbers. */
export function cornerScene(sides: [number, number][], T: number, x: number) {
  const s = scene();
  const c: [number, number][] = [[80, 30], [280, 30], [280, 190], [80, 190]];
  s.add(rect('sq', 80, 30, 200, 160, { fill: 'none', stroke: 'line', sw: 2, rx: 0 }));
  const mids: [number, number][][] = [[[147, 30], [213, 30]], [[280, 83], [280, 137]], [[213, 190], [147, 190]], [[80, 137], [80, 83]]];
  sides.forEach((pr, i) => pr.forEach((v, j) => s.add(rect(`m${i}${j}`, mids[i][j][0] - 14, mids[i][j][1] - 14, 28, 28, { fill: 'fill', stroke: 'line' }), text(`m${i}${j}-t`, mids[i][j][0], mids[i][j][1], v, { size: 15, weight: 700 }))));
  c.forEach(([cx, cy], i) => s.add(circle(`k${i}`, cx, cy, 16, { fill: 'fill', stroke: 'ink', sw: 2 }), text(`k${i}-t`, cx, cy, '?', { size: 16, weight: 800 })));
  s.step(`Each side must add to ${T}.`);
  s.set('m00', { fill: 's1', stroke: 's1' }).set('m01', { fill: 's1', stroke: 's1' });
  s.add(text('w', 180, 110, `${sides[0][0]} + ${sides[0][1]} = ${sides[0][0] + sides[0][1]}`, { size: 18, weight: 700 }));
  s.step(`On the top side the two numbers make ${sides[0][0] + sides[0][1]}.`);
  s.set('w', { text: `${T} − ${sides[0][0] + sides[0][1]} = ${T - sides[0][0] - sides[0][1]} for 2 corners` });
  s.step(`The two corners must make ${T} − ${sides[0][0] + sides[0][1]} = ${2 * x}.`);
  c.forEach((_, i) => s.set(`k${i}`, { fill: 'good', stroke: 'good' }).set(`k${i}-t`, { text: String(x), fill: 'fill', pulse: true }));
  s.set('w', { text: `${2 * x} ÷ 2 = ${x}`, fill: 'good' });
  s.step(`Each corner is ${2 * x} ÷ 2 = ${x}.`, { reveal: true });
  return s.build();
}

