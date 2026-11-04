import { summarize, topicTitle, type DashboardData, type TopicRow } from '../core/insights';
import { formatAnswer } from '../core/answer';
import { problemFromId } from '../content/topics';
import { dailyChart, meetChart } from '../ui/charts';
import { fill, group, h, list, meter, rich } from '../ui/dom';
import type { View } from '../app';

/**
 * Parent dashboard, opened from the private link #/parent/<familyId> on the parent's own device.
 * Data comes from POST /api/parent (needs the PIN). The PIN is remembered for this tab only.
 */

type Email = { address: string; verified: boolean } | null;
type Data = DashboardData & { email?: Email };

const pinKey = (id: string) => `cml-parent-pin:${id}`;
const session = {
  get: (id: string) => { try { return sessionStorage.getItem(pinKey(id)) ?? ''; } catch { return ''; } },
  set: (id: string, pin: string | null) => { try { pin ? sessionStorage.setItem(pinKey(id), pin) : sessionStorage.removeItem(pinKey(id)); } catch { /* private mode */ } }
};

async function post(body: Record<string, unknown>) {
  const res = await fetch('./api/parent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
  return json;
}

function ago(ts: number | null): string {
  if (!ts) return '–';
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 60) return m < 2 ? 'now' : `${m} min`;
  const hrs = Math.round(m / 60);
  return hrs < 24 ? `${hrs} h` : `${Math.round(hrs / 24)} d`;
}

const delta = (now: number | null, before: number | null) =>
  now === null || before === null || now === before ? '' : `${now > before ? '▲' : '▼'} ${Math.abs(now - before)}`;

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

function emailGroup(familyId: string, pin: string, initial: Email): HTMLElement {
  const wrap = h('div');
  let email = initial;
  const run = (btn: HTMLButtonElement, fn: () => Promise<string | void>) => async () => {
    btn.disabled = true;
    try {
      const msg = await fn();
      draw(msg ? { ok: true, text: msg } : undefined);
    } catch (e) {
      draw({ ok: false, text: (e as Error).message });
    }
  };
  const draw = (note?: { ok: boolean; text: string }) => {
    const msg = note ? h('p', { class: `feedback ${note.ok ? 'good' : 'bad'}`, role: 'status' }, note.text) : null;
    if (!email) {
      const input = h('input', { class: 'row-input', type: 'email', autocomplete: 'email', placeholder: 'Email', 'aria-label': 'Email' });
      const add = h('button', { class: 'btn primary', type: 'button' }, 'Add');
      add.onclick = run(add, async () => {
        const r = await post({ familyId, pin, action: 'email-set', email: input.value });
        email = { address: String(r.email), verified: false };
        return 'Check your inbox to confirm.';
      });
      fill(wrap, group('Weekly email', h('div', { class: 'row' }, input, add), msg));
      return;
    }
    const test = h('button', { class: 'btn plain', type: 'button' }, email.verified ? 'Send test' : 'Resend');
    test.onclick = run(test, async () => {
      await post(email!.verified ? { familyId, pin, action: 'email-test' } : { familyId, pin, action: 'email-set', email: email!.address });
      return email!.verified ? 'Sent.' : 'Check your inbox to confirm.';
    });
    const stop = h('button', { class: 'btn plain danger', type: 'button' }, 'Stop');
    stop.onclick = run(stop, async () => {
      await post({ familyId, pin, action: 'email-stop' });
      email = null;
    });
    fill(wrap, group('Weekly email',
      h('div', { class: 'row' }, h('span', { class: 'row-label' }, email.address), h('span', { class: 'row-value' }, email.verified ? 'Sundays' : 'Unconfirmed')),
      h('div', { class: 'row actions' }, test, stop),
      msg));
  };
  draw();
  return wrap;
}

function render(root: HTMLElement, familyId: string, pin: string, data: Data) {
  const s = summarize(data);
  const name = data.child.name || 'Your child';
  const topicRows = (rows: TopicRow[]) => rows.map((t) => ({ label: t.title, value: h('span', { class: 'row-pair' }, t.firstTryPct === null ? '' : `${t.firstTryPct}%`, meter(t.mastery)) }));
  const building = s.topics.filter((t) => t.status === 'building');
  const tile = (value: string | number, label: string, d = '') =>
    h('div', { class: 'tile' }, h('strong', {}, String(value)), h('span', {}, label), d ? h('em', {}, d) : null);

  fill(root,
    h('h2', { class: 'page-heading' }, name),
    h('div', { class: 'tiles', style: '--n: 4' },
      tile(s.week.problems, 'Problems', delta(s.week.problems, s.prevWeek.problems)),
      tile(s.week.pct === null ? '–' : `${s.week.pct}%`, 'First try', delta(s.week.pct, s.prevWeek.pct)),
      tile(s.week.minutes, 'Minutes', delta(s.week.minutes, s.prevWeek.minutes)),
      tile(`${s.week.days}/7`, 'Days')),
    s.tips.length ? group('This week', h('ul', { class: 'bullets' }, ...s.tips.map((t) => h('li', {}, t)))) : null,
    s.all.problems ? group('Last 30 days', dailyChart(s.daily)) : null,
    s.needsHelp.length ? list(topicRows(s.needsHelp), 'Needs help') : null,
    building.length ? list(topicRows(building), 'Building') : null,
    s.strong.length ? list(topicRows(s.strong), 'Strong') : null,
    s.meets.length ? group('Tests', meetChart(s.meets)) : null,
    s.mistakes.length
      ? group('Mistakes', ...s.mistakes.map((m) => {
          const p = problemFromId(m.problemId);
          return h('div', { class: 'mistake' },
            p ? h('p', { class: 'question small' }, rich(p.text)) : h('p', {}, topicTitle(m.topicId)),
            h('dl', { class: 'compare' },
              h('dt', {}, 'Answered'), h('dd', {}, m.answer ?? (m.skipped ? '—' : '✓ with help')),
              p ? h('dt', {}, 'Answer') : null, p ? h('dd', {}, formatAnswer(p.answer)) : null));
        }))
      : null,
    emailGroup(familyId, pin, data.email ?? null),
    list([
      { label: 'Last practiced', value: ago(s.lastPracticed) },
      { label: 'Export CSV', onclick: () => download(`math-coach-${new Date().toISOString().slice(0, 10)}.csv`, csv(data)) },
      { label: 'Lock', onclick: () => { session.set(familyId, null); location.reload(); } }
    ]));
}

export function parentScreen(familyId: string): View {
  const root = h('div', { class: 'stack' });

  async function open(pin: string) {
    try {
      const data = (await post({ familyId, pin })) as unknown as Data;
      session.set(familyId, pin);
      render(root, familyId, pin, data);
    } catch (e) {
      session.set(familyId, null);
      gate((e as Error).message);
    }
  }

  function gate(error?: string) {
    const pin = h('input', { class: 'row-input pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, placeholder: 'PIN', 'aria-label': 'Parent PIN',
      onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && go() });
    const go = () => /^\d{4,8}$/.test(pin.value) && void open(pin.value);
    fill(root, group(null, h('div', { class: 'row' }, pin, h('button', { class: 'btn primary', type: 'button', onclick: go }, 'Open'))),
      error ? h('p', { class: 'feedback bad', role: 'alert' }, error) : null);
    setTimeout(() => pin.focus(), 50);
  }

  const remembered = session.get(familyId);
  if (remembered) void open(remembered);
  else gate();
  // Fresh numbers whenever the parent comes back to the tab.
  const onFocus = () => document.visibilityState === 'visible' && session.get(familyId) && void open(session.get(familyId));
  document.addEventListener('visibilitychange', onFocus);
  return { title: 'Dashboard', el: root, destroy: () => document.removeEventListener('visibilitychange', onFocus) };
}
