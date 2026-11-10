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

const fail = (msg) => {
  console.log(`::error::${msg}`);
  process.exit(1);
};
if (!token || !account) fail('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
if (!emails.length) fail('Add the GitHub secret ACCESS_ALLOWED_EMAILS: the email addresses allowed to open the app, separated by commas.');
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
  console.log(`✔ Zero Trust organization: ${org.auth_domain}`);
} catch (e) {
  fail(`Zero Trust is not set up yet (${e.message}). In the Cloudflare dashboard open Zero Trust, choose a team name and the Free plan, then run this again.` +
    (e.status === 403 ? ' If it is set up, the API token is missing the Access permissions listed in docs/DEPLOY.md.' : ''));
}
const idps = await cf('GET', `${acc}/identity_providers`);
let otp = idps.find((p) => p.type === 'onetimepin');
if (!otp) otp = await cf('POST', `${acc}/identity_providers`, { name: 'One-time PIN', type: 'onetimepin', config: {} });
console.log('✔ Sign-in: one-time PIN by email');

// 2. Service token for CI
const tokens = await cf('GET', `${acc}/service_tokens`);
const svc = tokens.find((t) => t.name === tokenName);
if (!svc) fail(`Create the service token "${tokenName}" (Zero Trust → Access → Service credentials → Service Tokens, duration: non-expiring), then add its Client ID and Client Secret as the GitHub secrets CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.`);
console.log(`✔ Service token "${tokenName}" found`);

// 3. Applications (upsert by name)
const apps = await cf('GET', `${acc}/apps`);
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
