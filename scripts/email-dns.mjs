#!/usr/bin/env node
/**
 * Email authentication for the app's sender (coach@seolith.com via Amazon SES): a custom MAIL FROM subdomain
 * (MX + SPF) and a DMARC record. Run from Actions → "Email DNS".
 *
 * Dry run by default: reads Cloudflare DNS and SES, prints what exists and what it would change, changes nothing.
 * APPLY=true creates the missing records and sets the SES MAIL FROM, and only when the plan has no conflicts.
 * The rules live in scripts/email-dns-plan.mjs (unit-tested): the root domain's records are never touched, an
 * existing DMARC record is never changed, and any conflicting record stops the run.
 *
 * Env: CLOUDFLARE_API_TOKEN (Zone → DNS → Read; Edit to apply), CLOUDFLARE_ZONE_ID (optional),
 *      AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (ses:GetEmailIdentity, ses:GetAccount; ses:PutEmailIdentityMailFromAttributes to apply),
 *      AWS_REGION (default us-east-1), ZONE_NAME (default seolith.com), MAIL_FROM_DOMAIN (default mail.<zone>),
 *      DMARC_RUA (optional report address), APPLY ("true" to apply).
 */
import { appendFileSync } from 'node:fs';
import { signV4 } from '../server/ses.ts';
import { planEmailDns, unquote } from './email-dns-plan.mjs';

const env = process.env;
const zoneName = (env.ZONE_NAME || 'seolith.com').toLowerCase();
const mailFrom = (env.MAIL_FROM_DOMAIN || `mail.${zoneName}`).toLowerCase();
const region = env.AWS_REGION || 'us-east-1';
const apply = env.APPLY === 'true';
const dmarcRua = (env.DMARC_RUA || '').trim() || undefined;

const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
const done = (code) => {
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  process.exit(code);
};
for (const k of ['CLOUDFLARE_API_TOKEN', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) if (!env[k]) { say(`::error::${k} is not set`); done(1); }

/* ---------- Cloudflare ---------- */
const CF = 'https://api.cloudflare.com/client/v4';
async function cf(method, path, body) {
  const res = await fetch(CF + path, { method, headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ');
    throw new Error(`Cloudflare ${method} ${path.split('?')[0]} → HTTP ${res.status} ${msg}${res.status === 403 ? ' (the token needs Zone → DNS → Read, and Edit to apply)' : ''}`);
  }
  return json.result;
}
let zoneId = env.CLOUDFLARE_ZONE_ID;
if (!zoneId) zoneId = (await cf('GET', `/zones?name=${encodeURIComponent(zoneName)}`))?.[0]?.id;
if (!zoneId) { say(`::error::Zone ${zoneName} not found for this token`); done(1); }
const recordsAt = async (name) => (await cf('GET', `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&per_page=100`))
  .map((r) => ({ type: r.type, name: r.name, content: r.content, priority: r.priority }));

/* ---------- SES (v2 REST, signed with the app's own SigV4) ---------- */
const creds = { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY };
async function ses(method, path, body) {
  const url = `https://email.${region}.amazonaws.com/v2/email${path}`;
  const text = body ? JSON.stringify(body) : '';
  const headers = await signV4({ method, url, service: 'ses', region, headers: body ? { 'content-type': 'application/json' } : {}, body: text, creds });
  const res = await fetch(url, { method, headers, body: body ? text : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
const sesFail = (r, what) => new Error(`SES ${what} → HTTP ${r.status} ${r.json.message || r.json.Message || ''}${r.status === 403 ? ' (the IAM user needs that SES permission)' : ''}`);

/* ---------- gather ---------- */
say(`## Email DNS: ${apply ? 'APPLY' : 'dry run'}`);
say(`Zone **${zoneName}** · MAIL FROM **${mailFrom}** · SES region **${region}**`);
say();

let sesState = { kind: 'missing', mailFromDomain: null };
try {
  const dom = await ses('GET', `/identities/${encodeURIComponent(zoneName)}`);
  if (dom.status === 200) {
    const j = dom.json;
    sesState = { kind: j.VerifiedForSendingStatus ? 'domain' : 'missing', mailFromDomain: j.MailFromAttributes?.MailFromDomain || null };
    say(`- SES identity ${zoneName}: ${j.VerifiedForSendingStatus ? 'verified for sending' : 'NOT verified'} · DKIM ${j.DkimAttributes?.Status ?? '?'} · MAIL FROM ${j.MailFromAttributes?.MailFromDomain ? `${j.MailFromAttributes.MailFromDomain} (${j.MailFromAttributes.MailFromDomainStatus})` : 'default (amazonses.com)'}`);
  } else if (dom.status === 404) {
    const addr = await ses('GET', `/identities/${encodeURIComponent('coach@' + zoneName)}`);
    sesState = { kind: addr.status === 200 ? 'email' : 'missing', mailFromDomain: null };
    say(`- SES identity ${zoneName}: not found${addr.status === 200 ? ` (only the address coach@${zoneName} is verified)` : ''}`);
  } else throw sesFail(dom, 'GetEmailIdentity');
  const acct = await ses('GET', '/account');
  if (acct.status === 200) {
    const a = acct.json;
    say(`- SES account: ${a.ProductionAccessEnabled ? 'production access' : '**sandbox** (sends only to verified addresses)'} · sending ${a.SendingEnabled ? 'enabled' : 'DISABLED'} · quota ${a.SendQuota?.Max24HourSend ?? '?'}/day, ${a.SendQuota?.SentLast24Hours ?? '?'} sent in the last 24 h`);
  } else say(`- SES account: couldn't read (HTTP ${acct.status}${acct.status === 403 ? ', needs ses:GetAccount' : ''})`);
} catch (e) { say(`::error::${e.message}`); done(1); }

let records;
try {
  records = [...(await recordsAt(mailFrom)), ...(await recordsAt('_dmarc.' + zoneName))];
} catch (e) { say(`::error::${e.message}`); done(1); }
say(`- DNS at ${mailFrom}: ${records.filter((r) => r.name === mailFrom).map((r) => `${r.type} ${unquote(r.content)}`).join(' · ') || 'none'}`);
say(`- DNS at _dmarc.${zoneName}: ${records.filter((r) => r.name !== mailFrom).map((r) => `${r.type} ${unquote(r.content)}`).join(' · ') || 'none'}`);
say(`- Root domain records (SPF, MX for Google Workspace): not read for changes, never touched`);
say();

/* ---------- plan ---------- */
const plan = planEmailDns({ zone: zoneName, mailFrom, region, dmarcRua, records, ses: sesState });
say('### Plan');
for (const s of plan.ok) say(`- ✔ already in place: ${s}`);
for (const s of plan.keep) say(`- • ${s}`);
for (const r of plan.create) say(`- ➕ create ${r.type} ${r.name} → ${r.priority ? r.priority + ' ' : ''}${r.content}`);
if (plan.ses) say(`- ➕ set SES MAIL FROM for ${zoneName} → ${plan.ses.mailFromDomain} (if its MX fails, SES falls back to the default)`);
for (const s of plan.conflicts) say(`- ✖ conflict: ${s}`);
if (!plan.create.length && !plan.ses && !plan.conflicts.length) say('- Nothing to do.');
say();

if (plan.conflicts.length) { say(`::error::${plan.conflicts.length} conflict(s): nothing ${apply ? 'was' : 'would be'} changed. Resolve them, or choose another MAIL_FROM_DOMAIN.`); done(1); }
if (!apply) { say(plan.create.length || plan.ses ? 'Dry run: nothing was changed. Run again with **apply** ticked to make these changes.' : 'Dry run: everything is already in place.'); done(0); }

/* ---------- apply ---------- */
say('### Applying');
try {
  for (const r of plan.create) {
    await cf('POST', `/zones/${zoneId}/dns_records`, { type: r.type, name: r.name, content: r.content, ttl: 1, proxied: false, ...(r.priority ? { priority: r.priority } : {}), comment: 'Math Coach email (scripts/email-dns.mjs)' });
    say(`- ✔ created ${r.type} ${r.name}`);
  }
  if (plan.ses) {
    const put = await ses('PUT', `/identities/${encodeURIComponent(zoneName)}/mail-from`, { MailFromDomain: plan.ses.mailFromDomain, BehaviorOnMxFailure: 'USE_DEFAULT_VALUE' });
    if (put.status !== 200) throw sesFail(put, 'PutEmailIdentityMailFromAttributes');
    say(`- ✔ SES MAIL FROM set to ${plan.ses.mailFromDomain} (SES verifies the MX record; status shows on the next dry run)`);
  }
} catch (e) { say(`::error::${e.message} (changes listed above were made; run the dry run to see the current state)`); done(1); }
say('Done. Run the dry run again in a few minutes: the MAIL FROM status should read SUCCESS.');
done(0);
