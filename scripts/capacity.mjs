#!/usr/bin/env node
/**
 * Capacity guard, CI side (phase 5, step085): reads today's (UTC) account-wide usage from the Cloudflare GraphQL
 * Analytics API and posts it to POST /api/admin/capacity, which pauses new families and new natural-voice clips
 * above 80% of a free limit (server/capacity.ts). Each measure is read on its own: one the token can't read is
 * reported and skipped, never guessed. Needs CLOUDFLARE_API_TOKEN (Account Analytics: Read), CLOUDFLARE_ACCOUNT_ID,
 * APP_URL and CRON_SECRET. Optional LIMITS_JSON (a paid plan's limits).
 */
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, APP_URL: app, CRON_SECRET: secret } = process.env;
const day = new Date().toISOString().slice(0, 10);

async function gql(query) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { a: account, d: day } })
  });
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data?.viewer?.accounts?.[0];
}

const MEASURES = [
  ['requests', 'Workers and Pages Functions requests',
    `query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:10000,filter:{date_geq:$d,date_leq:$d}){sum{requests}}}}}`,
    (a) => a.workersInvocationsAdaptive.reduce((n, r) => n + (r.sum?.requests ?? 0), 0)],
  ['rowsRead', 'D1 rows read',
    `query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$d,date_leq:$d}){sum{rowsRead}}}}}`,
    (a) => a.d1AnalyticsAdaptiveGroups.reduce((n, r) => n + (r.sum?.rowsRead ?? 0), 0)],
  ['rowsWritten', 'D1 rows written',
    `query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$d,date_leq:$d}){sum{rowsWritten}}}}}`,
    (a) => a.d1AnalyticsAdaptiveGroups.reduce((n, r) => n + (r.sum?.rowsWritten ?? 0), 0)],
  ['neurons', 'Workers AI neurons',
    `query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){aiInferenceAdaptiveGroups(limit:10000,filter:{date_geq:$d,date_leq:$d}){sum{totalNeurons}}}}}`,
    (a) => a.aiInferenceAdaptiveGroups.reduce((n, r) => n + (r.sum?.totalNeurons ?? 0), 0)]
];

if (!token || !account) {
  console.log('· Capacity: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not available here; skipped');
  process.exit(0);
}
const usage = {};
for (const [key, label, query, pick] of MEASURES) {
  try {
    usage[key] = pick(await gql(query));
    console.log(`· ${label} today (account-wide): ${usage[key].toLocaleString('en-US')}`);
  } catch (e) {
    console.log(`· ${label}: not readable (${e.message.slice(0, 160)})`);
  }
}
if (!Object.keys(usage).length) {
  console.log('::warning::Capacity: no usage could be read (the token may need Account Analytics: Read). Nothing changed.');
  process.exit(0);
}
if (!app || !secret) {
  console.log('· Capacity: APP_URL / CRON_SECRET missing; report only');
  process.exit(0);
}
const limits = process.env.LIMITS_JSON ? JSON.parse(process.env.LIMITS_JSON) : undefined;
const res = await fetch(`${app.replace(/\/+$/, '')}/api/admin/capacity`, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
  body: JSON.stringify({ usage, ...(limits ? { limits } : {}) })
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.log(`::warning::Capacity: the app answered HTTP ${res.status}`);
  process.exit(0);
}
const pct = out.worst ? Math.round(out.worst.share * 100) : 0;
console.log(`${out.paused ? '::warning::Capacity: PAUSED (new families and new voice clips)' : '✔ Capacity: open'} · busiest: ${out.worst?.key ?? '–'} at ${pct}% of the daily limit`);
