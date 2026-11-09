/**
 * Weekly progress email: content (HTML + plain text) and scheduling helpers.
 * Numbers come from the same summarize() the dashboard uses, so both always agree.
 */
import { cogatWeek, outcomeLabel, summarize, topicTitle, type DashboardData } from '../src/core/insights';
import { formatAnswer } from '../src/core/answer';
import { problemFromId } from '../src/content/topics';

export const DIGEST_TZ = 'America/Chicago';

/** Local weekday/hour/date in a time zone (Workers support IANA zones through Intl). */
export function localParts(now: number, tz = DIGEST_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value])
  );
  return { weekday: parts.weekday as string, hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
}

/**
 * The send window is Sunday 5 pm to Monday 6 am local time. GitHub's cron runs at both Sunday-evening UTC
 * slots (Central daylight time vs standard time), and may run late. Returns the week key (the Sunday's date) or null.
 */
export function sendWindow(now: number, tz = DIGEST_TZ): string | null {
  const p = localParts(now, tz);
  if (p.weekday === 'Sun' && p.hour >= 17) return p.date;
  if (p.weekday === 'Mon' && p.hour < 6) return localParts(now - 12 * 3_600_000, tz).date;
  return null;
}

/** The week key for "this week" at any time (most recent Sunday), used to label test emails. */
export function currentWeekKey(now: number, tz = DIGEST_TZ): string {
  for (let i = 0; i < 7; i++) {
    const p = localParts(now - i * 86_400_000, tz);
    if (p.weekday === 'Sun') return p.date;
  }
  return localParts(now, tz).date;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const richHtml = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const plain = (s: string) => s.replace(/\*\*/g, '');

const C = { blue: '#2a78d6', orange: '#eb6834', ink: '#1d2433', muted: '#5f6b80', line: '#dde2ee', bg: '#f6f7fb', good: '#2b8a3e', bad: '#c92a2a' };

export interface DigestLinks {
  appUrl: string;
  unsubscribeUrl: string;
}

export interface Digest {
  subject: string;
  html: string;
  text: string;
}

/** Returns null when there is nothing worth sending (no practice in the last 4 weeks). */
export function buildDigest(data: DashboardData, links: DigestLinks, now = Date.now(), opts: { test?: boolean } = {}): Digest | null {
  const s = summarize(data, now);
  const recent = data.attempts.some((a) => a.ts >= now - 28 * 86_400_000);
  if (!recent && !opts.test) return null;

  const name = data.child.name?.trim() || 'Your child';
  const nameEsc = esc(name);
  const practiced = s.week.problems > 0;
  const subject = (opts.test ? '[Test] ' : '') + (practiced
    ? `${name}'s math week: ${s.week.problems} problem${s.week.problems === 1 ? '' : 's'}, ${s.week.pct}% right first try`
    : `${name} didn't practice math this week`);

  const d = (now: number | null, before: number | null, unit = '') => {
    if (now === null || before === null || now === before) return '';
    return `${now > before ? '▲' : '▼'} ${Math.abs(now - before)}${unit} vs last week`;
  };
  const kpis: [string, string, string][] = [
    [String(s.week.problems), 'problems', d(s.week.problems, s.prevWeek.problems)],
    [s.week.pct === null ? '–' : `${s.week.pct}%`, 'right first try', d(s.week.pct, s.prevWeek.pct, ' pts')],
    [String(s.week.minutes), 'minutes', d(s.week.minutes, s.prevWeek.minutes, ' min')],
    [`${s.week.days}/7`, 'days practiced', s.streak ? `🔥 ${s.streak}-day streak` : '']
  ];

  const last7 = s.daily.slice(-7);
  const max = Math.max(1, ...last7.map((x) => x.firstTry + x.other));
  const dayName = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const bar = (n: number, color: string) => (n ? `<div style="height:${Math.round((n / max) * 64)}px;background:${color};border-radius:3px 3px 0 0;margin-top:2px"></div>` : '');
  const chart = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${last7
    .map((x) => `<td valign="bottom" align="center" style="height:72px;padding:0 3px;width:14%">${bar(x.other, C.orange)}${bar(x.firstTry, C.blue)}</td>`)
    .join('')}</tr><tr>${last7
    .map((x) => `<td align="center" style="font-size:12px;color:${C.muted};padding-top:4px">${dayName(x.date)}<br>${x.firstTry + x.other || '·'}</td>`)
    .join('')}</tr></table>
    <p style="font-size:12px;color:${C.muted};margin:6px 0 0"><span style="color:${C.blue}">■</span> first try &nbsp; <span style="color:${C.orange}">■</span> with help</p>`;

  const weekMeets = s.meets.filter((m) => m.date >= now - 7 * 86_400_000);
  const cogat = cogatWeek(data, now);
  const cogatDay = (ts: number) => new Date(ts).toLocaleDateString('en-US', { weekday: 'long', timeZone: DIGEST_TZ });
  const cogatLines = cogat
    ? [
        ...(cogat.problems ? [`${cogat.problems} question${cogat.problems === 1 ? '' : 's'}, ${cogat.pct}% right first try`] : []),
        ...(cogat.lastRound ? [`Last round (${cogatDay(cogat.lastRound.at)}): ${cogat.lastRound.score}`] : []),
        ...cogat.byType.map((r) => `${r.title}: ${r.right} of ${r.total}`)
      ]
    : [];
  const mistakes = s.mistakes.filter((m) => m.ts >= now - 7 * 86_400_000).slice(0, 3);

  const section = (title: string, body: string) =>
    `<tr><td style="padding:18px 24px 0"><h2 style="font-size:16px;margin:0 0 8px;color:${C.ink}">${title}</h2>${body}</td></tr>`;
  const list = (items: string[]) => `<ul style="margin:0;padding-left:20px;color:${C.ink};font-size:14px;line-height:1.5">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join('')}</ul>`;

  const parts: string[] = [];
  parts.push(`<tr><td style="padding:24px 24px 0">
    <h1 style="margin:0;font-size:22px;color:${C.ink}">${practiced ? `${nameEsc}'s math week` : `A quiet week for ${nameEsc}`}</h1></td></tr>`);
  parts.push(`<tr><td style="padding:16px 18px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${kpis
    .map(([v, l, sub]) => `<td style="padding:6px;width:25%" valign="top"><div style="border:1px solid ${C.line};border-radius:12px;padding:10px">
      <div style="font-size:22px;font-weight:800;color:${C.ink}">${v}</div><div style="font-size:12px;color:${C.muted}">${l}</div>
      ${sub ? `<div style="font-size:11px;color:${C.muted};margin-top:2px">${esc(sub)}</div>` : ''}</div></td>`)
    .join('')}</tr></table></td></tr>`);
  if (practiced) parts.push(section('This week', chart));
  if (s.needsHelp.length || s.strong.length) {
    const items: string[] = [];
    if (s.needsHelp.length) items.push(`<strong style="color:${C.bad}">Needs help:</strong> ${s.needsHelp.slice(0, 3).map((t) => esc(t.title)).join(', ')}`);
    if (s.strong.length) items.push(`<strong style="color:${C.good}">Strong:</strong> ${s.strong.slice(0, 3).map((t) => esc(t.title)).join(', ')}`);
    parts.push(section('Topics', list(items)));
  }
  if (cogatLines.length) parts.push(section('CogAT', list(cogatLines.map(esc))));
  if (weekMeets.length) parts.push(section('Tests', list(weekMeets.map((m) => `${m.score} of ${m.total} in ${Math.round(m.seconds / 60)} minutes`))));
  if (mistakes.length) {
    parts.push(section('Mistakes', mistakes.map((m) => {
      const p = problemFromId(m.problemId);
      return `<div style="border-left:3px solid ${C.line};padding:4px 0 4px 12px;margin:0 0 12px;font-size:14px;color:${C.ink}">
        <div style="font-size:12px;color:${C.muted}">${esc(topicTitle(m.topicId))}</div>
        ${p ? `<div style="margin:4px 0">${richHtml(p.text)}</div>` : ''}
        <div style="font-size:13px">Yours: <strong>${esc(outcomeLabel(m))}</strong>${p ? ` · Correct: <strong>${esc(formatAnswer(p.answer))}</strong>` : ''}</div></div>`;
    }).join('')));
  }
  if (s.tips.length) parts.push(section('Next week', list(s.tips.slice(0, 3).map(esc))));
  parts.push(`<tr><td style="padding:22px 24px 6px"><a href="${esc(links.appUrl)}" style="display:inline-block;background:${C.blue};color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">Open Math Coach</a></td></tr>`);
  parts.push(`<tr><td style="padding:16px 24px 24px;font-size:11px;color:${C.muted};line-height:1.5;border-top:1px solid ${C.line}">
    Sent because you turned on weekly email in the Math Coach parent dashboard. <a href="${esc(links.unsubscribeUrl)}" style="color:${C.muted}">Unsubscribe</a></td></tr>`);

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:${C.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:16px 8px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;border:1px solid ${C.line}">
${parts.join('\n')}
</table></td></tr></table></body></html>`;

  const t: string[] = [];
  t.push(practiced ? `${name}'s math week` : `A quiet week for ${name}`, '');
  for (const [v, l, sub] of kpis) t.push(`- ${l}: ${v}${sub ? ` (${sub})` : ''}`);
  if (practiced) t.push('', 'Day by day: ' + last7.map((x) => `${dayName(x.date)} ${x.firstTry + x.other}`).join(', '));
  if (s.needsHelp.length) t.push('', `Needs help: ${s.needsHelp.slice(0, 3).map((x) => x.title).join(', ')}`);
  if (s.strong.length) t.push(`Strong: ${s.strong.slice(0, 3).map((x) => x.title).join(', ')}`);
  if (cogatLines.length) t.push('', 'CogAT:', ...cogatLines.map((x) => `- ${x}`));
  if (weekMeets.length) t.push('', ...weekMeets.map((m) => `Test: ${m.score} of ${m.total}`));
  if (mistakes.length) {
    t.push('', 'Mistakes:');
    for (const m of mistakes) {
      const p = problemFromId(m.problemId);
      t.push(`* ${p ? plain(p.text) : topicTitle(m.topicId)}`, `  Yours: ${outcomeLabel(m)}.${p ? ` Correct: ${formatAnswer(p.answer)}` : ''}`);
    }
  }
  if (s.tips.length) t.push('', 'Next week:', ...s.tips.slice(0, 3).map((x) => `- ${x}`));
  t.push('', `Open Math Coach: ${links.appUrl}`, '', `Unsubscribe: ${links.unsubscribeUrl}`);

  return { subject, html, text: t.join('\n') };
}
