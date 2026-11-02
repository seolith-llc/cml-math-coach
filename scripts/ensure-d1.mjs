#!/usr/bin/env node
/**
 * CI helper: makes sure the D1 database for the parent dashboard exists, applies the schema
 * (idempotent CREATE ... IF NOT EXISTS), and adds the `DB` binding to wrangler.toml for this deploy.
 *
 * Needs CLOUDFLARE_API_TOKEN with "Account → D1 → Edit" and CLOUDFLARE_ACCOUNT_ID.
 * Without that permission it prints a warning and exits 0: the site still deploys, and the
 * dashboard reports "storage is not set up yet" until the permission is added.
 */
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';

/** Splits a migration into statements (comments removed). */
export function splitSql(text) {
  return text.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean);
}

const API = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const NAME = process.env.D1_NAME || 'cml-math-coach';

const warn = (msg) => {
  console.log(`::warning::Parent dashboard storage (D1) not set up: ${msg}`);
  process.exit(0);
};
if (!token || !account) warn('missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID');

async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
    const perm = res.status === 403 || /auth|permission/i.test(msg) ? ' (the API token needs "Account → D1 → Edit")' : '';
    throw new Error(msg + perm);
  }
  return json.result;
}

try {
  const list = await cf('GET', `/accounts/${account}/d1/database?name=${encodeURIComponent(NAME)}`);
  let db = (list || []).find((d) => d.name === NAME);
  if (!db) {
    db = await cf('POST', `/accounts/${account}/d1/database`, { name: NAME });
    console.log(`Created D1 database ${NAME}`);
  }
  const id = db.uuid || db.id;

  // Apply each migration file once, in order, recording it in _migrations.
  const q = async (sql, params) => (await cf('POST', `/accounts/${account}/d1/database/${id}/query`, { sql, params }))?.[0]?.results ?? [];
  await q('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const done = new Set((await q('SELECT name FROM _migrations')).map((r) => r.name));
  for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const statements = splitSql(readFileSync(`migrations/${file}`, 'utf8'));
    for (const sql of statements) {
      try {
        await q(sql);
      } catch (e) {
        // A column that already exists means a previous run got this far: carry on.
        if (!/duplicate column/i.test(e.message)) throw e;
      }
    }
    await q('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [file, Date.now()]);
    console.log(`Applied ${file} (${statements.length} statements)`);
  }

  appendFileSync('wrangler.toml', `\n# Added by scripts/ensure-d1.mjs during deploy\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "${NAME}"\ndatabase_id = "${id}"\n`);
  console.log(`✔ D1 "${NAME}" ready and bound as DB`);
} catch (e) {
  warn(e.message);
}
