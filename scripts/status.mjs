#!/usr/bin/env node
/**
 * Read-only health report from the production D1 database (run by the "Status" workflow).
 * Prints counts and recent email activity. Email addresses are masked; nothing is changed.
 * Needs CLOUDFLARE_API_TOKEN (D1 read) and CLOUDFLARE_ACCOUNT_ID.
 */
import { compareLooks, formatComparison } from './lib/experiment.mjs';

const API = 'https://api.cloudflare.com/client/v4';
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
const NAME = process.env.D1_NAME || 'cml-math-coach';

async function cf(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error((json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`);
  return json.result;
}

const mask = (e) => (e ? e.replace(/^(.).*(@.*)$/, '$1•••$2') : '–');
const when = (t) => (t ? new Date(Number(t)).toISOString().replace('T', ' ').slice(0, 16) + 'Z' : '–');

const db = (await cf('GET', `/accounts/${account}/d1/database?name=${NAME}`)).find((d) => d.name === NAME);
if (!db) throw new Error(`D1 ${NAME} not found`);
const q = async (sql) => (await cf('POST', `/accounts/${account}/d1/database/${db.uuid}/query`, { sql }))[0].results;

// Which database is the live site actually using? (Cloudflare's own record of the Pages bindings.)
const all = await cf('GET', `/accounts/${account}/d1/database?per_page=100`);
console.log(`D1 databases on the account: ${all.map((d) => `${d.name} (${d.uuid.slice(0, 8)})`).join(', ')}`);
try {
  const project = await cf('GET', `/accounts/${account}/pages/projects/${process.env.PROJECT_NAME || 'cml-math-coach'}`);
  for (const env of ['production', 'preview']) {
    const b = project.deployment_configs?.[env]?.d1_databases ?? {};
    console.log(`Pages ${env} D1 bindings: ${Object.entries(b).map(([k, v]) => `${k} → ${String(v.id).slice(0, 8)}`).join(', ') || 'none'}`);
  }
} catch (e) {
  console.log(`Pages project bindings: unavailable (${e.message})`);
}
console.log(`This report reads: ${db.name} (${db.uuid.slice(0, 8)})\n`);
const tables = new Set((await q("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name));

const migs = tables.has('_migrations') ? (await q('SELECT name FROM _migrations ORDER BY name')).map((r) => r.name) : [];
console.log(`Tables: ${[...tables].sort().join(', ')} · migrations: ${migs.join(', ') || '–'}`);
const [f] = await q('SELECT COUNT(*) AS families, SUM(email IS NOT NULL) AS with_email, SUM(email_verified) AS verified, MAX(last_sync) AS last_sync FROM families');
const [a] = await q('SELECT COUNT(*) AS attempts, MAX(ts) AS last_attempt FROM attempts');
console.log(`Families: ${f.families} · with email: ${f.with_email ?? 0} · confirmed: ${f.verified ?? 0} · last sync: ${when(f.last_sync)}`);
console.log(`Attempts: ${a.attempts} · last: ${when(a.last_attempt)}`);

console.log('\nEmail per family:');
for (const r of await q('SELECT email, email_verified, email_quota, email_last_week, last_sync FROM families WHERE email IS NOT NULL'))
  console.log(`  ${mask(r.email)} · ${r.email_verified ? 'confirmed' : 'unconfirmed'} · sends today: ${r.email_quota ?? '–'} · last weekly: ${r.email_last_week ?? '–'}`);

if (tables.has('push_subs')) {
  const [p] = await q('SELECT COUNT(*) AS subs, SUM(failures > 0) AS failing, MAX(last_sent_day) AS last_sent FROM push_subs');
  console.log(`\nDevice reminders: ${p.subs} subscribed · failing: ${p.failing ?? 0} · last sent: ${p.last_sent ?? '–'}`);
  for (const r of await q('SELECT tz, hour, last_active_day, last_sent_day FROM push_subs LIMIT 20'))
    console.log(`  ${r.tz} at ${r.hour}:00 · last practice: ${r.last_active_day ?? '–'} · last reminder: ${r.last_sent_day ?? '–'}`);
}
if (tables.has('families') && (await q("SELECT COUNT(*) AS n FROM pragma_table_info('families') WHERE name = 'email_nudges'"))[0].n) {
  for (const r of await q('SELECT email, email_weekly, email_nudges, nudges_sent, nudged_day FROM families WHERE email IS NOT NULL'))
    console.log(`  ${mask(r.email)} · weekly: ${r.email_weekly ? 'on' : 'off'} · nudges: ${r.email_nudges ? 'on' : 'off'} (${r.nudges_sent} sent this break, last ${r.nudged_day ?? '–'})`);
}

// Game mode tester round (docs/GAME-MODE.md phase 5): Game vs Classic per family, numbers only, no names or ids.
if (tables.has('families')) {
  const rows = await q("SELECT snapshot FROM families WHERE snapshot IS NOT NULL ORDER BY created_at");
  const blocks = [];
  rows.forEach((r, i) => {
    let snap;
    try { snap = JSON.parse(r.snapshot); } catch { return; }
    if (!Array.isArray(snap?.roundLog) || !snap.roundLog.length) return;
    blocks.push(formatComparison(`Family ${i + 1}`, compareLooks(snap.roundLog)));
  });
  console.log('\nGame mode tester round (last 28 days):');
  console.log(blocks.length ? blocks.join('\n') : '  (no finished rounds synced yet)');
}

// Phase 5: growth (numbers only, never addresses)
if (tables.has('users')) {
  const day = 86_400_000, now = Date.now();
  const n = async (sql) => Number((await q(sql))[0]?.n ?? 0);
  const users = await q('SELECT status, COUNT(*) AS n FROM users GROUP BY status');
  const roles = await q('SELECT role, COUNT(*) AS n FROM members GROUP BY role');
  console.log('\nGrowth (invite-only accounts):');
  console.log(`  People: ${users.map((r) => `${r.status} ${r.n}`).join(', ') || 'none yet'} · roles: ${roles.map((r) => `${r.role} ${r.n}`).join(', ') || '–'}`);
  console.log(`  Families: ${await n('SELECT COUNT(*) AS n FROM households')} (${await n('SELECT COUNT(*) AS n FROM households WHERE family_key IS NOT NULL')} with a synced device)`);
  console.log(`  Invites, last 7 days: ${await n(`SELECT COUNT(*) AS n FROM invites WHERE created_at > ${now - 7 * day}`)} made, ${await n(`SELECT COUNT(*) AS n FROM invites WHERE used_at > ${now - 7 * day}`)} used · open now: ${await n(`SELECT COUNT(*) AS n FROM invites WHERE used_by IS NULL AND revoked = 0 AND expires_at > ${now}`)}`);
  console.log(`  Approvals waiting: ${await n('SELECT COUNT(*) AS n FROM approvals WHERE decided_at IS NULL')} (${await n('SELECT COUNT(*) AS n FROM approvals WHERE decided_at IS NULL AND escalated_at IS NOT NULL')} with the super admin)`);
  console.log(`  Signed in, last 7 days: ${await n(`SELECT COUNT(*) AS n FROM users WHERE last_seen > ${now - 7 * day}`)} people · sign-in emails, last 24 h: ${await n(`SELECT COUNT(*) AS n FROM email_log WHERE kind = 'signin' AND ts > ${now - day}`)}`);
  // Support: who joined, who signed in, codes waiting (addresses masked).
  const people = await q(`SELECT u.email, u.status, u.is_admin, u.created_at, u.last_seen, c.expires_at AS code_until, c.tries AS code_tries,
      (SELECT COUNT(*) FROM sessions s WHERE s.user = u.id AND s.expires_at > ${now}) AS sessions,
      (SELECT MAX(created_at) FROM auth_tokens t WHERE t.user = u.id AND t.purpose = 'signin') AS last_email,
      (SELECT MAX(used_at) FROM auth_tokens t WHERE t.user = u.id AND t.purpose = 'signin') AS link_used
    FROM users u LEFT JOIN signin_codes c ON c.user = u.id ORDER BY u.created_at`);
  for (const r of people) console.log(`  · ${mask(r.email)}${r.is_admin ? ' (admin)' : ''}: ${r.status} · joined ${when(r.created_at)} · last sign-in email ${when(r.last_email)} · link used ${when(r.link_used)} · code ${r.code_until ? (r.code_until > now ? `waiting (${r.code_tries} wrong tries)` : 'expired') : '–'} · sessions ${r.sessions} · last seen ${when(r.last_seen)}`);
  const cap = (await q("SELECT v FROM kv WHERE k = 'capacity'"))[0];
  if (cap) {
    const c = JSON.parse(cap.v);
    console.log(`  Capacity: ${c.paused ? 'PAUSED' : 'open'} · busiest ${c.worst?.key ?? '–'} ${c.worst ? Math.round(c.worst.share * 100) + '%' : ''} · checked ${when(c.at)}`);
  } else console.log('  Capacity: not checked yet');
}

if (tables.has('email_log')) {
  console.log('\nRecent email sends:');
  const rows = await q('SELECT ts, kind, ok, detail FROM email_log ORDER BY ts DESC LIMIT 20');
  if (!rows.length) console.log('  (none yet)');
  for (const r of rows) console.log(`  ${when(r.ts)} · ${r.kind} · ${r.ok ? 'sent' : 'FAILED'} · ${r.detail ?? ''}`);
}
