/**
 * Web Push for daily practice reminders on the kid's device (no SDK; WebCrypto only).
 * - RFC 8291 message encryption (aes128gcm) and RFC 8292 VAPID (ES256 JWT).
 * - The VAPID key pair is generated once and kept in D1 (`kv`), so there is nothing to configure.
 *
 * Reminder rules (parent-controlled, child-friendly): opt-in, at most one a day at the chosen local hour,
 * skipped if the child already practiced today, and paused after 14 days without practice.
 */
import type { DB } from './parent';
import { HttpError, sha256Hex } from './parent';

const enc = new TextEncoder();

export const b64u = {
  encode(bytes: ArrayBuffer | Uint8Array): string {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = '';
    for (const x of b) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): Uint8Array {
    const t = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
};

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource));
}

/* ---------------- VAPID ---------------- */

export interface Vapid {
  publicKey: string; // base64url, uncompressed P-256 point (65 bytes)
  privateJwk: JsonWebKey;
}

export async function generateVapid(): Promise<Vapid> {
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
  return { publicKey: b64u.encode(raw as ArrayBuffer), privateJwk: (await crypto.subtle.exportKey('jwk', kp.privateKey)) as JsonWebKey };
}

/** Loads the key pair from D1, creating it on first use (safe under concurrent first requests). */
export async function getVapid(db: DB): Promise<Vapid> {
  const row = await db.prepare("SELECT v FROM kv WHERE k = 'vapid'").first<{ v: string }>();
  if (row) return JSON.parse(row.v) as Vapid;
  await db.prepare("INSERT OR IGNORE INTO kv (k, v) VALUES ('vapid', ?)").bind(JSON.stringify(await generateVapid())).run();
  return JSON.parse((await db.prepare("SELECT v FROM kv WHERE k = 'vapid'").first<{ v: string }>())!.v) as Vapid;
}

/** `Authorization: vapid t=<JWT>, k=<public key>` for one push service origin. */
export async function vapidAuth(endpoint: string, vapid: Vapid, subject: string, now = Date.now()): Promise<string> {
  const header = b64u.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u.encode(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)); // raw r||s, as JWS wants
  return `vapid t=${header}.${claims}.${b64u.encode(sig)}, k=${vapid.publicKey}`;
}

/* ---------------- RFC 8291 encryption ---------------- */

/** Encrypts `payload` for one subscription. Returns the aes128gcm body (header + one record). */
export async function encryptPayload(payload: string, p256dh: string, authSecret: string, opts: { salt?: Uint8Array; asKeys?: CryptoKeyPair } = {}): Promise<Uint8Array> {
  const uaPublic = b64u.decode(p256dh);
  const auth = b64u.decode(authSecret);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const as = opts.asKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', as.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  // IKM = HKDF(auth, shared, "WebPush: info" || 0 || ua_public || as_public, 32)
  const prkKey = await hmac(auth, shared);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  // CEK / NONCE = HKDF(salt, IKM, ...)
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const key = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const padded = concat(enc.encode(payload), new Uint8Array([2])); // 0x02 = last record
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, key, padded as BufferSource));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/* ---------------- subscriptions ---------------- */

/** Real push services only: keeps the endpoint from being used to make the server call arbitrary URLs. */
const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^android\.googleapis\.com$/];

export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

const validTz = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tz: string;
  hour: number;
  name: string | null;
  goal: number;
  last_active_day: string | null;
  last_sent_day: string | null;
  failures: number;
}

export async function publicKey(db: DB) {
  return { key: (await getVapid(db)).publicKey };
}

export async function subscribe(db: DB, body: Record<string, unknown>, now = Date.now()) {
  const sub = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  if (!sub || !validEndpoint(sub.endpoint)) throw new HttpError(400, 'Not a push subscription');
  const p256dh = sub.keys?.p256dh, auth = sub.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 120 || auth.length > 40) throw new HttpError(400, 'Missing subscription keys');
  if (!validTz(body.tz)) throw new HttpError(400, 'Bad time zone');
  const hour = Number(body.hour);
  if (!Number.isInteger(hour) || hour < 6 || hour > 21) throw new HttpError(400, 'Reminder hour must be 6–21');
  const goal = Math.min(30, Math.max(1, Number(body.goal) || 10));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : null;
  const id = await sha256Hex('push:' + sub.endpoint);
  await db
    .prepare(
      `INSERT INTO push_subs (id, endpoint, p256dh, auth, tz, hour, name, goal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz, hour = excluded.hour, name = excluded.name, goal = excluded.goal, failures = 0`
    )
    .bind(id, sub.endpoint, p256dh, auth, body.tz, hour, name, goal, now)
    .run();
  return { ok: true };
}

export async function unsubscribe(db: DB, body: Record<string, unknown>) {
  if (typeof body.endpoint !== 'string') throw new HttpError(400, 'Missing endpoint');
  await db.prepare('DELETE FROM push_subs WHERE id = ?').bind(await sha256Hex('push:' + body.endpoint)).run();
  return { ok: true };
}

/** The app reports "practiced today" so today's reminder is skipped. */
export async function touch(db: DB, body: Record<string, unknown>) {
  if (typeof body.endpoint !== 'string' || typeof body.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) throw new HttpError(400, 'Bad touch');
  await db.prepare('UPDATE push_subs SET last_active_day = ? WHERE id = ?').bind(body.day, await sha256Hex('push:' + body.endpoint)).run();
  return { ok: true };
}

/* ---------------- hourly reminders ---------------- */

export const PAUSE_AFTER_IDLE_DAYS = 14;

function localNow(now: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(now))
      .map((x) => [x.type, x.value])
  );
  return { hour: Number(p.hour), day: `${p.year}-${p.month}-${p.day}` };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Words for the notification: short, positive, no guilt. */
export function reminderText(name: string | null, goal: number) {
  return { title: 'Math Coach', body: name ? `${name}, ready for today's ${goal}?` : `Ready for today's ${goal}?`, url: './#/practice' };
}

export interface PushResult {
  sent: number;
  skipped: number;
  removed: number;
  failed: number;
}

export async function sendReminders(db: DB, opts: { now?: number; subject: string; fetchImpl?: typeof fetch }): Promise<PushResult> {
  const now = opts.now ?? Date.now();
  const doFetch = opts.fetchImpl ?? fetch;
  const vapid = await getVapid(db);
  const { results } = await db.prepare('SELECT * FROM push_subs').all<SubRow>();
  const out: PushResult = { sent: 0, skipped: 0, removed: 0, failed: 0 };
  for (const s of results) {
    const local = localNow(now, s.tz);
    if (local.hour !== s.hour || s.last_sent_day === local.day) continue;
    // Already practiced today, or away for two weeks: don't remind.
    if (s.last_active_day === local.day || (s.last_active_day && daysBetween(s.last_active_day, local.day) > PAUSE_AFTER_IDLE_DAYS)) {
      out.skipped++;
      continue;
    }
    try {
      const body = await encryptPayload(JSON.stringify(reminderText(s.name, s.goal)), s.p256dh, s.auth);
      const res = await doFetch(s.endpoint, {
        method: 'POST',
        headers: {
          authorization: await vapidAuth(s.endpoint, vapid, opts.subject, now),
          'content-encoding': 'aes128gcm',
          'content-type': 'application/octet-stream',
          ttl: String(4 * 3600), // a reminder is useless the next morning
          urgency: 'normal',
          topic: 'daily-practice' // replaces an undelivered earlier reminder
        },
        body: body as BodyInit
      });
      if (res.status === 404 || res.status === 410) {
        await db.prepare('DELETE FROM push_subs WHERE id = ?').bind(s.id).run(); // subscription expired
        out.removed++;
      } else if (res.ok) {
        await db.prepare('UPDATE push_subs SET last_sent_day = ?, failures = 0 WHERE id = ?').bind(local.day, s.id).run();
        out.sent++;
      } else throw new Error(`push ${res.status}`);
    } catch {
      out.failed++;
      await db.prepare('UPDATE push_subs SET failures = failures + 1 WHERE id = ?').bind(s.id).run();
      await db.prepare('DELETE FROM push_subs WHERE id = ? AND failures >= 10').bind(s.id).run();
    }
  }
  return out;
}
