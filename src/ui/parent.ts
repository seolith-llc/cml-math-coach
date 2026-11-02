import type { Category } from '../core/types';
import { summarize, topicTitle, type DashboardData, type PeriodStats, type TopicRow } from '../core/insights';
import { formatAnswer } from '../core/answer';
import { problemFromId } from '../content/topics';
import { dailyChart, meetChart } from './charts';
import { h, rich } from './dom';
import type { View } from './app';

/**
 * Parent dashboard: #/parent/<familyId>. Opened on the parent's own phone or laptop.
 * The family id comes from the private link; the PIN is asked here and never stored long-term
 * (only kept for this browser tab so refreshing doesn't ask again).
 */

const PIN_KEY = (id: string) => `cml-parent-pin:${id}`;
const getPin = (id: string) => {
  try {
    return sessionStorage.getItem(PIN_KEY(id)) ?? '';
  } catch {
    return '';
  }
};
const setPin = (id: string, pin: string | null) => {
  try {
    if (pin) sessionStorage.setItem(PIN_KEY(id), pin);
    else sessionStorage.removeItem(PIN_KEY(id));
  } catch {
    /* private mode: just ask again next time */
  }
};

function ago(ts: number | null): string {
  if (!ts) return 'never';
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const d = Math.round(hrs / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function delta(now: number | null, before: number | null, unit = '') {
  if (now === null || before === null) return h('span', { class: 'delta' }, 'no data for last week');
  const d = now - before;
  return h('span', { class: 'delta' }, d === 0 ? 'same as last week' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} vs last week`);
}

function kpi(label: string, value: string | number, sub?: Node | string) {
  return h('div', { class: 'kpi' }, h('span', { class: 'value' }, String(value)), h('span', { class: 'label' }, label), sub ? h('div', {}, sub) : null);
}

const STATUS: Record<TopicRow['status'], string> = { 'needs-help': '⚠️ Needs help', building: '🌱 Building', strong: '⭐ Strong', new: '○ Not tried' };

function meter(v: number | null) {
  const pct = Math.round((v ?? 0) * 100);
  return h('span', { class: 'meter', title: v === null ? 'No data' : `Mastery ${pct}%` }, h('span', { style: `width:${v === null ? 0 : Math.max(6, pct)}%` }));
}

function csv(data: DashboardData): string {
  const rows = [['date', 'time', 'mode', 'topic', 'grade', 'level', 'first_try', 'solved', 'skipped', 'hints', 'seconds', 'wrong_answer']];
  for (const a of [...data.attempts].sort((x, y) => x.ts - y.ts)) {
    const d = new Date(a.ts);
    rows.push([d.toISOString().slice(0, 10), d.toTimeString().slice(0, 5), a.mode, topicTitle(a.topicId), String(a.grade), String(a.level),
      a.firstTry ? 'yes' : 'no', a.correct ? 'yes' : 'no', a.skipped ? 'yes' : 'no', String(a.hints), String(a.seconds), a.answer ?? '']);
  }
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type EmailState = { address: string; verified: boolean } | null;

async function parentAction(familyId: string, pin: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch('./api/parent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ familyId, pin, action, ...extra })
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; email?: string | null };
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body;
}

/** "Weekly email" card: add, confirm, test or stop the Sunday-evening progress email. */
function emailCard(familyId: string, pin: string, initial: EmailState): HTMLElement {
  const card = h('div', { class: 'card' });
  let state = initial;
  const draw = (note?: { kind: 'good' | 'bad' | 'info'; text: string }) => {
    const msg = note ? h('p', { class: `feedback ${note.kind}`, role: 'status' }, note.text) : null;
    const busy = (btn: HTMLButtonElement, fn: () => Promise<void>) => async () => {
      btn.disabled = true;
      try {
        await fn();
      } catch (e) {
        draw({ kind: 'bad', text: (e as Error).message });
      } finally {
        btn.disabled = false;
      }
    };
    if (!state) {
      const input = h('input', { type: 'email', autocomplete: 'email', placeholder: 'you@example.com', 'aria-label': 'Your email address' });
      const btn = h('button', { class: 'btn primary', type: 'button' }, 'Send confirmation');
      btn.onclick = busy(btn, async () => {
        const r = await parentAction(familyId, pin, 'email-set', { email: input.value });
        state = { address: String(r.email), verified: false };
        draw({ kind: 'info', text: `We sent a confirmation link to ${r.email}. Open it to start the weekly emails.` });
      });
      card.replaceChildren(
        h('h2', {}, '📧 Weekly email'),
        h('p', { class: 'muted' }, 'Get a short summary every Sunday evening (US Central): the week in numbers, topics that need help, mistakes worth going over together, and ideas for next week.'),
        h('div', { class: 'link-box' }, input, btn),
        msg ?? '');
      return;
    }
    const test = h('button', { class: 'btn', type: 'button', disabled: !state.verified }, '✉️ Send a test now');
    test.onclick = busy(test, async () => {
      await parentAction(familyId, pin, 'email-test');
      draw({ kind: 'good', text: `Test email sent to ${state!.address}. Check your inbox (and spam folder).` });
    });
    const resend = h('button', { class: 'btn ghost', type: 'button' }, 'Resend confirmation');
    resend.onclick = busy(resend, async () => {
      await parentAction(familyId, pin, 'email-set', { email: state!.address });
      draw({ kind: 'info', text: 'Confirmation sent again.' });
    });
    const stop = h('button', { class: 'btn ghost', type: 'button' }, 'Stop emails');
    stop.onclick = busy(stop, async () => {
      await parentAction(familyId, pin, 'email-stop');
      state = null;
      draw({ kind: 'info', text: 'Weekly emails stopped.' });
    });
    card.replaceChildren(
      h('h2', {}, '📧 Weekly email'),
      h('p', {}, state.verified ? '✅ ' : '⏳ ', h('strong', {}, state.address), state.verified ? ' gets an update every Sunday evening.' : ' is waiting for confirmation. Open the link we emailed you.'),
      h('div', { class: 'row' }, state.verified ? test : resend, stop),
      msg ?? '');
  };
  draw();
  return card;
}

function render(familyId: string, pin: string, data: DashboardData & { email?: EmailState }, root: HTMLElement, reload: () => void) {
  const s = summarize(data);
  const name = data.child.name || 'Your child';
  const possessive = data.child.name ? `${data.child.name}'s` : "Your child's";
  const fmtPct = (p: PeriodStats) => (p.pct === null ? '–' : `${p.pct}%`);

  const byCat = new Map<Category, TopicRow[]>();
  for (const t of s.topics.filter((x) => x.status !== 'new')) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t]);

  root.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, `${possessive} progress`),
      h('p', { class: 'muted' }, `Grade ${s.grade} · last practiced ${ago(s.lastPracticed)} · synced ${ago(data.lastSync)}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: reload }, '↻ Refresh'),
        h('button', { class: 'btn ghost', onclick: () => download(`math-coach-${new Date().toISOString().slice(0, 10)}.csv`, csv(data)) }, '⬇ Export CSV'),
        h('button', { class: 'btn ghost', onclick: () => { setPin(familyId, null); location.reload(); } }, '🔒 Lock'))),

    h('div', { class: 'kpis' },
      kpi('problems this week', s.week.problems, delta(s.week.problems, s.prevWeek.problems)),
      kpi('right on the first try', fmtPct(s.week), delta(s.week.pct, s.prevWeek.pct, ' pts')),
      kpi('minutes this week', s.week.minutes, delta(s.week.minutes, s.prevWeek.minutes, ' min')),
      kpi('days practiced (7)', `${s.week.days}/7`, s.streak ? `🔥 ${s.streak}-day streak` : 'no current streak'),
      kpi('mistakes to review', s.reviewDue, 'waiting in Review')),

    ...(s.tips.length ? [h('div', { class: 'card' }, h('h2', {}, 'Suggestions'), h('ul', {}, ...s.tips.map((t) => h('li', {}, t))))] : []),

    h('div', { class: 'card' }, s.all.problems ? dailyChart(s.daily) : h('p', { class: 'muted' }, `No practice yet. When ${name} practices on their device, it will show up here.`)),

    h('div', { class: 'card' },
      h('h2', {}, 'Topics'),
      s.needsHelp.length ? h('p', {}, h('strong', {}, 'Needs help: '), s.needsHelp.slice(0, 4).map((t) => t.title).join(', ')) : null,
      s.strong.length ? h('p', {}, h('strong', {}, 'Strong: '), s.strong.slice(0, 4).map((t) => t.title).join(', ')) : null,
      h('div', { class: 'table-scroll' },
        h('table', { class: 'dash-table' },
          h('thead', {}, h('tr', {}, ...['Topic', 'Mastery', 'Tries', 'First try', 'Last practiced', 'Status'].map((x) => h('th', { scope: 'col' }, x)))),
          h('tbody', {}, ...[...byCat.entries()].flatMap(([cat, rows]) => [
            h('tr', {}, h('th', { colspan: 6, scope: 'colgroup' }, cat)),
            ...rows.map((t) => h('tr', {},
              h('td', {}, t.title),
              h('td', {}, meter(t.mastery)),
              h('td', { class: 'num' }, t.attempts || '–'),
              h('td', { class: 'num' }, t.firstTryPct === null ? '–' : `${t.firstTryPct}%`),
              h('td', {}, t.lastTs ? ago(t.lastTs) : '–'),
              h('td', {}, h('span', { class: `status ${t.status}` }, STATUS[t.status]))))
          ])))),
      s.untried.length
        ? h('details', { class: 'viz-table' },
            h('summary', {}, `${s.untried.length} topic${s.untried.length === 1 ? '' : 's'} not tried yet`),
            h('p', { class: 'small' }, s.untried.map((t) => t.title).join(' · ')))
        : null),

    emailCard(familyId, pin, data.email ?? null),

    h('div', { class: 'card' },
      h('h2', {}, 'Mock meets'),
      s.meets.length ? meetChart(s.meets) : h('p', { class: 'muted' }, 'No mock meets yet. A meet is 6 questions in 30 minutes, just like contest day.')),

    h('div', { class: 'card' },
      h('h2', {}, 'Recent mistakes'),
      h('p', { class: 'muted small' }, 'Problems that needed a hint, a retry, or were missed. Great to go through together.'),
      ...(s.mistakes.length
        ? s.mistakes.map((m) => {
            const p = problemFromId(m.problemId);
            return h('div', { class: 'mistake' },
              h('div', { class: 'small muted' }, `${new Date(m.ts).toLocaleDateString()} · ${topicTitle(m.topicId)} · ${m.mode}${m.hints ? ` · ${m.hints} hint${m.hints > 1 ? 's' : ''}` : ''}`),
              p ? h('p', { class: 'q' }, rich(p.text)) : null,
              h('div', { class: 'small' },
                m.answer ? h('span', {}, 'Answered ', h('strong', {}, m.answer), ' · ') : m.skipped ? h('span', {}, 'Skipped · ') : null,
                p ? h('span', {}, 'Correct: ', h('strong', {}, formatAnswer(p.answer))) : null,
                m.correct && !m.firstTry ? h('span', {}, ' · solved after help') : null));
          })
        : [h('p', {}, 'No mistakes recorded recently. 🎉')]))
  );
}

export function parentView(familyId: string): View {
  const root = h('section', { class: 'parent' });

  async function fetchData(pin: string): Promise<DashboardData> {
    const res = await fetch('./api/parent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ familyId, pin })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
    return body as DashboardData;
  }

  async function open(pin: string) {
    root.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    try {
      const data = await fetchData(pin);
      setPin(familyId, pin);
      render(familyId, pin, data, root, () => open(pin));
    } catch (e) {
      setPin(familyId, null);
      askPin((e as Error).message);
    }
  }

  function askPin(error?: string) {
    const input = h('input', { class: 'pin-input answer-input', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, 'aria-label': 'Parent PIN', placeholder: '••••' });
    const submit = () => /^\d{4,8}$/.test(input.value) && open(input.value);
    input.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && submit());
    root.replaceChildren(
      h('div', { class: 'card', style: 'text-align:center' },
        h('div', { class: 'big-emoji' }, '👨‍👩‍👧'),
        h('h2', {}, 'Parent dashboard'),
        h('p', { class: 'muted' }, 'Enter the parent PIN you chose when you set this up.'),
        error ? h('p', { class: 'feedback bad' }, error) : null,
        h('div', { class: 'row center' }, input, h('button', { class: 'btn primary', onclick: submit }, 'Open'))));
    setTimeout(() => input.focus(), 50);
  }

  const remembered = getPin(familyId);
  if (remembered) void open(remembered);
  else askPin();
  return { title: 'Parent dashboard', el: root };
}
