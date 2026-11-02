/**
 * Minimal Amazon SES v2 client for Cloudflare Workers (no SDK): AWS Signature Version 4 with WebCrypto.
 * API: POST https://email.<region>.amazonaws.com/v2/email/outbound-emails
 */

export interface AwsCreds {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}

export interface Mail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers such as List-Unsubscribe (SES v2 Simple.Headers). */
  headers?: Record<string, string>;
  replyTo?: string;
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Signs a request and returns the headers to send (Authorization, X-Amz-Date, …). */
export async function signV4(opts: {
  method: string;
  url: string;
  service: string;
  region: string;
  headers: Record<string, string>;
  body: string;
  creds: Pick<AwsCreds, 'accessKeyId' | 'secretAccessKey' | 'sessionToken'>;
  date?: Date;
}): Promise<Record<string, string>> {
  const u = new URL(opts.url);
  const amzDate = (opts.date ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = { ...opts.headers, host: u.host, 'x-amz-date': amzDate };
  if (opts.creds.sessionToken) headers['x-amz-security-token'] = opts.creds.sessionToken;
  const names = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [rfc3986(k), rfc3986(v)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const path = u.pathname.split('/').map((p) => rfc3986(decodeURIComponent(p))).join('/') || '/';
  const canonical = [opts.method.toUpperCase(), path, query, names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), await sha256(opts.body)].join('\n');
  const scope = `${day}/${opts.region}/${opts.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');
  let key = await hmac(enc.encode('AWS4' + opts.creds.secretAccessKey), day);
  for (const part of [opts.region, opts.service, 'aws4_request']) key = await hmac(key, part);
  const signature = hex(await hmac(key, toSign));
  const out: Record<string, string> = { ...opts.headers, 'x-amz-date': amzDate };
  if (opts.creds.sessionToken) out['x-amz-security-token'] = opts.creds.sessionToken;
  out.authorization = `AWS4-HMAC-SHA256 Credential=${opts.creds.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return out;
}

export function sesRequestBody(m: Mail, withHeaders = true) {
  const headers = withHeaders && m.headers ? Object.entries(m.headers).map(([Name, Value]) => ({ Name, Value })) : undefined;
  return {
    FromEmailAddress: m.from,
    Destination: { ToAddresses: [m.to] },
    ...(m.replyTo ? { ReplyToAddresses: [m.replyTo] } : {}),
    Content: {
      Simple: {
        Subject: { Data: m.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: m.html, Charset: 'UTF-8' }, Text: { Data: m.text, Charset: 'UTF-8' } },
        ...(headers ? { Headers: headers } : {})
      }
    }
  };
}

export class SesError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Sends one email. Retries once without custom headers if SES rejects them. */
export async function sendSes(creds: AwsCreds, m: Mail, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = `https://email.${creds.region}.amazonaws.com/v2/email/outbound-emails`;
  const attempt = async (withHeaders: boolean) => {
    const body = JSON.stringify(sesRequestBody(m, withHeaders));
    const headers = await signV4({ method: 'POST', url, service: 'ses', region: creds.region, headers: { 'content-type': 'application/json' }, body, creds });
    const res = await fetchImpl(url, { method: 'POST', headers, body });
    const json = (await res.json().catch(() => ({}))) as { MessageId?: string; message?: string; Message?: string };
    if (!res.ok) throw new SesError(res.status, json.message ?? json.Message ?? `SES HTTP ${res.status}`);
    return json.MessageId ?? '';
  };
  try {
    return await attempt(true);
  } catch (e) {
    if (m.headers && e instanceof SesError && e.status === 400 && /header/i.test(e.message)) return attempt(false);
    throw e;
  }
}
