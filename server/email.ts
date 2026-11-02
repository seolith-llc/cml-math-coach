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
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7fb;color:#1d2433;margin:0;padding:40px 16px}
main{max-width:460px;margin:auto;background:#fff;border:1px solid #dde2ee;border-radius:16px;padding:28px;text-align:center}
button,a.btn{font:inherit;font-weight:700;background:#3b5bdb;color:#fff;border:0;border-radius:12px;padding:12px 20px;cursor:pointer;text-decoration:none;display:inline-block}
p{line-height:1.5;color:#5f6b80}</style></head><body><main>${body}</main></body></html>`;

export const htmlResponse = (status: number, html: string) =>
  new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

/* ---------------- PIN-protected actions (from the dashboard) ---------------- */

export async function setEmail(ctx: EmailCtx, body: Record<string, unknown>) {
  const now = ctx.now ?? Date.now();
  const row = await authorize(ctx.db, body, now);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address');
  const mailer = needMailer(ctx);
  await useQuota(ctx.db, row, now);
  const token = randomToken();
  const unsub = row.unsub_token ?? randomToken();
  await ctx.db
    .prepare('UPDATE families SET email = ?, email_verified = 0, email_token = ?, email_token_expires = ?, unsub_token = ? WHERE key = ?')
    .bind(email, await sha256Hex('confirm:' + token), now + TOKEN_DAYS * 86_400_000, unsub, row.key)
    .run();
  const link = `${ctx.origin}/api/email/confirm?t=${token}`;
  const who = row.child_name ? `${row.child_name}'s` : "your child's";
  await mailer({
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
  if (!row.email || !row.email_verified) throw new HttpError(400, 'Confirm your email address first');
  const mailer = needMailer(ctx);
  await useQuota(ctx.db, row, now);
  const data = (await loadData(ctx.db, row, now)) as DashboardData;
  const digest = buildDigest(data, { appUrl: ctx.origin + '/', unsubscribeUrl: unsubscribeUrl(ctx.origin, row.unsub_token!) }, now, { test: true })!;
  await mailer(mailFor(ctx.origin, row, digest));
  return { ok: true, sent: true, week: currentWeekKey(now) };
}

/* ---------------- public links (from email) ---------------- */

export async function confirmEmail(db: DB, token: string, now = Date.now()): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return htmlResponse(400, page('Link not valid', '<h1>Link not valid</h1><p>This confirmation link is incomplete. Please request a new one from the parent dashboard.</p>'));
  const row = await db.prepare('SELECT * FROM families WHERE email_token = ?').bind(await sha256Hex('confirm:' + token)).first<FamilyRow>();
  if (!row || !row.email_token_expires || row.email_token_expires < now) {
    return htmlResponse(410, page('Link expired', '<h1>Link expired</h1><p>This link has expired or was already used. Request a new one from the parent dashboard.</p>'));
  }
  await db.prepare('UPDATE families SET email_verified = 1, email_token = NULL, email_token_expires = NULL WHERE key = ?').bind(row.key).run();
  return htmlResponse(200, page('Email confirmed', `<h1>✅ You're all set</h1><p>Weekly updates will go to <strong>${row.email!.replace(/[<>&]/g, '')}</strong> every Sunday evening.</p>`));
}

export async function unsubscribe(db: DB, token: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return htmlResponse(400, page('Link not valid', '<h1>Link not valid</h1>'));
  const row = await db.prepare('SELECT key, email FROM families WHERE unsub_token = ?').bind(token).first<FamilyRow>();
  if (row?.email) await db.prepare('UPDATE families SET email = NULL, email_verified = 0, email_token = NULL WHERE key = ?').bind(row.key).run();
  return htmlResponse(200, page('Unsubscribed', '<h1>You are unsubscribed</h1><p>No more weekly emails will be sent. You can turn them back on any time from the parent dashboard.</p>'));
}

/** GET pages only show a button; the change happens on POST, so link scanners in email clients can't trigger it. */
export function confirmButtonPage(action: 'confirm' | 'unsubscribe', token: string): Response {
  const t = token.replace(/[^A-Za-z0-9_-]/g, '');
  const [title, text, label, param] =
    action === 'confirm'
      ? ['Confirm email', 'Confirm that you want a weekly Math Coach progress email.', 'Confirm email', 't']
      : ['Unsubscribe', 'Stop the weekly Math Coach progress email?', 'Unsubscribe', 'u'];
  return htmlResponse(200, page(title, `<h1>${title}</h1><p>${text}</p><form method="post" action="?${param}=${t}"><button type="submit">${label}</button></form>`));
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
  const mailer = needMailer(ctx);
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
        await mailer(mailFor(ctx.origin, row, digest));
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
