import { circle, hop, numberLine, rect, scene, text, W } from './kit';

/** Magic square: find the total from a full line, then fill a box whose line has one gap (twice at level 3). */
export function magicScene(grid: (number | null)[], full: number[], total: number, order: { cell: number; line: number[]; value: number }[], ask: number) {
  const s = scene();
  const x0 = W / 2 - 81;
  const at = (i: number) => ({ x: x0 + (i % 3) * 54, y: 22 + Math.floor(i / 3) * 54 });
  grid.forEach((v, i) => {
    const p = at(i);
    s.add(rect(`c${i}`, p.x, p.y, 50, 50, { fill: 'fill', stroke: 'line', rx: 6 }), text(`t${i}`, p.x + 25, p.y + 31, v === null ? (i === ask ? '?' : '') : v, { size: 20, weight: 700, fill: i === ask ? 'accent' : 'ink' }));
  });
  s.step('Every row, column and diagonal adds up to the same total.');
  full.forEach((i) => s.set(`c${i}`, { fill: 's1', stroke: 's1' }));
  s.add(text('sum', W / 2, 200, `${full.map((i) => grid[i]).join(' + ')} = ${total}`, { size: 18, weight: 700, fill: 'accent', pulse: true }));
  s.step(`This line is full: ${full.map((i) => grid[i]).join(' plus ')} is ${total}. So every line adds to ${total}.`);
  order.forEach((o, k) => {
    s.remove('sum');
    for (let i = 0; i < 9; i++) s.set(`c${i}`, { fill: 'fill', stroke: 'line' });
    o.line.forEach((i) => s.set(`c${i}`, { fill: i === o.cell ? 'accent' : 's2', stroke: i === o.cell ? 'accent' : 's2' }));
    const known = o.line.filter((i) => i !== o.cell).map((i) => (grid[i] ?? order.find((x) => x.cell === i)!.value));
    s.add(text('sum', W / 2, 200, `${total} − ${known.join(' − ')} = ${o.value}`, { size: 18, weight: 700, fill: 'accent', pulse: true }));
    s.set(`t${o.cell}`, { text: String(o.value), fill: o.cell === ask ? 'good' : 'accent', pulse: true });
    const last = k === order.length - 1;
    s.step(`${last ? 'Now the box we want' : 'First, a box with only one gap in its line'}: ${total} take away ${known.join(' and ')} leaves ${o.value}.`, last ? { reveal: true } : {});
  });
  return s.build();
}

/** Rule machine: in → out pairs, the rule, then use it (forwards, or backwards for "what went in?"). */
export function ruleScene(pairs: [number, number][], rule: string, ask: { input?: number; output?: number }, answer: number, work: string) {
  const s = scene();
  s.add(text('hin', 110, 26, 'In', { size: 15, weight: 700, fill: 'muted' }), text('hout', 250, 26, 'Out', { size: 15, weight: 700, fill: 'muted' }));
  pairs.forEach(([a, b], i) => {
    const y = 34 + i * 34;
    s.add(rect(`r${i}`, 60, y, 240, 28, { fill: 'fill', stroke: 'line', rx: 6 }), text(`a${i}`, 110, y + 20, a, { size: 16, weight: 700 }), text(`b${i}`, 250, y + 20, b, { size: 16, weight: 700 }), text(`arr${i}`, 180, y + 20, '→', { size: 16, fill: 'muted' }));
  });
  const y = 34 + pairs.length * 34;
  s.add(rect('rq', 60, y, 240, 28, { fill: 'fill', stroke: 'accent', rx: 6 }), text('aq', 110, y + 20, ask.input ?? '?', { size: 16, weight: 700, fill: ask.input === undefined ? 'accent' : 'ink' }), text('bq', 250, y + 20, ask.output ?? '?', { size: 16, weight: 700, fill: ask.output === undefined ? 'accent' : 'ink' }), text('arrq', 180, y + 20, '→', { size: 16, fill: 'muted' }));
  s.step('Each number goes into the machine and comes out changed by the same rule.');
  pairs.forEach((_, i) => s.set(`r${i}`, { fill: 's1', stroke: 's1' }));
  s.add(text('rule', W / 2, 206, `Rule: ${rule}`, { size: 18, weight: 800, fill: 'accent', pulse: true }));
  s.step(`Check every pair: the rule is ${rule.replace('×', 'times').replace('+', 'plus').replace('−', 'minus')}.`);
  s.set(ask.input === undefined ? 'aq' : 'bq', { text: String(answer), fill: 'good', pulse: true });
  s.set('rule', { text: work });
  s.step(ask.input === undefined ? `Work backwards: undo each step, in the opposite order. ${work}.` : `Use the rule: ${work}.`, { reveal: true });
  return s.build();
}

/** Heavy coin: each weighing splits the coins into three groups and keeps the one with the heavy coin. */
export function weighScene(start: number, sizes: number[], max?: number) {
  const s = scene();
  const row = (n: number, y: number, id: string) => {
    const shown = Math.min(n, 27);
    const per = Math.ceil(shown / 3);
    for (let i = 0; i < shown; i++) {
      const g = Math.floor(i / per);
      s.add(circle(`${id}${i}`, 40 + g * 110 + (i % per) * (per > 6 ? 9 : 14), y, per > 6 ? 4 : 6, { fill: g === 0 ? 's1' : g === 1 ? 's2' : 'fill', stroke: 'line', sw: 1 }));
    }
  };
  s.add(text('n', W / 2, 26, max ? `${sizes.length} weighings` : `${start} coins`, { size: 18, weight: 700 }));
  row(start, 60, 'a');
  s.step(max ? 'One weighing: left side down, right side down, or level. Three answers, so the coins split into three groups.' : `Split the ${start} coins into three groups: two on the scale, one off.`);
  sizes.forEach((n, k) => {
    s.add(text(`w${k}`, W / 2, 100 + k * 30, `Weighing ${k + 1}: ${k === 0 ? (max ? max : start) : sizes[k - 1]} → ${n}`, { size: 16, weight: 700, fill: 'accent', pulse: true }));
    const last = k === sizes.length - 1;
    s.step(max ? `Weighing ${k + 1} keeps one group of three: three times as many coins each time.` : `Weighing ${k + 1} tells which group has the heavy coin: only ${n} coin${n === 1 ? '' : 's'} left.`, last ? { reveal: true } : {});
  });
  return s.build();
}

/** Frog in a well: up by day, back by night, until one jump gets it out (no slide after that). */
export function wellScene(depth: number, up: number, back: number, days: number) {
  const s = scene();
  const nl = numberLine(s, 0, depth, [0, depth], 170);
  s.add(text('top', nl.pos(depth), 150, 'top', { size: 13, fill: 'muted' }));
  s.step(`The well is ${depth} feet deep. Each day the frog jumps up ${up}; each night it slides back ${back}.`);
  let at = 0;
  for (let d = 1; d <= days; d++) {
    const peak = at + up;
    const out = peak >= depth;
    hop(s, nl, `h${d}`, at, Math.min(peak, depth), `day ${d}`, out ? 'good' : 'accent');
    if (out) {
      s.step(`Day ${d}: from ${at} feet it jumps to ${peak}, past the top. It's out, so there is no slide back.`, { reveal: true });
      break;
    }
    at = peak - back;
    if (d <= 2 || d === days - 1) s.step(`Day ${d}: up to ${peak}, then back to ${at} at night: ${up - back} ${up - back === 1 ? 'foot' : 'feet'} higher each full day.`);
  }
  return s.build();
}
