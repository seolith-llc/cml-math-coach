/**
 * Weekly-email features on top of the parent dashboard:
 * - set / confirm (double opt-in) / test / stop an email address (PIN-protected, via /api/parent)
 * - one-click unsubscribe (link in every email, RFC 8058 List-Unsubscribe-Post)
 * - the weekly batch sender, called by a scheduled GitHub Action (/api/weekly, bearer secret)
 */
import type { Mail } from './ses';
import { authorize, HttpError, loadData, sha256Hex, type DB, type FamilyRow } from './parent';
import { buildDigest, currentWeekKey, sendWindow } from './digest';
import type { DashboardData } from '../src/core/insights';

export type Mailer = (m: Omit<Mail, 'from'>) => Promise<string>;

export interface EmailCtx {
  db: DB;
  mailer?: Mailer;
  /** Public site URL used in links, e.g. https://cml-math-coach.seolith.com */
  origin: string;
  now?: number;
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const DAILY_EMAIL_CAP = 5; // confirmations + tests per family per day
const TOKEN_DAYS = 3;

function randomToken(bytes = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function needMailer(ctx: EmailCtx): Mailer {
  if (!ctx.mailer) throw new HttpError(503, 'Email is not set up on the server yet');
  return ctx.mailer;
}

type Kind = 'confirm' | 'test' | 'weekly';

function logEmail(ctx: EmailCtx, family: string, kind: Kind, ok: boolean, detail: string) {
  return ctx.db.prepare('INSERT INTO email_log (ts, family, kind, ok, detail) VALUES (?, ?, ?, ?, ?)').bind(ctx.now ?? Date.now(), family, kind, ok ? 1 : 0, detail.slice(0, 300)).run().catch(() => {});
}

/** Sends through the mailer and records the outcome in email_log (MessageId or error). */
async function send(ctx: EmailCtx, family: string, kind: Kind, m: Parameters<Mailer>[0]): Promise<string> {
  const mailer = needMailer(ctx);
  const log = (ok: boolean, detail: string) => logEmail(ctx, family, kind, ok, detail);
  try {
    const id = await mailer(m);
    await log(true, id);
    return id;
  } catch (e) {
    await log(false, (e as Error).message);
    throw e;
  }
}

/** Caps confirmation/test emails so the feature can't be used to spam an address. */
async function useQuota(db: DB, row: FamilyRow, now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const [d, n] = (row.email_quota ?? '').split(':');
  const used = d === day ? Number(n) || 0 : 0;
  if (used >= DAILY_EMAIL_CAP) throw new HttpError(429, 'Daily email limit reached. Try again tomorrow.');
  await db.prepare('UPDATE families SET email_quota = ? WHERE key = ?').bind(`${day}:${used + 1}`, row.key).run();
}

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
:root{--bg:#f2f2f7;--surface:#fff;--text:#1c1c1e;--muted:#6e6e73;--accent:#2f6fed;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#000;--surface:#1c1c1e;--text:#f5f5f7;--muted:#98989d;--accent:#4c8dff}}
body{font:17px/1.45 -apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:64px 16px}
main{max-width:420px;margin:auto;background:var(--surface);border-radius:12px;padding:32px 24px;text-align:center}
h1{font-size:22px;margin:0 0 8px}p{margin:0 0 20px;color:var(--muted)}
button,a.btn{font:inherit;font-weight:600;background:var(--accent);color:#fff;border:0;border-radius:12px;min-height:48px;padding:0 24px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
</style></head><body><main>${body}</main></body></html>`;

export const htmlResponse = (status: number, html: string) =>
  new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

/* ---------------- PIN-protected actions (from the dashboard) ---------------- */

export async function setEmail(ctx: EmailCtx, body: Record<string, unknown>) {
  const now = ctx.now ?? Date.now();
  const row = await authorize(ctx.db, body, now);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address');
  needMailer(ctx);
  await useQuota(ctx.db, row, now);
  const token = randomToken();
  const unsub = row.unsub_token ?? randomToken();
  await ctx.db
    .prepare('UPDATE families SET email = ?, email_verified = 0, email_token = ?, email_token_expires = ?, unsub_token = ? WHERE key = ?')
    .bind(email, await sha256Hex('confirm:' + token), now + TOKEN_DAYS * 86_400_000, unsub, row.key)
    .run();
  const link = `${ctx.origin}/api/email/confirm?t=${token}`;
  const who = row.child_name ? `${row.child_name}'s` : "your child's";
  await send(ctx, row.key, 'confirm', {
    to: email,
    subject: 'Confirm your weekly Math Coach email',
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#1d2433">
      <h2>Confirm your email</h2><p>Tap the button to get a short weekly email about ${who} math practice every Sunday evening.</p>
      <p><a href="${link}" style="background:#2a78d6;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Confirm email</a></p>
      <p style="color:#5f6b80;font-size:13px">The link works for ${TOKEN_DAYS} days. If you didn't ask for this, ignore this email and nothing will be sent.</p></div>`,
    text: `Confirm your weekly Math Coach email:\n${link}\n\nThe link works for ${TOKEN_DAYS} days. If you didn't ask for this, ignore this email.`
  });
  return { ok: true, email, verified: false };
}

export async function stopEmail(ctx: EmailCtx, body: Record<string, unknown>) {
  const row = await authorize(ctx.db, body, ctx.now ?? Date.now());
  await ctx.db.prepare('UPDATE families SET email = NULL, email_verified = 0, email_token = NULL, email_token_expires = NULL WHERE key = ?').bind(row.key).run();
  return { ok: true, email: null };
}

function unsubscribeUrl(origin: string, token: string) {
  return `${origin}/api/email/unsubscribe?u=${token}`;
}

function mailFor(origin: string, row: FamilyRow, digest: { subject: string; html: string; text: string }) {
  const unsub = unsubscribeUrl(origin, row.unsub_token!);
  return {
    to: row.email!,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  };
}

export async function testEmail(ctx: EmailCtx, body: Record<string, unknown>) {
  const now = ctx.now ?? Date.now();
  const row = await authorize(ctx.db, body, now);
  // Log refusals too, so "I pressed Send test" always leaves a trace in the Status report.
  const refuse = async (e: HttpError) => {
    await logEmail(ctx, row.key, 'test', false, `not sent: ${e.message}`);
    throw e;
  };
  if (!row.email || !row.email_verified) return refuse(new HttpError(400, 'Confirm your email address first'));
  if (!ctx.mailer) return refuse(new HttpError(503, 'Email is not set up on the server yet'));
  await useQuota(ctx.db, row, now).catch((e) => refuse(e as HttpError));
  const data = (await loadData(ctx.db, row, now)) as DashboardData;
  const digest = buildDigest(data, { appUrl: ctx.origin + '/', unsubscribeUrl: unsubscribeUrl(ctx.origin, row.unsub_token!) }, now, { test: true })!;
  await send(ctx, row.key, 'test', mailFor(ctx.origin, row, digest));
  return { ok: true, sent: true, week: currentWeekKey(now) };
}

/* ---------------- public links (from email) ---------------- */

export async function confirmEmail(db: DB, token: string, now = Date.now()): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return htmlResponse(400, page('Link not valid', '<h1>Link not valid</h1>'));
  const row = await db.prepare('SELECT * FROM families WHERE email_token = ?').bind(await sha256Hex('confirm:' + token)).first<FamilyRow>();
  if (!row || !row.email_token_expires || row.email_token_expires < now) {
    return htmlResponse(410, page('Link expired', '<h1>Link expired</h1>'));
  }
  await db.prepare('UPDATE families SET email_verified = 1, email_token = NULL, email_token_expires = NULL WHERE key = ?').bind(row.key).run();
  return htmlResponse(200, page('Email confirmed', `<h1>You're all set</h1><p>${row.email!.replace(/[<>&]/g, '')} · Sundays</p>`));
}

export async function unsubscribe(db: DB, token: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return htmlResponse(400, page('Link not valid', '<h1>Link not valid</h1>'));
  const row = await db.prepare('SELECT key, email FROM families WHERE unsub_token = ?').bind(token).first<FamilyRow>();
  if (row?.email) await db.prepare('UPDATE families SET email = NULL, email_verified = 0, email_token = NULL WHERE key = ?').bind(row.key).run();
  return htmlResponse(200, page('Unsubscribed', '<h1>Unsubscribed</h1>'));
}

/** GET pages only show a button; the change happens on POST, so link scanners in email clients can't trigger it. */
export function confirmButtonPage(action: 'confirm' | 'unsubscribe', token: string): Response {
  const t = token.replace(/[^A-Za-z0-9_-]/g, '');
  const [title, label, param] =
    action === 'confirm'
      ? ['Weekly email', 'Confirm email', 't']
      : ['Weekly email', 'Unsubscribe', 'u'];
  return htmlResponse(200, page(title, `<h1>${title}</h1><form method="post" action="?${param}=${t}"><button type="submit">${label}</button></form>`));
}

/* ---------------- weekly batch ---------------- */

export interface WeeklyResult {
  week: string | null;
  sent: number;
  skipped: number;
  failed: number;
  remaining: number;
  errors: string[];
  reason?: string;
}

export async function sendWeekly(ctx: EmailCtx, opts: { force?: boolean; limit?: number } = {}): Promise<WeeklyResult> {
  const now = ctx.now ?? Date.now();
  const week = opts.force ? currentWeekKey(now) : sendWindow(now);
  if (!week) return { week: null, sent: 0, skipped: 0, failed: 0, remaining: 0, errors: [], reason: 'Outside the Sunday-evening send window (America/Chicago)' };
  needMailer(ctx);
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 40);
  const due = (n: number) =>
    ctx.db
      .prepare('SELECT * FROM families WHERE email_verified = 1 AND email IS NOT NULL AND (email_last_week IS NULL OR email_last_week <> ?) ORDER BY key LIMIT ?')
      .bind(week, n);
  const { results } = await due(limit).all<FamilyRow>();
  const out: WeeklyResult = { week, sent: 0, skipped: 0, failed: 0, remaining: 0, errors: [] };
  for (const row of results) {
    try {
      const data = (await loadData(ctx.db, row, now)) as DashboardData;
      const digest = buildDigest(data, { appUrl: ctx.origin + '/', unsubscribeUrl: unsubscribeUrl(ctx.origin, row.unsub_token!) }, now);
      if (digest) {
        await send(ctx, row.key, 'weekly', mailFor(ctx.origin, row, digest));
        out.sent++;
      } else out.skipped++; // inactive for 4+ weeks: don't nag
      await ctx.db.prepare('UPDATE families SET email_last_week = ? WHERE key = ?').bind(week, row.key).run();
    } catch (e) {
      out.failed++;
      if (out.errors.length < 5) out.errors.push((e as Error).message.slice(0, 200));
    }
  }
  const left = await ctx.db
    .prepare('SELECT COUNT(*) AS n FROM families WHERE email_verified = 1 AND email IS NOT NULL AND (email_last_week IS NULL OR email_last_week <> ?)')
    .bind(week)
    .first<{ n: number }>();
  out.remaining = Math.max(0, Number(left?.n ?? 0) - out.failed);
  return out;
}
