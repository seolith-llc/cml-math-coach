/**
 * Accounts, invite-only (docs/REDESIGN.md §3, step078). Adults only; a child never has an account.
 *
 * - Sign-in: a one-time email link (15 minutes), no passwords. The link opens a page with a button (safe from mail
 *   scanners); the button signs in and sets an HttpOnly session cookie that slides forward 30 days with use.
 * - Invites (links, single use, 14 days):
 *     join   → a co-parent or viewer joins the inviter's household, active as soon as they confirm their email;
 *     family → a new family. The inviter approves with one tap in an email; after 72 hours undecided it goes to the
 *              super admin. A super admin's own family invites are approved on accept.
 * - Terms: each person accepts the current TERMS_VERSION; it is due again after 30 days (content/legal.ts).
 * - Super admins: ADMIN_EMAILS (secret). They can sign in without an invite, decide approvals, and suspend a person
 *   (optionally with everyone they invited, the "branch").
 * Unknown addresses get the same answer as known ones, so the sign-in form can't be used to find out who is a member.
 */
import { ACCEPT_DAYS, DISCLAIMER_SHORT, TERMS_VERSION, daysLeft, termsDue } from '../src/content/legal';
import type { Mailer } from './email';
import { HttpError, sha256Hex, type DB } from './parent';

export const SESSION_COOKIE = 'pt_session';
const MIN = 60_000;
const DAY = 86_400_000;
export const AUTH_LIMITS = {
  signinMinutes: 15,
  sessionDays: 30,
  inviteDays: 14,
  approveDays: 7,
  escalateHours: 72,
  signinPerHour: 5,
  familyInvitesStart: 3,
  familyInvitesMax: 10,
  openInvitesMax: 10
};

export type Role = 'owner' | 'coparent' | 'viewer';
export type Status = 'pending' | 'active' | 'denied' | 'suspended';

export interface User {
  id: string;
  email: string;
  status: Status;
  is_admin: number;
  invited_by: string | null;
  invites_left: number;
  terms_version: string | null;
  terms_at: number | null;
  created_at: number;
  last_seen: number | null;
}

export interface AccountsCtx {
  db: DB;
  mailer?: Mailer;
  /** Public site URL for links. */
  origin: string;
  /** Super admin addresses (ADMIN_EMAILS). */
  admins: string[];
  now?: number;
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const now = (ctx: AccountsCtx) => ctx.now ?? Date.now();

/** The app owner's super admins: always admins, whatever ADMIN_EMAILS says (step079). */
export const SUPER_ADMINS: readonly string[] = ['seolith.com@gmail.com', 'teamdev01@seolith.com'];

/** Super admins: the built-in owners plus any extra addresses in ADMIN_EMAILS. */
export function parseAdmins(raw: string | undefined): string[] {
  const extra = (raw ?? '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e));
  return [...new Set([...SUPER_ADMINS, ...extra])];
}

function randomToken(bytes = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const newId = () => randomToken(12);
const validToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(t);

function cleanEmail(v: unknown): string {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address');
  return email;
}

/* ---------------- users and households ---------------- */

const userById = (db: DB, id: string) => db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
const userByEmail = (db: DB, email: string) => db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();

async function createUser(ctx: AccountsCtx, email: string, status: Status, invitedBy: string | null): Promise<User> {
  const id = newId();
  const admin = ctx.admins.includes(email) ? 1 : 0;
  await ctx.db
    .prepare('INSERT INTO users (id, email, status, is_admin, invited_by, invites_left, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, email, status, admin, invitedBy, AUTH_LIMITS.familyInvitesStart, now(ctx))
    .run();
  return (await userById(ctx.db, id))!;
}

async function createHousehold(ctx: AccountsCtx, owner: string): Promise<string> {
  const id = newId();
  await ctx.db.batch([
    ctx.db.prepare('INSERT INTO households (id, owner, created_at) VALUES (?, ?, ?)').bind(id, owner, now(ctx)),
    ctx.db.prepare("INSERT INTO members (household, user, role, created_at) VALUES (?, ?, 'owner', ?)").bind(id, owner, now(ctx))
  ]);
  return id;
}

async function roleIn(db: DB, household: string, user: string): Promise<Role | null> {
  const r = await db.prepare('SELECT role FROM members WHERE household = ? AND user = ?').bind(household, user).first<{ role: Role }>();
  return r?.role ?? null;
}

/** An active user with no household gets one (a family approved, or a super admin signing in for the first time). */
async function ensureHousehold(ctx: AccountsCtx, u: User): Promise<void> {
  const any = await ctx.db.prepare('SELECT household FROM members WHERE user = ? LIMIT 1').bind(u.id).first();
  if (!any) await createHousehold(ctx, u.id);
}

/* ---------------- email ---------------- */

const wrap = (title: string, body: string, button?: { label: string; url: string }) => ({
  html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1c1c1e">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>${body}
${button ? `<p style="margin:24px 0"><a href="${button.url}" style="background:#2f6fed;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">${button.label}</a></p>` : ''}
<p style="font-size:11px;color:#6e6e73;margin-top:28px">${DISCLAIMER_SHORT}</p></div>`,
  text: (plain: string) => `${plain}${button ? `\n\n${button.label}: ${button.url}` : ''}\n\n${DISCLAIMER_SHORT}`
});

async function mail(ctx: AccountsCtx, to: string, kind: string, subject: string, title: string, htmlBody: string, plain: string, button?: { label: string; url: string }) {
  if (!ctx.mailer) throw new HttpError(503, 'Email is not set up on the server yet');
  const w = wrap(title, htmlBody, button);
  const log = (ok: boolean, detail: string) =>
    ctx.db.prepare('INSERT INTO email_log (ts, family, kind, ok, detail) VALUES (?, ?, ?, ?, ?)').bind(now(ctx), 'account', kind, ok ? 1 : 0, detail.slice(0, 300)).run().catch(() => {});
  try {
    const id = await ctx.mailer({ to, subject, html: w.html, text: w.text(plain) });
    await log(true, id);
  } catch (e) {
    await log(false, (e as Error).message);
    throw e;
  }
}

async function newToken(ctx: AccountsCtx, purpose: 'signin' | 'approve', user: string, ttl: number, actor: string | null = null): Promise<string> {
  const t = randomToken();
  await ctx.db
    .prepare('INSERT INTO auth_tokens (hash, purpose, user, actor, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256Hex(t), purpose, user, actor, now(ctx), now(ctx) + ttl)
    .run();
  return t;
}

async function sendSignIn(ctx: AccountsCtx, u: User): Promise<void> {
  const since = now(ctx) - 60 * MIN;
  const n = await ctx.db.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE user = ? AND purpose = 'signin' AND created_at > ?").bind(u.id, since).first<{ n: number }>();
  if ((n?.n ?? 0) >= AUTH_LIMITS.signinPerHour) return; // quietly: the answer is the same either way
  const t = await newToken(ctx, 'signin', u.id, AUTH_LIMITS.signinMinutes * MIN);
  const url = `${ctx.origin}/api/auth/signin?t=${t}`;
  // the same email carries a 6-digit code: an iPad Home Screen app keeps its own storage, so it signs in by typing the code
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  await ctx.db.prepare('INSERT OR REPLACE INTO signin_codes (user, code_hash, expires_at, tries) VALUES (?, ?, ?, 0)')
    .bind(u.id, await sha256Hex(`${u.id}:${code}`), now(ctx) + AUTH_LIMITS.signinMinutes * MIN).run();
  await mail(ctx, u.email, 'signin', `Your Puzzle Trail sign-in code: ${code}`, 'Sign in to Puzzle Trail',
    `<p>Type this code in the app:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0 16px">${code}</p><p>Or tap the button to sign in in this browser. The code and the link work once, for ${AUTH_LIMITS.signinMinutes} minutes.</p><p style="color:#6e6e73;font-size:13px">If you didn't ask for this, ignore this email.</p>`,
    `Your Puzzle Trail sign-in code: ${code}\nType it in the app, or open the link below to sign in in this browser. The code and the link work once, for ${AUTH_LIMITS.signinMinutes} minutes. If you didn't ask for this, ignore this email.`,
    { label: 'Sign in', url });
}

async function askApprover(ctx: AccountsCtx, newcomer: User, approver: User): Promise<void> {
  const t = await newToken(ctx, 'approve', newcomer.id, AUTH_LIMITS.approveDays * DAY, approver.id);
  const url = `${ctx.origin}/api/auth/approve?t=${t}`;
  await mail(ctx, approver.email, 'approve', `Approve ${newcomer.email} for Puzzle Trail?`, 'A family you invited wants to join',
    `<p><b>${newcomer.email.replace(/[<>&]/g, '')}</b> used your invite link. Approve them only if you know them.</p>`,
    `${newcomer.email} used your Puzzle Trail invite link. Approve them only if you know them.`,
    { label: 'Approve or decline', url });
}

/* ---------------- sessions ---------------- */

export function sessionCookie(value: string, maxAgeDays = AUTH_LIMITS.sessionDays): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.round(maxAgeDays * 86400)}`;
}
export const clearCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function cookieValue(request: Request): string | null {
  const m = (request.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]{20,64})`));
  return m ? m[1] : null;
}

/** The signed-in user for a request (active or pending), sliding the session forward; null if none or expired. */
export async function sessionUser(ctx: AccountsCtx, request: Request): Promise<User | null> {
  const v = cookieValue(request);
  if (!v) return null;
  const hash = await sha256Hex(v);
  const s = await ctx.db.prepare('SELECT user, expires_at FROM sessions WHERE hash = ?').bind(hash).first<{ user: string; expires_at: number }>();
  if (!s || s.expires_at <= now(ctx)) return null;
  const u = await userById(ctx.db, s.user);
  if (!u || u.status === 'denied' || u.status === 'suspended') return null;
  await ctx.db.batch([
    ctx.db.prepare('UPDATE sessions SET expires_at = ? WHERE hash = ?').bind(now(ctx) + AUTH_LIMITS.sessionDays * DAY, hash),
    ctx.db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now(ctx), u.id)
  ]);
  return u;
}

/** An active user who has accepted the current terms in the last 30 days; anything else is refused. */
export function requireMember(u: User | null, now: number): User {
  if (!u) throw new HttpError(401, 'Please sign in');
  if (u.status !== 'active') throw new HttpError(403, 'Waiting for approval');
  if (termsDue(acceptanceOf(u), now)) throw new HttpError(428, 'Please accept the terms');
  return u;
}

const acceptanceOf = (u: User) => (u.terms_version && u.terms_at ? { version: u.terms_version, at: u.terms_at } : null);

/* ---------------- sign-in ---------------- */

/** POST /api/auth (action signin): emails a link to a member or a super admin; anyone else gets the same answer. */
export async function requestSignIn(ctx: AccountsCtx, body: Record<string, unknown>) {
  const email = cleanEmail(body.email);
  let u = await userByEmail(ctx.db, email);
  if (!u && ctx.admins.includes(email)) u = await createUser(ctx, email, 'active', null);
  else if (u && ctx.admins.includes(email) && (!u.is_admin || u.status !== 'active')) {
    // a super admin who already had an ordinary account (e.g. joined by invite) becomes super admin
    await ctx.db.prepare("UPDATE users SET is_admin = 1, status = 'active' WHERE id = ?").bind(u.id).run();
    u = (await userById(ctx.db, u.id))!;
  }
  if (u && (u.status === 'active' || u.status === 'pending')) await sendSignIn(ctx, u);
  return { ok: true };
}

/** POST /api/auth/signin?t=: uses the link once and starts a session. Returns the cookie to set. */
export async function completeSignIn(ctx: AccountsCtx, token: string): Promise<{ cookie: string } | { error: string }> {
  if (!validToken(token)) return { error: 'This link is not valid.' };
  const hash = await sha256Hex(token);
  const row = await ctx.db.prepare("SELECT * FROM auth_tokens WHERE hash = ? AND purpose = 'signin'").bind(hash).first<{ user: string; expires_at: number; used_at: number | null }>();
  if (!row || row.used_at) return { error: 'This link was already used. Ask for a new one.' };
  if (row.expires_at <= now(ctx)) return { error: 'This link has expired. Ask for a new one.' };
  const u = await userById(ctx.db, row.user);
  if (!u || u.status === 'denied' || u.status === 'suspended') return { error: 'This account is not active.' };
  await ctx.db.batch([
    ctx.db.prepare('UPDATE auth_tokens SET used_at = ? WHERE hash = ?').bind(now(ctx), hash),
    ctx.db.prepare('DELETE FROM signin_codes WHERE user = ?').bind(u.id)
  ]);
  return startSession(ctx, u);
}

async function startSession(ctx: AccountsCtx, u: User): Promise<{ cookie: string }> {
  if (u.is_admin && u.status === 'active') await ensureHousehold(ctx, u);
  const session = randomToken(32);
  await ctx.db.batch([
    ctx.db.prepare('INSERT INTO sessions (hash, user, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256Hex(session), u.id, now(ctx), now(ctx) + AUTH_LIMITS.sessionDays * DAY),
    ctx.db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now(ctx), u.id)
  ]);
  return { cookie: sessionCookie(session) };
}

/** POST /api/auth (action code): the 6-digit code from the sign-in email, typed in the app. 5 tries, then a new email is needed. */
export async function completeSignInCode(ctx: AccountsCtx, body: Record<string, unknown>): Promise<{ cookie: string }> {
  const wrong = new HttpError(400, "That code didn't work. Check the latest email, or ask for a new one");
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
  if (!/^\d{6}$/.test(code) || !email) throw wrong;
  const u = await userByEmail(ctx.db, email);
  if (!u || u.status === 'denied' || u.status === 'suspended') throw wrong;
  const row = await ctx.db.prepare('SELECT * FROM signin_codes WHERE user = ?').bind(u.id).first<{ code_hash: string; expires_at: number; tries: number }>();
  if (!row || row.expires_at <= now(ctx) || row.tries >= 5) throw wrong;
  if (row.code_hash !== (await sha256Hex(`${u.id}:${code}`))) {
    await ctx.db.prepare('UPDATE signin_codes SET tries = tries + 1 WHERE user = ?').bind(u.id).run();
    throw wrong;
  }
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM signin_codes WHERE user = ?').bind(u.id),
    ctx.db.prepare("UPDATE auth_tokens SET used_at = ? WHERE user = ? AND purpose = 'signin' AND used_at IS NULL").bind(now(ctx), u.id)
  ]);
  return startSession(ctx, u);
}

export async function signOut(ctx: AccountsCtx, request: Request) {
  const v = cookieValue(request);
  if (v) await ctx.db.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256Hex(v)).run();
  return { ok: true };
}

/* ---------------- invites ---------------- */

interface InviteRow {
  id: string;
  kind: 'family' | 'join';
  household: string | null;
  role: Role | null;
  created_by: string;
  created_at: number;
  expires_at: number;
  used_by: string | null;
  revoked: number;
}

async function openInvite(ctx: AccountsCtx, token: unknown): Promise<InviteRow> {
  if (!validToken(token)) throw new HttpError(404, 'This invite link is not valid');
  const inv = await ctx.db.prepare('SELECT * FROM invites WHERE id = ?').bind(await sha256Hex(token)).first<InviteRow>();
  if (!inv || inv.revoked) throw new HttpError(404, 'This invite link is not valid');
  if (inv.used_by) throw new HttpError(410, 'This invite link was already used');
  if (inv.expires_at <= now(ctx)) throw new HttpError(410, 'This invite link has expired');
  const by = await userById(ctx.db, inv.created_by);
  if (!by || by.status !== 'active') throw new HttpError(410, 'This invite link is no longer valid');
  return inv;
}

/** What an invite link offers, before anyone accepts it (no personal details of the inviter). */
export async function inviteInfo(ctx: AccountsCtx, body: Record<string, unknown>) {
  const inv = await openInvite(ctx, body.token);
  return { kind: inv.kind, role: inv.role };
}

/** Someone opens an invite link and enters their email: they get a sign-in link; a new family also waits for approval. */
export async function acceptInvite(ctx: AccountsCtx, body: Record<string, unknown>) {
  const inv = await openInvite(ctx, body.token);
  const email = cleanEmail(body.email);
  const inviter = (await userById(ctx.db, inv.created_by))!;
  let u = await userByEmail(ctx.db, email);
  if (u && (u.status === 'denied' || u.status === 'suspended')) throw new HttpError(403, 'This invite cannot be used with this email');
  if (inv.kind === 'join') {
    if (!u) u = await createUser(ctx, email, 'active', inviter.id);
    const has = await roleIn(ctx.db, inv.household!, u.id);
    if (!has) await ctx.db.prepare('INSERT INTO members (household, user, role, created_at) VALUES (?, ?, ?, ?)').bind(inv.household, u.id, inv.role, now(ctx)).run();
  } else {
    if (u) throw new HttpError(409, 'This email already has Puzzle Trail. Sign in instead');
    const auto = inviter.is_admin === 1;
    u = await createUser(ctx, email, auto ? 'active' : 'pending', inviter.id);
    if (auto) await createHousehold(ctx, u.id);
    else {
      await ctx.db.prepare('INSERT INTO approvals (user, approver, created_at) VALUES (?, ?, ?)').bind(u.id, inviter.id, now(ctx)).run();
      await askApprover(ctx, u, inviter);
    }
  }
  await ctx.db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE id = ?').bind(u.id, now(ctx), inv.id).run();
  await sendSignIn(ctx, u);
  return { ok: true, pending: u.status === 'pending' };
}

/** A member creates an invite link. join: owner or co-parent, for a co-parent or viewer. family: uses one of their family invites. */
export async function createInvite(ctx: AccountsCtx, me: User, body: Record<string, unknown>) {
  const open = await ctx.db.prepare('SELECT COUNT(*) AS n FROM invites WHERE created_by = ? AND used_by IS NULL AND revoked = 0 AND expires_at > ?').bind(me.id, now(ctx)).first<{ n: number }>();
  if ((open?.n ?? 0) >= AUTH_LIMITS.openInvitesMax) throw new HttpError(429, 'Too many open invites. Cancel one first');
  const token = randomToken();
  const base = { id: await sha256Hex(token), created_by: me.id, created_at: now(ctx), expires_at: now(ctx) + AUTH_LIMITS.inviteDays * DAY };
  if (body.kind === 'join') {
    const household = typeof body.household === 'string' ? body.household : '';
    const role = body.role === 'coparent' || body.role === 'viewer' ? body.role : null;
    if (!role) throw new HttpError(400, 'Choose co-parent or viewer');
    const mine = await roleIn(ctx.db, household, me.id);
    if (mine !== 'owner' && mine !== 'coparent') throw new HttpError(403, 'Only a parent of this family can invite to it');
    await ctx.db.prepare("INSERT INTO invites (id, kind, household, role, created_by, created_at, expires_at) VALUES (?, 'join', ?, ?, ?, ?, ?)")
      .bind(base.id, household, role, me.id, base.created_at, base.expires_at).run();
  } else if (body.kind === 'family') {
    const owns = await ctx.db.prepare("SELECT 1 FROM members WHERE user = ? AND role = 'owner' LIMIT 1").bind(me.id).first();
    if (!me.is_admin && !owns) throw new HttpError(403, 'Only a family owner can invite another family');
    if (!me.is_admin && me.invites_left <= 0) throw new HttpError(403, 'No family invites left');
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO invites (id, kind, created_by, created_at, expires_at) VALUES (?, 'family', ?, ?, ?)").bind(base.id, me.id, base.created_at, base.expires_at),
      ...(me.is_admin ? [] : [ctx.db.prepare('UPDATE users SET invites_left = invites_left - 1 WHERE id = ?').bind(me.id)])
    ]);
  } else throw new HttpError(400, 'Unknown invite kind');
  return { link: `${ctx.origin}/#/invite/${token}`, expiresAt: base.expires_at };
}

/** Cancels one of my unused invites (a family invite is given back). */
export async function revokeInvite(ctx: AccountsCtx, me: User, body: Record<string, unknown>) {
  const id = typeof body.id === 'string' ? body.id : '';
  const inv = await ctx.db.prepare('SELECT * FROM invites WHERE id = ? AND created_by = ?').bind(id, me.id).first<InviteRow>();
  if (!inv || inv.used_by || inv.revoked) throw new HttpError(404, 'Invite not found');
  await ctx.db.batch([
    ctx.db.prepare('UPDATE invites SET revoked = 1 WHERE id = ?').bind(id),
    ...(inv.kind === 'family' && !me.is_admin ? [ctx.db.prepare('UPDATE users SET invites_left = invites_left + 1 WHERE id = ?').bind(me.id)] : [])
  ]);
  return { ok: true };
}

/** The owner removes a co-parent or viewer (or anyone leaves a household that isn't theirs). */
export async function removeMember(ctx: AccountsCtx, me: User, body: Record<string, unknown>) {
  const household = typeof body.household === 'string' ? body.household : '';
  const who = typeof body.user === 'string' ? body.user : '';
  const mine = await roleIn(ctx.db, household, me.id);
  const theirs = await roleIn(ctx.db, household, who);
  if (!theirs) throw new HttpError(404, 'Not a member');
  if (theirs === 'owner') throw new HttpError(403, 'The owner cannot be removed');
  if (who !== me.id && mine !== 'owner') throw new HttpError(403, 'Only the owner can remove people');
  await ctx.db.prepare('DELETE FROM members WHERE household = ? AND user = ?').bind(household, who).run();
  return { ok: true };
}

/* ---------------- approvals ---------------- */

interface ApprovalRow {
  user: string;
  approver: string;
  created_at: number;
  escalated_at: number | null;
  decided_at: number | null;
}

/** Approve or decline a waiting family. The decider is the inviter, or a super admin. */
export async function decide(ctx: AccountsCtx, decider: User, userId: string, decision: 'approved' | 'denied') {
  const a = await ctx.db.prepare('SELECT * FROM approvals WHERE user = ?').bind(userId).first<ApprovalRow>();
  if (!a) throw new HttpError(404, 'Nothing to approve');
  if (a.decided_at) return { ok: true, already: true };
  if (a.approver !== decider.id && !decider.is_admin) throw new HttpError(403, 'Not yours to decide');
  const u = (await userById(ctx.db, userId))!;
  await ctx.db.batch([
    ctx.db.prepare('UPDATE approvals SET decided_at = ?, decision = ?, decided_by = ? WHERE user = ?').bind(now(ctx), decision, decider.id, userId),
    ctx.db.prepare('UPDATE users SET status = ? WHERE id = ?').bind(decision === 'approved' ? 'active' : 'denied', userId),
    ...(decision === 'denied' ? [ctx.db.prepare('DELETE FROM sessions WHERE user = ?').bind(userId)] : [])
  ]);
  if (decision === 'approved') {
    await createHousehold(ctx, userId);
    await mail(ctx, u.email, 'approved', "You're in: Puzzle Trail", "You're approved",
      '<p>Open Puzzle Trail and sign in with this email address.</p>', 'You are approved. Open Puzzle Trail and sign in with this email address.',
      { label: 'Open Puzzle Trail', url: `${ctx.origin}/#/signin` }).catch(() => {});
  }
  return { ok: true };
}

/** POST /api/auth/approve?t=&d=approved|denied: the email link (the approver needs no session). */
export async function decideByLink(ctx: AccountsCtx, token: string, decision: string): Promise<{ ok: true; email: string; decision: string } | { error: string }> {
  if (!validToken(token) || (decision !== 'approved' && decision !== 'denied')) return { error: 'This link is not valid.' };
  const hash = await sha256Hex(token);
  const row = await ctx.db.prepare("SELECT * FROM auth_tokens WHERE hash = ? AND purpose = 'approve'").bind(hash).first<{ user: string; actor: string; expires_at: number; used_at: number | null }>();
  if (!row || row.used_at) return { error: 'This link was already used.' };
  if (row.expires_at <= now(ctx)) return { error: 'This link has expired.' };
  const decider = await userById(ctx.db, row.actor);
  if (!decider || decider.status !== 'active') return { error: 'This link is no longer valid.' };
  try {
    await decide(ctx, decider, row.user, decision);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await ctx.db.prepare('UPDATE auth_tokens SET used_at = ? WHERE hash = ?').bind(now(ctx), hash).run();
  const u = await userById(ctx.db, row.user);
  return { ok: true, email: u?.email ?? '', decision };
}

/** Hourly: approvals undecided after 72 hours go to the super admins (once). */
export async function escalate(ctx: AccountsCtx): Promise<{ escalated: number }> {
  const due = await ctx.db
    .prepare('SELECT * FROM approvals WHERE decided_at IS NULL AND escalated_at IS NULL AND created_at <= ? LIMIT 20')
    .bind(now(ctx) - AUTH_LIMITS.escalateHours * 3_600_000)
    .all<ApprovalRow>();
  const admins = (await ctx.db.prepare("SELECT * FROM users WHERE is_admin = 1 AND status = 'active'").all<User>()).results;
  let n = 0;
  for (const a of due.results) {
    const u = await userById(ctx.db, a.user);
    if (!u) continue;
    for (const admin of admins) await askApprover(ctx, u, admin).catch(() => {});
    await ctx.db.prepare('UPDATE approvals SET escalated_at = ? WHERE user = ?').bind(now(ctx), a.user).run();
    n++;
  }
  return { escalated: n };
}

/* ---------------- me, terms, admin ---------------- */

/** Everything the app needs about the signed-in person (or { signedIn: false }). */
export async function me(ctx: AccountsCtx, u: User | null, required: boolean) {
  if (!u) return { signedIn: false, required };
  const acc = acceptanceOf(u);
  const due = termsDue(acc, now(ctx));
  const base = { signedIn: true, required, email: u.email, status: u.status, admin: u.is_admin === 1, termsDue: due, daysLeft: daysLeft(acc, now(ctx)), termsUntil: due ? null : acc!.at + ACCEPT_DAYS * DAY, termsVersion: TERMS_VERSION };
  if (u.status !== 'active') return base;
  const hh = (await ctx.db.prepare('SELECT h.id, m.role FROM members m JOIN households h ON h.id = m.household WHERE m.user = ? ORDER BY m.created_at').bind(u.id).all<{ id: string; role: Role }>()).results;
  const households = [];
  for (const h of hh) {
    const members = (await ctx.db.prepare("SELECT u.id, u.email, m.role FROM members m JOIN users u ON u.id = m.user WHERE m.household = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'coparent' THEN 1 ELSE 2 END, m.created_at").bind(h.id).all<{ id: string; email: string; role: Role }>()).results;
    households.push({ id: h.id, role: h.role, members: members.map((m) => ({ ...m, me: m.id === u.id })) });
  }
  const invites = (await ctx.db
    .prepare('SELECT id, kind, role, created_at, expires_at FROM invites WHERE created_by = ? AND used_by IS NULL AND revoked = 0 AND expires_at > ? ORDER BY created_at DESC')
    .bind(u.id, now(ctx))
    .all<{ id: string; kind: string; role: string | null; created_at: number; expires_at: number }>()).results;
  const waiting = (await ctx.db
    .prepare('SELECT a.user, u.email, a.created_at FROM approvals a JOIN users u ON u.id = a.user WHERE a.decided_at IS NULL AND (a.approver = ? OR ? = 1) ORDER BY a.created_at')
    .bind(u.id, u.is_admin)
    .all<{ user: string; email: string; created_at: number }>()).results;
  // limited access: only family owners (and super admins) invite new families
  const canInviteFamilies = u.is_admin === 1 || households.some((h) => h.role === 'owner');
  return { ...base, canInviteFamilies, invitesLeft: u.is_admin ? null : u.invites_left, households, invites, waiting };
}

export async function acceptTerms(ctx: AccountsCtx, u: User | null, body: Record<string, unknown>) {
  if (!u) throw new HttpError(401, 'Please sign in');
  if (body.version !== TERMS_VERSION) throw new HttpError(409, 'The terms have changed. Please read them again');
  await ctx.db.prepare('UPDATE users SET terms_version = ?, terms_at = ? WHERE id = ?').bind(TERMS_VERSION, now(ctx), u.id).run();
  return { ok: true, daysLeft: daysLeft({ version: TERMS_VERSION, at: now(ctx) }, now(ctx)) };
}

const requireAdmin = (u: User) => {
  if (!u.is_admin) throw new HttpError(403, 'Super admin only');
  return u;
};

/** Super admin: counts and the people waiting (no answers or progress). */
export async function adminOverview(ctx: AccountsCtx, u: User) {
  requireAdmin(u);
  const counts = (await ctx.db.prepare('SELECT status, COUNT(*) AS n FROM users GROUP BY status').all<{ status: string; n: number }>()).results;
  const recent = (await ctx.db
    .prepare('SELECT u.id, u.email, u.status, u.created_at, u.last_seen, i.email AS invited_by FROM users u LEFT JOIN users i ON i.id = u.invited_by ORDER BY u.created_at DESC LIMIT 50')
    .all<Record<string, unknown>>()).results;
  return { counts: Object.fromEntries(counts.map((c) => [c.status, c.n])), users: recent };
}

/** Super admin: suspend a person, and with branch everyone they invited (recursively); sessions end at once. */
export async function suspend(ctx: AccountsCtx, u: User, body: Record<string, unknown>) {
  requireAdmin(u);
  const root = typeof body.user === 'string' ? body.user : '';
  const target = await userById(ctx.db, root);
  if (!target) throw new HttpError(404, 'Not found');
  if (target.is_admin) throw new HttpError(403, 'A super admin cannot be suspended here');
  const ids = [root];
  if (body.branch === true) {
    for (let i = 0; i < ids.length && ids.length < 500; i++) {
      const kids = (await ctx.db.prepare('SELECT id FROM users WHERE invited_by = ? AND is_admin = 0').bind(ids[i]).all<{ id: string }>()).results;
      for (const k of kids) if (!ids.includes(k.id)) ids.push(k.id);
    }
  }
  const status = body.restore === true ? 'active' : 'suspended';
  await ctx.db.batch(ids.flatMap((id) => [
    ctx.db.prepare("UPDATE users SET status = ? WHERE id = ? AND status IN ('active', 'suspended')").bind(status, id),
    ...(status === 'suspended' ? [ctx.db.prepare('DELETE FROM sessions WHERE user = ?').bind(id)] : [])
  ]));
  return { ok: true, count: ids.length };
}

/* ---------------- the parent dashboard through an account ---------------- */

/** On sync from a signed-in owner or co-parent: remember which synced device belongs to their household. */
export async function linkFamily(ctx: AccountsCtx, u: User, familyKey: string) {
  const h = await ctx.db.prepare("SELECT household FROM members WHERE user = ? AND role IN ('owner', 'coparent') ORDER BY created_at LIMIT 1").bind(u.id).first<{ household: string }>();
  if (h) await ctx.db.prepare('UPDATE households SET family_key = ? WHERE id = ? AND (family_key IS NULL OR family_key <> ?)').bind(familyKey, h.household, familyKey).run();
}

/** The synced family a member may see (any role, viewers included), or null. */
export async function familyKeyFor(ctx: AccountsCtx, u: User, household?: string): Promise<string | null> {
  const r = await ctx.db
    .prepare('SELECT h.family_key FROM members m JOIN households h ON h.id = m.household WHERE m.user = ? AND h.family_key IS NOT NULL AND (? IS NULL OR h.id = ?) ORDER BY m.created_at LIMIT 1')
    .bind(u.id, household ?? null, household ?? null)
    .first<{ family_key: string }>();
  return r?.family_key ?? null;
}

/* ---------------- onboarding by email (super admin, from CI) ---------------- */

/**
 * The super admin invites new families by email (Actions → Invite, bearer CRON_SECRET): each address without an account
 * gets its own family invite link (approved on accept, as all super admin invites are). Existing members are skipped.
 */
export async function inviteByEmail(ctx: AccountsCtx, emails: unknown): Promise<{ invited: number; already: number; invalid: number }> {
  const list = (Array.isArray(emails) ? emails : String(emails ?? '').split(/[\s,;]+/)).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  if (list.length > 50) throw new HttpError(400, 'At most 50 at a time');
  const adminEmail = ctx.admins[0];
  if (!adminEmail) throw new HttpError(503, 'No super admin');
  let admin = await userByEmail(ctx.db, adminEmail);
  if (!admin) {
    admin = await createUser(ctx, adminEmail, 'active', null);
    await createHousehold(ctx, admin.id);
  }
  const out = { invited: 0, already: 0, invalid: 0 };
  for (const email of [...new Set(list)]) {
    if (!EMAIL_RE.test(email) || email.length > 254) { out.invalid++; continue; }
    // members, and super admins (who sign in without an invite), are skipped
    if (ctx.admins.includes(email) || (await userByEmail(ctx.db, email))) { out.already++; continue; }
    const { link } = await createInvite(ctx, admin, { kind: 'family' });
    await mail(ctx, email, 'invite', "You're invited to Puzzle Trail", 'You’re invited to Puzzle Trail',
      `<p>Puzzle Trail is a private, invite-only puzzle game for kids, with tough number and thinking puzzles.</p>
<p>Tap the button, enter this email address, and you'll get a sign-in link. The invite is for your family only and works once, for ${AUTH_LIMITS.inviteDays} days.</p>`,
      `Puzzle Trail is a private, invite-only puzzle game for kids. Open the link, enter this email address, and you'll get a sign-in link. The invite is for your family only and works once, for ${AUTH_LIMITS.inviteDays} days.`,
      { label: 'Accept the invite', url: link });
    out.invited++;
  }
  return out;
}
