#!/usr/bin/env node
/**
 * Triage in-app feedback in production D1 (run by the "Feedback" workflow).
 *   node scripts/feedback.mjs list [new|triaged|done|wontfix|all]
 *   node scripts/feedback.mjs set <fb_id> <new|triaged|done|wontfix> [note]
 * The message text is NEVER printed: this repository and its Actions logs are public, and a message can mention a
 * child. Each message is emailed to the owner (FEEDBACK_TO) when it arrives; the id links that email to this list.
 * Needs CLOUDFLARE_API_TOKEN (D1 edit for "set") and CLOUDFLARE_ACCOUNT_ID.
 */
const API = 'https://api.cloudflare.com/client/v4';
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
const NAME = process.env.D1_NAME || 'cml-math-coach';
const STATUSES = ['new', 'triaged', 'done', 'wontfix'];

async function cf(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error((json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`);
  return json.result;
}

const [cmd = 'list', ...args] = process.argv.slice(2);
if (!token || !account) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');
const db = (await cf('GET', `/accounts/${account}/d1/database?name=${NAME}`)).find((d) => d.name === NAME);
if (!db) throw new Error(`D1 ${NAME} not found`);
// parameterised: ids, statuses and notes come from workflow inputs
const q = async (sql, params = []) => (await cf('POST', `/accounts/${account}/d1/database/${db.uuid}/query`, { sql, params }))[0];
const when = (t) => new Date(Number(t)).toISOString().slice(0, 16).replace('T', ' ');
const cell = (s) => String(s ?? '').replace(/[|\n\r]/g, ' ').slice(0, 80);

if (cmd === 'list') {
  const which = args[0] || 'new';
  if (which !== 'all' && !STATUSES.includes(which)) throw new Error(`status must be one of ${STATUSES.join(', ')} or all`);
  const counts = (await q('SELECT status, COUNT(*) AS n FROM user_feedback GROUP BY status')).results;
  console.log(`## Feedback (${which})\n`);
  console.log(STATUSES.map((s) => `${s}: ${counts.find((c) => c.status === s)?.n ?? 0}`).join(' · ') + '\n');
  const rows = (await q(`SELECT id, ts, kind, status, route, problem_id, grade, note FROM user_feedback ${which === 'all' ? '' : 'WHERE status = ?'} ORDER BY ts DESC LIMIT 100`, which === 'all' ? [] : [which])).results;
  if (!rows.length) console.log('Nothing here.');
  else {
    console.log('| id | received (UTC) | kind | status | screen | problem | grade | note |\n|---|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.id} | ${when(r.ts)} | ${r.kind} | ${r.status} | ${cell(r.route) || 'home'} | ${cell(r.problem_id)} | ${r.grade ?? ''} | ${cell(r.note)} |`);
    console.log('\nMessages are in the owner\'s email (search for the id); they are never printed here because these logs are public.');
  }
} else if (cmd === 'set') {
  const [id, status, ...noteWords] = args;
  if (!/^fb_[A-Za-z0-9_-]{6,20}$/.test(id || '')) throw new Error('give a feedback id like fb_Ab12Cd34Ef56');
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const note = noteWords.join(' ').slice(0, 500);
  const r = await q('UPDATE user_feedback SET status = ?, note = CASE WHEN ? = \'\' THEN note ELSE ? END, updated_at = ? WHERE id = ?', [status, note, note, Date.now(), id]);
  if (!r.meta?.changes) throw new Error(`no feedback with id ${id}`);
  console.log(`${id} → ${status}${note ? ` (note: ${note})` : ''}`);
} else {
  throw new Error('usage: feedback.mjs list [status|all] | set <id> <status> [note]');
}
