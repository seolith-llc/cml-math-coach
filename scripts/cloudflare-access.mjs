#!/usr/bin/env node
/**
 * Puts Cloudflare Access (Zero Trust) in front of the whole app, so only invited people can open it.
 * Run by .github/workflows/cloudflare-access.yml. Idempotent: creates or updates, never duplicates.
 *
 *  1. Checks Zero Trust is set up, and turns on the "One-time PIN" login (a code sent by email).
 *  2. "Math Coach": the custom domain, <project>.pages.dev and every preview (*.<project>.pages.dev).
 *     Policies: allowed emails (ACCESS_ALLOWED_EMAILS, a secret so it never shows in public logs),
 *     and the CI service token (deploy smoke tests, hourly job, Status probe).
 *  3. "Math Coach email links": bypass for /api/email/confirm and /api/email/unsubscribe only, so a
 *     parent can confirm or unsubscribe (including mail providers' one-click unsubscribe) without signing in.
 *     Both are protected by their own signed tokens and reveal nothing else.
 *  4. Verifies the live result: strangers get the sign-in page, the service token gets the app,
 *     the email links skip the sign-in.
 */
const API = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const project = process.env.PROJECT_NAME || 'cml-math-coach';
const appUrl = (process.env.APP_URL || 'https://cml-math-coach.seolith.com').replace(/\/+$/, '');
const tokenName = process.env.ACCESS_SERVICE_TOKEN_NAME || 'math-coach-ci';
const session = process.env.ACCESS_SESSION || '720h';
const emails = (process.env.ACCESS_ALLOWED_EMAILS || '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
const ci = { id: process.env.CF_ACCESS_CLIENT_ID, secret: process.env.CF_ACCESS_CLIENT_SECRET };
/** Preview by default: report what would change and touch nothing. APPLY=true makes the changes. */
const apply = process.env.APPLY === 'true';
/** The only Access applications this script ever creates or changes; every other application is left alone. */
const OURS = ['Math Coach', 'Math Coach email links'];
const todo = [];

const fail = (msg) => {
  console.log(`::error::${msg}`);
  process.exit(1);
};
if (!token || !account) fail('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
const need = (msg) => (apply ? fail(msg) : todo.push(msg));
if (!emails.length) need('Add the GitHub secret ACCESS_ALLOWED_EMAILS: the email addresses allowed to open the app, separated by commas.');
for (const e of emails) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) fail(`ACCESS_ALLOWED_EMAILS has an entry that is not an email address (entry ${emails.indexOf(e) + 1}).`);

async function cf(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    const err = (json.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw Object.assign(new Error(`${method} ${path}: ${err}`), { status: res.status });
  }
  return json.result;
}
const acc = `/accounts/${account}/access`;
const host = new URL(appUrl).host;
const hosts = [host, `${project}.pages.dev`, `*.${project}.pages.dev`];

// 1. Zero Trust and the one-time PIN login
try {
  const org = await cf('GET', `${acc}/organizations`);
  console.log(`${apply ? 'Applying' : 'Preview (nothing is changed; run again with "apply" ticked to make the changes)'}\n`);
  console.log(`✔ Zero Trust organization: ${org.auth_domain}`);
} catch (e) {
  fail(`Zero Trust is not set up yet (${e.message}). In the Cloudflare dashboard open Zero Trust, choose a team name and the Free plan, then run this again.` +
    (e.status === 403 ? ' If it is set up, the API token is missing the Access permissions listed in docs/DEPLOY.md.' : ''));
}
const idps = await cf('GET', `${acc}/identity_providers`);
let otp = idps.find((p) => p.type === 'onetimepin');
if (otp) console.log('✔ Sign-in: one-time PIN by email (already set up, reused as is)');
else if (apply) {
  otp = await cf('POST', `${acc}/identity_providers`, { name: 'One-time PIN', type: 'onetimepin', config: {} });
  console.log('✔ Sign-in: one-time PIN by email (turned on)');
} else console.log('· Would turn on the one-time PIN (email code) login');

// 2. Service token for CI
const tokens = await cf('GET', `${acc}/service_tokens`);
const svc = tokens.find((t) => t.name === tokenName);
if (!svc) need(`Create the service token "${tokenName}" (Zero Trust → Access → Service credentials → Service Tokens, duration: non-expiring), then add its Client ID and Client Secret as the GitHub secrets CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.`);
if (svc) console.log(`✔ Service token "${tokenName}" found`);

// 3. Applications (upsert by name)
const apps = await cf('GET', `${acc}/apps`);
// Other applications are never changed. Report (without names or hostnames: these logs are public)
// whether any of them already covers one of our hostnames, e.g. a *.seolith.com wildcard.
const uris = (a) => (a.destinations?.length ? a.destinations.map((d) => d.uri) : a.self_hosted_domains?.length ? a.self_hosted_domains : [a.domain]).filter(Boolean);
const covers = (pattern, h) => {
  const p = String(pattern).split('/')[0].toLowerCase();
  const re = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+') + '$');
  return re.test(h) || (h.startsWith('*.') && p === h);
};
const others = apps.filter((a) => !OURS.includes(a.name));
const overlapping = others.filter((a) => uris(a).some((u) => hosts.some((h) => covers(u, h.replace(/^\*\./, 'preview.')) || covers(u, h))));
console.log(`✔ ${others.length} other Access application${others.length === 1 ? '' : 's'} on this account: left untouched`);
if (overlapping.length) console.log(`::warning::${overlapping.length} existing application(s) already cover one of the Math Coach hostnames. Access uses the most specific match, so Math Coach's own rules still apply, but check them in Zero Trust → Access → Applications.`);
else console.log('✔ None of them covers the Math Coach hostnames');
for (const name of OURS) console.log(`${apply ? '✔' : '·'} ${apps.some((a) => a.name === name) ? 'Update' : 'Create'}: "${name}" (${name === OURS[0] ? hosts.join(', ') : 'email confirm and unsubscribe links only'})`);
if (!apply) {
  console.log(`· Invited addresses: ${emails.length} · session ${session}`);
  if (todo.length) {
    console.log('\nStill to do before applying:');
    for (const t of todo) console.log(`::warning::${t}`);
  } else console.log('\nReady: run again with "apply" ticked.');
  process.exit(0);
}
async function upsert(spec) {
  const existing = apps.find((a) => a.name === spec.name);
  const result = existing ? await cf('PUT', `${acc}/apps/${existing.id}`, { ...spec, id: existing.id }) : await cf('POST', `${acc}/apps`, spec);
  console.log(`✔ ${existing ? 'Updated' : 'Created'} Access application "${spec.name}"`);
  return result;
}
const common = { type: 'self_hosted', session_duration: session, app_launcher_visible: false, allowed_idps: [otp.id], auto_redirect_to_identity: true, http_only_cookie_attribute: true, same_site_cookie_attribute: 'lax' };

await upsert({
  ...common,
  name: 'Math Coach',
  domain: hosts[0],
  destinations: hosts.map((h) => ({ type: 'public', uri: h })),
  policies: [
    { name: 'Invited people', decision: 'allow', precedence: 1, include: emails.map((email) => ({ email: { email } })) },
    { name: 'CI service token', decision: 'non_identity', precedence: 2, include: [{ service_token: { token_id: svc.id } }] }
  ]
});
const linkPaths = ['/api/email/confirm', '/api/email/unsubscribe'];
await upsert({
  ...common,
  name: 'Math Coach email links',
  domain: hosts[0] + linkPaths[0],
  destinations: hosts.slice(0, 2).flatMap((h) => linkPaths.map((p) => ({ type: 'public', uri: h + p }))),
  policies: [{ name: 'Email links (token-protected)', decision: 'bypass', precedence: 1, include: [{ everyone: {} }] }]
});
console.log(`✔ ${emails.length} invited email address${emails.length === 1 ? '' : 'es'} · session ${session}`);

// 4. Verify (Access can take a few seconds to apply)
await new Promise((r) => setTimeout(r, 15000));
const browser = { 'user-agent': 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' };
let ok = true;
const check = (pass, label) => {
  console.log(`${pass ? '✔' : '✘'} ${label}`);
  ok &&= pass;
};
// Only responses that reached the app carry its X-Robots-Tag header (functions/_middleware.ts).
const reachedApp = (r) => r.headers.has('x-robots-tag');
for (const base of [appUrl, `https://${project}.pages.dev`]) {
  const r = await fetch(base + '/', { headers: browser, redirect: 'manual' });
  check(!reachedApp(r), `${base}: a stranger gets the sign-in page, not the app (HTTP ${r.status})`);
  const api = await fetch(base + '/api/parent', { method: 'POST', headers: { ...browser, 'content-type': 'application/json' }, body: '{}', redirect: 'manual' });
  check(!reachedApp(api), `${base}: a stranger can't reach the API (HTTP ${api.status})`);
}
if (ci.id && ci.secret) {
  const r = await fetch(appUrl + '/', { headers: { ...browser, 'cf-access-client-id': ci.id, 'cf-access-client-secret': ci.secret }, redirect: 'manual' });
  check(r.status === 200 && reachedApp(r), `The CI service token gets the app (HTTP ${r.status})`);
} else console.log('::warning::CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET are not set, so deploy smoke tests, the hourly job and the Status probe will be blocked.');
const unsub = await fetch(appUrl + '/api/email/unsubscribe?u=not-a-real-token', { headers: browser, redirect: 'manual' });
check(reachedApp(unsub), `Email links skip the sign-in (HTTP ${unsub.status})`);
if (!ok) fail('Access is configured, but a check failed (see above). It can take a minute to apply; run the workflow again.');
console.log('\nOnly invited people can open the app now.');
