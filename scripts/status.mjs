#!/usr/bin/env node
/**
 * Read-only health report from the production D1 database (run by the "Status" workflow).
 * Prints counts and recent email activity. Email addresses are masked; nothing is changed.
 * Needs CLOUDFLARE_API_TOKEN (D1 read) and CLOUDFLARE_ACCOUNT_ID.
 */
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
const tables = new Set((await q("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name));

const [f] = await q('SELECT COUNT(*) AS families, SUM(email IS NOT NULL) AS with_email, SUM(email_verified) AS verified, MAX(last_sync) AS last_sync FROM families');
const [a] = await q('SELECT COUNT(*) AS attempts, MAX(ts) AS last_attempt FROM attempts');
console.log(`Families: ${f.families} · with email: ${f.with_email ?? 0} · confirmed: ${f.verified ?? 0} · last sync: ${when(f.last_sync)}`);
console.log(`Attempts: ${a.attempts} · last: ${when(a.last_attempt)}`);

console.log('\nEmail per family:');
for (const r of await q('SELECT email, email_verified, email_quota, email_last_week, last_sync FROM families WHERE email IS NOT NULL'))
  console.log(`  ${mask(r.email)} · ${r.email_verified ? 'confirmed' : 'unconfirmed'} · sends today: ${r.email_quota ?? '–'} · last weekly: ${r.email_last_week ?? '–'}`);

if (tables.has('email_log')) {
  console.log('\nRecent email sends:');
  const rows = await q('SELECT ts, kind, ok, detail FROM email_log ORDER BY ts DESC LIMIT 20');
  if (!rows.length) console.log('  (none yet)');
  for (const r of rows) console.log(`  ${when(r.ts)} · ${r.kind} · ${r.ok ? 'sent' : 'FAILED'} · ${r.detail ?? ''}`);
}
