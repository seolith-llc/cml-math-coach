import { h } from './dom';

/**
 * Small SVG charts for the parent dashboard (no chart library).
 * Colors come from CSS tokens (--series-1/2, validated for light and dark mode), and text uses the text tokens.
 * Every chart has a hover/tap tooltip and a "Show as table" view.
 */

const NS = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Bar with only its top corners rounded (data end), square at the baseline. */
function topRounded(x: number, y: number, w: number, hgt: number, r: number): string {
  const rr = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + hgt} Z`;
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const step = v <= 20 ? 5 : v <= 50 ? 10 : 20;
  return Math.ceil(v / step) * step;
}

function withTooltip(svg: SVGSVGElement) {
  const tip = h('div', { class: 'viz-tip', role: 'status', hidden: true });
  const wrap = h('div', { class: 'viz-wrap' }, svg as unknown as Node, tip);
  const show = (html: string, target: Element) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const wr = wrap.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const x = tr.left + tr.width / 2 - wr.left;
    tip.style.left = `${Math.min(Math.max(x, 70), wr.width - 70)}px`;
    tip.style.top = `${Math.max(0, tr.top - wr.top - 8)}px`;
  };
  const hide = () => (tip.hidden = true);
  return { wrap, show, hide };
}

function table(headers: string[], rows: (string | number)[][]) {
  return h('details', { class: 'viz-table' },
    h('summary', {}, 'Table'),
    h('div', { class: 'table-scroll' },
      h('table', {},
        h('thead', {}, h('tr', {}, ...headers.map((x) => h('th', { scope: 'col' }, x)))),
        h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, String(c)))))))));
}

const shortDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export function dailyChart(daily: { date: string; firstTry: number; other: number; minutes: number }[]): HTMLElement {
  const W = 640, H = 220, L = 30, R = 6, T = 10, B = 26;
  const max = niceMax(Math.max(0, ...daily.map((d) => d.firstTry + d.other)));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const slot = (W - L - R) / daily.length;
  const bw = Math.max(2, slot - 2); // 2px surface gap between neighbouring bars
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'viz', role: 'img', 'aria-label': 'Problems per day for the last 30 days' });
  for (const v of [0, max / 2, max]) {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'viz-grid' }));
    const t = s('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'viz-axis' });
    t.textContent = String(v);
    svg.append(t);
  }
  const { wrap, show, hide } = withTooltip(svg);
  daily.forEach((d, i) => {
    const x = L + i * slot + 1;
    const total = d.firstTry + d.other;
    if (d.firstTry) {
      const top = y(d.firstTry);
      const hgt = y(0) - top;
      svg.append(s('path', { d: d.other ? `M${x},${top} h${bw} v${hgt} h${-bw} Z` : topRounded(x, top, bw, hgt, 4), class: 'viz-s1' }));
    }
    if (d.other) {
      const top = y(total);
      const hgt = y(d.firstTry) - top - (d.firstTry ? 2 : 0); // 2px surface gap between stacked segments
      if (hgt > 0) svg.append(s('path', { d: topRounded(x, top, bw, hgt, 4), class: 'viz-s2' }));
    }
    if (i % 7 === 1) {
      const t = s('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'viz-axis' });
      t.textContent = shortDate(d.date);
      svg.append(t);
    }
    const hit = s('rect', { x: L + i * slot, y: T, width: slot, height: H - T - B, class: 'viz-hit', tabindex: 0 });
    const html = `<strong>${esc(shortDate(d.date))}</strong><br>${total ? `${d.firstTry} first try · ${d.other} with help<br>${d.minutes} min` : 'No practice'}`;
    hit.addEventListener('pointerenter', () => show(html, hit));
    hit.addEventListener('focus', () => show(html, hit));
    hit.addEventListener('click', () => show(html, hit));
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
    svg.append(hit);
  });
  return h('figure', { class: 'viz-figure', 'aria-label': 'Problems per day, last 30 days' },
    h('div', { class: 'viz-legend' },
      h('span', {}, h('i', { class: 'swatch s1' }), 'First try'),
      h('span', {}, h('i', { class: 'swatch s2' }), 'With help')),
    wrap,
    table(['Date', 'First try', 'With help / missed', 'Minutes'], daily.filter((d) => d.firstTry + d.other).map((d) => [shortDate(d.date), d.firstTry, d.other, d.minutes])));
}

export function meetChart(meets: { date: number; score: number; total: number; seconds: number }[]): HTMLElement {
  const W = 640, H = 180, L = 30, R = 16, T = 14, B = 26;
  const y = (v: number) => T + (H - T - B) * (1 - v / 6);
  const x = (i: number) => (meets.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (meets.length - 1));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'viz', role: 'img', 'aria-label': 'Mock meet scores out of 6' });
  for (const v of [0, 3, 6]) {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'viz-grid' }));
    const t = s('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'viz-axis' });
    t.textContent = String(v);
    svg.append(t);
  }
  if (meets.length > 1) svg.append(s('polyline', { points: meets.map((m, i) => `${x(i)},${y(m.score)}`).join(' '), class: 'viz-line' }));
  const { wrap, show, hide } = withTooltip(svg);
  meets.forEach((m, i) => {
    svg.append(s('circle', { cx: x(i), cy: y(m.score), r: 5, class: 'viz-dot' }));
    const hit = s('circle', { cx: x(i), cy: y(m.score), r: 14, class: 'viz-hit', tabindex: 0 });
    const html = `<strong>${new Date(m.date).toLocaleDateString()}</strong><br>${m.score} / ${m.total} correct<br>${Math.round(m.seconds / 60)} min used`;
    hit.addEventListener('pointerenter', () => show(html, hit));
    hit.addEventListener('focus', () => show(html, hit));
    hit.addEventListener('click', () => show(html, hit));
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
    svg.append(hit);
  });
  const last = meets[meets.length - 1];
  const lbl = s('text', { x: Math.min(x(meets.length - 1) + 10, W - R - 40), y: y(last.score) - 10, class: 'viz-label' });
  lbl.textContent = `${last.score}/6`;
  svg.append(lbl);
  return h('figure', { class: 'viz-figure', 'aria-label': 'Mock meet scores out of 6' },
    wrap,
    table(['Date', 'Score', 'Minutes'], meets.map((m) => [new Date(m.date).toLocaleDateString(), `${m.score} / ${m.total}`, Math.round(m.seconds / 60)])));
}
