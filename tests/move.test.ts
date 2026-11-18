import { describe, expect, it } from 'vitest';
import { makeDb } from './parent-server.test';
import { onRequest } from '../functions/_middleware';
import { onRequestPost as handoffRoute } from '../functions/api/handoff';
import { onRequestPost as adminInviteRoute } from '../functions/api/admin/invite';
import { HANDOFF, putHandoff, sweepHandoffs, takeHandoff } from '../server/handoff';
import { NEW_HOST, OLD_HOSTS, authRequired } from '../server/hosts';
import { acceptTerms, completeSignIn, inviteByEmail, parseAdmins, requestSignIn, sessionUser, type AccountsCtx } from '../server/accounts';
import { TERMS_VERSION } from '../src/content/legal';
import type { Mailer } from '../server/email';

const UA = 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) Safari/604.1';
const SECRET = 'a-cron-secret-of-enough-length';
const at = (host: string, path: string, init: RequestInit & { cookie?: string } = {}) =>
  new Request(`https://${host}${path}`, {
    method: init.method ?? 'POST',
    headers: { 'user-agent': UA, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers as Record<string, string>) },
    body: init.body
  });
const ok = async () => new Response('app', { status: 200 });

function world() {
  const db = makeDb();
  const sent: { to: string; subject: string; text: string }[] = [];
  const mailer: Mailer = async (m) => { sent.push({ to: m.to, subject: m.subject, text: m.text }); return 'id'; };
  const ctx = (): AccountsCtx => ({ db, mailer, origin: `https://${NEW_HOST}`, admins: parseAdmins('') });
  return { db, sent, ctx };
}

describe('phase 3: sign-in required on the new address (step080)', () => {
  it('is required on the new address always, elsewhere only with AUTH_REQUIRED=1', () => {
    expect(authRequired({}, at(NEW_HOST, '/'))).toBe(true);
    expect(authRequired({}, at(OLD_HOSTS[0], '/'))).toBe(false);
    expect(authRequired({ AUTH_REQUIRED: '1' }, at(OLD_HOSTS[0], '/'))).toBe(true);
  });

  it('data APIs refuse strangers; sign-in, email links, hand-off and the app shell stay open', async () => {
    const { db } = world();
    const env = { DB: db, CRON_SECRET: SECRET };
    for (const p of ['/api/sync', '/api/parent', '/api/tts', '/api/feedback', '/api/push']) {
      const r = await onRequest({ request: at(NEW_HOST, p), env, next: ok });
      expect(r.status, p).toBe(401);
    }
    for (const p of ['/', '/index.html', '/api/auth', '/api/auth/signin', '/api/email/unsubscribe', '/api/handoff', '/api/hourly']) {
      const r = await onRequest({ request: at(NEW_HOST, p), env, next: ok });
      expect(r.status, p).toBe(200);
    }
    // CI with the bearer secret, and the old address (still behind Cloudflare Access) pass through
    expect((await onRequest({ request: at(NEW_HOST, '/api/tts', { headers: { authorization: `Bearer ${SECRET}` } }), env, next: ok })).status).toBe(200);
    expect((await onRequest({ request: at(OLD_HOSTS[0], '/api/sync'), env, next: ok })).status).toBe(200);
  });

  it('a signed-in member who accepted the terms gets through; before accepting, they are asked to', async () => {
    const { db, sent, ctx } = world();
    const env = { DB: db, CRON_SECRET: SECRET };
    await requestSignIn(ctx(), { email: parseAdmins('')[0] });
    const t = new URL(sent[0].text.match(/https:\/\/\S+/)![0]).searchParams.get('t')!;
    const r = await completeSignIn(ctx(), t);
    const cookie = ('cookie' in r ? r.cookie : '').split(';')[0];
    expect((await onRequest({ request: at(NEW_HOST, '/api/sync', { cookie }), env, next: ok })).status).toBe(428);
    const u = (await sessionUser(ctx(), at(NEW_HOST, '/', { cookie })))!;
    await acceptTerms(ctx(), u, { version: TERMS_VERSION });
    expect((await onRequest({ request: at(NEW_HOST, '/api/sync', { cookie }), env, next: ok })).status).toBe(200);
  });
});

describe('phase 3: handing a device’s progress to the new address', () => {
  it('puts once on the old address, takes once on the new one, within 30 minutes', async () => {
    const { db } = world();
    const state = JSON.stringify({ version: 1, stats: { '2': { coins: { stars: 2 } } } });
    const { code } = await putHandoff(db, { state }, 1000);
    expect(await takeHandoff(db, { code }, 2000)).toEqual({ state });
    await expect(takeHandoff(db, { code }, 3000)).rejects.toThrow(/expired/);
    const late = await putHandoff(db, { state }, 1000);
    await expect(takeHandoff(db, { code: late.code }, 1000 + HANDOFF.minutes * 60_000 + 1)).rejects.toThrow(/expired/);
    await putHandoff(db, { state }, 1000);
    expect((await sweepHandoffs(db, 1000 + HANDOFF.minutes * 60_000 + 1)).deleted).toBeGreaterThanOrEqual(1);
    await expect(putHandoff(db, { state: 'not json' })).rejects.toThrow(/Nothing to move/);
  });

  it('the route only puts on the old address and only takes on the new one', async () => {
    const { db } = world();
    const env = { DB: db };
    const put = (host: string) => handoffRoute({ request: at(host, '/api/handoff', { body: JSON.stringify({ action: 'put', state: '{"a":1}' }) }), env });
    expect((await put(NEW_HOST)).status).toBe(400);
    const r = await put(OLD_HOSTS[0]);
    const { code } = await r.json();
    const take = (host: string) => handoffRoute({ request: at(host, '/api/handoff', { body: JSON.stringify({ action: 'take', code }) }), env });
    expect((await take(OLD_HOSTS[0])).status).toBe(400);
    expect(await (await take(NEW_HOST)).json()).toEqual({ state: '{"a":1}' });
  });
});

describe('phase 3: the super admin invites families by email', () => {
  it('emails each new address its own invite link, skips members and bad addresses', async () => {
    const { sent, ctx } = world();
    const r = await inviteByEmail(ctx(), 'one@example.com, two@example.com; nope, ONE@example.com');
    expect(r).toEqual({ invited: 2, already: 0, invalid: 1 });
    expect(sent.map((m) => m.to)).toEqual(['one@example.com', 'two@example.com']);
    expect(sent[0].text).toMatch(/#\/invite\/[A-Za-z0-9_-]{20,}/);
    expect(sent[0].text).toContain('not affiliated with or endorsed by');
    expect(await inviteByEmail(ctx(), [parseAdmins('')[0], parseAdmins('')[1]])).toEqual({ invited: 0, already: 2, invalid: 0 });
  });

  it('the route needs the bearer secret', async () => {
    const { db } = world();
    const req = (auth?: string) => at(NEW_HOST, '/api/admin/invite', { body: JSON.stringify({ emails: ['x@example.com'] }), headers: auth ? { authorization: auth } : {} });
    expect((await adminInviteRoute({ request: req(), env: { DB: db, CRON_SECRET: SECRET } })).status).toBe(401);
    // without email set up on the server, it stops with 503
    const r = await adminInviteRoute({ request: req(`Bearer ${SECRET}`), env: { DB: db, CRON_SECRET: SECRET } });
    expect(r.status).toBe(503);
  });
});

describe('phase 3: which progress a moved device keeps', async () => {
  const { pickState } = await import('../src/core/hosts');
  it('keeps the copy with more answers (the old one when the new address is fresh)', () => {
    const old = JSON.stringify({ log: [1, 2, 3] });
    expect(pickState(null, old)).toBe(old);
    expect(pickState(JSON.stringify({ log: [1] }), old)).toBe(old);
    const busy = JSON.stringify({ log: [1, 2, 3, 4] });
    expect(pickState(busy, old)).toBe(busy);
  });
});
