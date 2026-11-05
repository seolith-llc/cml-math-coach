import { describe, expect, it, vi } from 'vitest';
import { createECDH, createPublicKey, randomBytes, verify } from 'node:crypto';
// @ts-expect-error no types for the reference implementation
import ece from 'http_ece';
import { makeDb } from './parent-server.test';
import { b64u, encryptPayload, getVapid, reminderText, sendReminders, subscribe, touch, unsubscribe, validEndpoint, vapidAuth } from '../server/push';

/** A browser-side subscription key pair, as a real PushManager would create. */
function receiver() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, p256dh: b64u.encode(ecdh.getPublicKey()), auth: b64u.encode(auth), authBuf: auth };
}

describe('RFC 8291 encryption', () => {
  it('decrypts with the independent http_ece implementation', async () => {
    const r = receiver();
    const msg = JSON.stringify(reminderText('Sam', 10));
    const body = await encryptPayload(msg, r.p256dh, r.auth);
    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: r.ecdh, authSecret: r.authBuf });
    expect(plain.toString('utf8')).toBe(msg);
    expect(JSON.parse(msg)).toEqual({ title: 'Math Coach', body: "Sam, ready for today's 10?", url: './#/practice' });
  });
  it('uses the aes128gcm header layout (salt, rs=4096, 65-byte key id)', async () => {
    const r = receiver();
    const body = await encryptPayload('x', r.p256dh, r.auth);
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(body[21]).toBe(4); // uncompressed point
  });
});

describe('VAPID', () => {
  it('signs an ES256 JWT for the push origin that verifies with the public key', async () => {
    const db = makeDb();
    const v = await getVapid(db);
    expect(await getVapid(db)).toEqual(v); // stored once
    const header = await vapidAuth('https://web.push.apple.com/QGuQyavXutnMbyxs', v, 'https://cml-math-coach.seolith.com', Date.UTC(2026, 10, 5));
    const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(v.publicKey);
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(b64u.decode(c)).toString())).toEqual({ aud: 'https://web.push.apple.com', exp: Date.UTC(2026, 10, 5) / 1000 + 43200, sub: 'https://cml-math-coach.seolith.com' });
    const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: v.privateJwk.x, y: v.privateJwk.y }, format: 'jwk' });
    expect(verify('sha256', Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64u.decode(sig)))).toBe(true);
  });
});

describe('subscriptions and reminders', () => {
  const ENDPOINT = 'https://web.push.apple.com/QGuQyavXutnMbyxs-abc';
  // 2026-11-12 17:05 in Chicago (CST) = 23:05 UTC
  const FIVE_PM = Date.UTC(2026, 10, 12, 23, 5);
  async function setup(hour = 17) {
    const db = makeDb();
    const r = receiver();
    await subscribe(db, { subscription: { endpoint: ENDPOINT, keys: { p256dh: r.p256dh, auth: r.auth } }, tz: 'America/Chicago', hour, name: 'Sam', goal: 10 });
    return { db, r };
  }
  const okFetch = () => vi.fn(async () => new Response(null, { status: 201 }));

  it('only accepts real push service endpoints and sane input', async () => {
    expect(validEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(validEndpoint('https://evil.example.com/x')).toBe(false);
    expect(validEndpoint('http://web.push.apple.com/x')).toBe(false);
    const db = makeDb();
    const r = receiver();
    await expect(subscribe(db, { subscription: { endpoint: 'https://evil.example.com/x', keys: { p256dh: r.p256dh, auth: r.auth } }, tz: 'UTC', hour: 17 })).rejects.toThrow(/push subscription/);
    await expect(subscribe(db, { subscription: { endpoint: ENDPOINT, keys: { p256dh: r.p256dh, auth: r.auth } }, tz: 'Mars/Base', hour: 17 })).rejects.toThrow(/time zone/);
    await expect(subscribe(db, { subscription: { endpoint: ENDPOINT, keys: { p256dh: r.p256dh, auth: r.auth } }, tz: 'UTC', hour: 23 })).rejects.toThrow(/6–21/);
  });

  it('sends once at the chosen local hour, encrypted for that device', async () => {
    const { db, r } = await setup();
    const f = okFetch();
    expect((await sendReminders(db, { now: FIVE_PM - 3600e3, subject: 'https://x', fetchImpl: f as never })).sent).toBe(0); // 4 pm
    expect((await sendReminders(db, { now: FIVE_PM, subject: 'https://x', fetchImpl: f as never })).sent).toBe(1);
    expect((await sendReminders(db, { now: FIVE_PM + 1800e3, subject: 'https://x', fetchImpl: f as never })).sent).toBe(0); // same day
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(ENDPOINT);
    expect(init.headers).toMatchObject({ 'content-encoding': 'aes128gcm', ttl: '14400', topic: 'daily-practice' });
    expect(init.headers.authorization).toMatch(/^vapid t=.+, k=.+$/);
    const plain = ece.decrypt(Buffer.from(init.body as Uint8Array), { version: 'aes128gcm', privateKey: r.ecdh, authSecret: r.authBuf });
    expect(JSON.parse(plain.toString()).body).toBe("Sam, ready for today's 10?");
    expect((await sendReminders(db, { now: FIVE_PM + 86_400_000, subject: 'https://x', fetchImpl: f as never })).sent).toBe(1); // next day
  });

  it('skips a child who already practiced today, and pauses after 14 idle days', async () => {
    const { db } = await setup();
    const f = okFetch();
    await touch(db, { endpoint: ENDPOINT, day: '2026-11-12' });
    expect(await sendReminders(db, { now: FIVE_PM, subject: 'https://x', fetchImpl: f as never })).toMatchObject({ sent: 0, skipped: 1 });
    await touch(db, { endpoint: ENDPOINT, day: '2026-10-20' });
    expect(await sendReminders(db, { now: FIVE_PM, subject: 'https://x', fetchImpl: f as never })).toMatchObject({ sent: 0, skipped: 1 });
    expect(f).not.toHaveBeenCalled();
  });

  it('removes expired subscriptions (410) and stops after unsubscribe', async () => {
    const { db } = await setup();
    const gone = vi.fn(async () => new Response(null, { status: 410 }));
    expect((await sendReminders(db, { now: FIVE_PM, subject: 'https://x', fetchImpl: gone as never })).removed).toBe(1);
    const { db: db2 } = await setup();
    await unsubscribe(db2, { endpoint: ENDPOINT });
    const f = okFetch();
    expect((await sendReminders(db2, { now: FIVE_PM, subject: 'https://x', fetchImpl: f as never })).sent).toBe(0);
  });
});

import { onRequestPost as hourly } from '../functions/api/hourly';

describe('/api/hourly', () => {
  it('requires the bearer secret and reports each part', async () => {
    const db = makeDb();
    const req = (auth?: string) => new Request('https://cml-math-coach.seolith.com/api/hourly', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: '{}' });
    const env = { DB: db, CRON_SECRET: 'a-long-enough-cron-secret' };
    expect((await hourly({ request: req(), env })).status).toBe(401);
    const res = await hourly({ request: req('Bearer a-long-enough-cron-secret'), env });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminders: { sent: 0, skipped: 0, removed: 0, failed: 0 }, nudges: { error: 'Email is not configured' }, weekly: { error: 'Email is not configured' } });
  });
});
