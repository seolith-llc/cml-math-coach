import { describe, expect, it } from 'vitest';
import { makeDb } from './parent-server.test';
import {
  AUTH_LIMITS, acceptInvite, acceptTerms, adminOverview, completeSignIn, completeSignInCode, createInvite, decide, decideByLink, escalate, familyKeyFor,
  inviteInfo, linkFamily, me, parseAdmins, SUPER_ADMINS, removeMember, requestSignIn, requireMember, revokeInvite, sessionUser, signOut, suspend,
  type AccountsCtx, type User
} from '../server/accounts';
import { TERMS_VERSION } from '../src/content/legal';
import type { Mailer } from '../server/email';

const ORIGIN = 'https://app.example';
const ADMIN = 'owner@example.com';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 18, 12);

function setup() {
  const sent: { to: string; subject: string; text: string }[] = [];
  const mailer: Mailer = async (m) => {
    sent.push({ to: m.to, subject: m.subject, text: m.text });
    return 'msg-' + sent.length;
  };
  const db = makeDb();
  const ctx = (now = T0): AccountsCtx => ({ db, mailer, origin: ORIGIN, admins: parseAdmins(ADMIN + ', not-an-email'), now });
  const linkTo = (to: string, path: string) => {
    const m = [...sent].reverse().find((x) => x.to === to && x.text.includes(path));
    return m ? new URL(m.text.match(/https:\/\/app\.example\S+/)![0]).searchParams.get('t')! : null;
  };
  /** Signs in by email link; returns a request carrying the session cookie. */
  async function signIn(email: string, now = T0) {
    await requestSignIn(ctx(now), { email });
    const t = linkTo(email, '/api/auth/signin');
    expect(t).toBeTruthy();
    const r = await completeSignIn(ctx(now), t!);
    if ('error' in r) throw new Error(r.error);
    const cookie = r.cookie.split(';')[0];
    return new Request(ORIGIN + '/api/auth', { headers: { cookie } });
  }
  const userOf = async (req: Request, now = T0) => (await sessionUser(ctx(now), req))!;
  const accepted = async (req: Request, now = T0) => {
    await acceptTerms(ctx(now), await userOf(req, now), { version: TERMS_VERSION });
    return requireMember(await userOf(req, now), now);
  };
  const inviteToken = (link: string) => link.split('/#/invite/')[1];
  return { db, sent, ctx, signIn, userOf, accepted, linkTo, inviteToken };
}

describe('accounts: sign-in by email link (step078)', () => {
  it('a super admin signs in without an invite and gets a household', async () => {
    const s = setup();
    const req = await s.signIn(ADMIN);
    const u = await s.userOf(req);
    expect(u).toMatchObject({ email: ADMIN, status: 'active', is_admin: 1 });
    const m = await me(s.ctx(), u, false);
    expect(m).toMatchObject({ signedIn: true, admin: true, termsDue: true });
    expect((m as { households: unknown[] }).households).toHaveLength(1);
  });

  it('gives strangers the same answer and sends them nothing', async () => {
    const s = setup();
    expect(await requestSignIn(s.ctx(), { email: 'stranger@example.com' })).toEqual({ ok: true });
    expect(s.sent).toHaveLength(0);
    await expect(requestSignIn(s.ctx(), { email: 'not an email' })).rejects.toThrow(/valid email/);
  });

  it('a link works once, for 15 minutes, and sign-in emails are capped per hour', async () => {
    const s = setup();
    await requestSignIn(s.ctx(), { email: ADMIN });
    const t = s.linkTo(ADMIN, '/api/auth/signin')!;
    expect('cookie' in (await completeSignIn(s.ctx(T0 + 5 * 60_000), t))).toBe(true);
    expect(await completeSignIn(s.ctx(T0 + 6 * 60_000), t)).toEqual({ error: expect.stringMatching(/already used/) });
    await requestSignIn(s.ctx(), { email: ADMIN });
    const late = s.linkTo(ADMIN, '/api/auth/signin')!;
    expect(await completeSignIn(s.ctx(T0 + 16 * 60_000), late)).toEqual({ error: expect.stringMatching(/expired/) });
    for (let i = 0; i < 10; i++) await requestSignIn(s.ctx(), { email: ADMIN });
    expect(s.sent.filter((m) => m.to === ADMIN)).toHaveLength(AUTH_LIMITS.signinPerHour);
  });

  it('every email carries the disclaimer', async () => {
    const s = setup();
    await requestSignIn(s.ctx(), { email: ADMIN });
    expect(s.sent[0].text).toContain('not affiliated with or endorsed by');
  });

  it('signing out ends the session', async () => {
    const s = setup();
    const req = await s.signIn(ADMIN);
    await signOut(s.ctx(), req);
    expect(await sessionUser(s.ctx(), req)).toBeNull();
  });
});

describe('accounts: built-in super admins (step079)', () => {
  it('are always admins, alongside ADMIN_EMAILS', () => {
    expect(parseAdmins(undefined)).toEqual([...SUPER_ADMINS]);
    expect(parseAdmins('extra@example.com')).toEqual([...SUPER_ADMINS, 'extra@example.com']);
    expect(SUPER_ADMINS).toHaveLength(2);
  });
  it('can sign in with no ADMIN_EMAILS set', async () => {
    const s = setup();
    const ctx = { ...s.ctx(), admins: parseAdmins('') };
    await requestSignIn(ctx, { email: SUPER_ADMINS[0] });
    const u = (await s.db.prepare('SELECT * FROM users WHERE email = ?').bind(SUPER_ADMINS[0]).first<User>())!;
    expect(u).toMatchObject({ status: 'active', is_admin: 1 });
  });
  it('an existing ordinary account becomes super admin on the next sign-in request', async () => {
    const s = setup();
    await s.db.prepare("INSERT INTO users (id, email, status, is_admin, invites_left, created_at) VALUES ('x1', ?, 'active', 0, 3, 1)").bind(SUPER_ADMINS[1]).run();
    await requestSignIn(s.ctx(), { email: SUPER_ADMINS[1] });
    const u = (await s.db.prepare('SELECT * FROM users WHERE id = ?').bind('x1').first<User>())!;
    expect(u.is_admin).toBe(1);
  });
});

describe('accounts: the 6-digit code in the sign-in email (Home Screen app)', () => {
  const codeOf = (s: ReturnType<typeof setup>, to: string) => [...s.sent].reverse().find((m) => m.to === to)!.subject.match(/(\d{6})$/)![1];
  it('signs in with the code once; the link stops working too', async () => {
    const s = setup();
    await requestSignIn(s.ctx(), { email: ADMIN });
    const code = codeOf(s, ADMIN);
    expect(s.sent[0].text).toContain(code);
    const r = await completeSignInCode(s.ctx(), { email: ADMIN.toUpperCase(), code });
    expect(r.cookie).toMatch(/^pt_session=/);
    await expect(completeSignInCode(s.ctx(), { email: ADMIN, code })).rejects.toThrow(/didn't work/);
    expect(await completeSignIn(s.ctx(), s.linkTo(ADMIN, '/api/auth/signin')!)).toEqual({ error: expect.stringMatching(/already used/) });
  });
  it('allows 5 wrong tries, then the code is dead; strangers get the same answer', async () => {
    const s = setup();
    await requestSignIn(s.ctx(), { email: ADMIN });
    const code = codeOf(s, ADMIN);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(completeSignInCode(s.ctx(), { email: ADMIN, code: wrong })).rejects.toThrow(/didn't work/);
    await expect(completeSignInCode(s.ctx(), { email: ADMIN, code })).rejects.toThrow(/didn't work/);
    await expect(completeSignInCode(s.ctx(), { email: 'stranger@example.com', code: '123456' })).rejects.toThrow(/didn't work/);
  });
  it('expires after 15 minutes, and using the link kills the code', async () => {
    const s = setup();
    await requestSignIn(s.ctx(), { email: ADMIN });
    await expect(completeSignInCode(s.ctx(T0 + 16 * 60_000), { email: ADMIN, code: codeOf(s, ADMIN) })).rejects.toThrow(/didn't work/);
    await requestSignIn(s.ctx(), { email: ADMIN });
    const code = codeOf(s, ADMIN);
    await completeSignIn(s.ctx(), s.linkTo(ADMIN, '/api/auth/signin')!);
    await expect(completeSignInCode(s.ctx(), { email: ADMIN, code })).rejects.toThrow(/didn't work/);
  });
});

describe('accounts: terms every 30 days', () => {
  it('a member must accept the current terms, and again after 30 days', async () => {
    const s = setup();
    const req = await s.signIn(ADMIN);
    expect(() => requireMember(null, T0)).toThrow(/sign in/);
    let u = await s.userOf(req);
    expect(() => requireMember(u, T0)).toThrow(/accept the terms/);
    await expect(acceptTerms(s.ctx(), u, { version: '1999-01-01' })).rejects.toThrow(/changed/);
    await acceptTerms(s.ctx(), u, { version: TERMS_VERSION });
    u = await s.userOf(req, T0 + 29 * DAY);
    expect(requireMember(u, T0 + 29 * DAY).id).toBe(u.id);
    u = await s.userOf(req, T0 + 31 * DAY);
    expect(() => requireMember(u, T0 + 31 * DAY)).toThrow(/accept the terms/);
  });
});

describe('accounts: invites and approvals', () => {
  async function withParent() {
    const s = setup();
    const adminReq = await s.signIn(ADMIN);
    const admin = await s.accepted(adminReq);
    // the super admin invites a first family: approved on accept
    const { link } = await createInvite(s.ctx(), admin, { kind: 'family' });
    expect(await inviteInfo(s.ctx(), { token: s.inviteToken(link) })).toEqual({ kind: 'family', role: null });
    expect(await acceptInvite(s.ctx(), { token: s.inviteToken(link), email: 'parent@example.com' })).toEqual({ ok: true, pending: false });
    const parentReq = await s.signIn('parent@example.com');
    const parent = await s.accepted(parentReq);
    return { s, admin, adminReq, parent, parentReq };
  }

  it('a family invited by a parent waits for that parent to approve', async () => {
    const { s, parent } = await withParent();
    const { link } = await createInvite(s.ctx(), parent, { kind: 'family' });
    const r = await acceptInvite(s.ctx(), { token: s.inviteToken(link), email: 'friend@example.com' });
    expect(r).toEqual({ ok: true, pending: true });
    // the friend can sign in but only sees "waiting"
    const friendReq = await s.signIn('friend@example.com');
    const friend = await s.userOf(friendReq);
    expect(friend.status).toBe('pending');
    expect(() => requireMember(friend, T0)).toThrow(/Waiting for approval/);
    // the inviter gets an approve link; Approve makes the friend active with their own household
    const t = s.linkTo('parent@example.com', '/api/auth/approve')!;
    expect(await decideByLink(s.ctx(), t, 'approved')).toMatchObject({ ok: true, decision: 'approved' });
    expect(await decideByLink(s.ctx(), t, 'approved')).toEqual({ error: expect.stringMatching(/already used/) });
    const after = await s.userOf(friendReq);
    expect(after.status).toBe('active');
    expect(((await me(s.ctx(), after, false)) as { households: { role: string }[] }).households[0].role).toBe('owner');
    expect(s.sent.some((m) => m.to === 'friend@example.com' && /You're in/.test(m.subject))).toBe(true);
  });

  it('a declined family is shut out', async () => {
    const { s, parent } = await withParent();
    const { link } = await createInvite(s.ctx(), parent, { kind: 'family' });
    await acceptInvite(s.ctx(), { token: s.inviteToken(link), email: 'nope@example.com' });
    const req = await s.signIn('nope@example.com');
    const pending = await s.userOf(req);
    await decide(s.ctx(), parent, pending.id, 'denied');
    expect(await sessionUser(s.ctx(), req)).toBeNull();
    s.sent.length = 0;
    await requestSignIn(s.ctx(), { email: 'nope@example.com' });
    expect(s.sent).toHaveLength(0);
  });

  it('after 72 hours undecided, the super admin is asked (once)', async () => {
    const { s, parent } = await withParent();
    const { link } = await createInvite(s.ctx(), parent, { kind: 'family' });
    await acceptInvite(s.ctx(), { token: s.inviteToken(link), email: 'late@example.com' });
    expect(await escalate(s.ctx(T0 + 71 * 3_600_000))).toEqual({ escalated: 0 });
    expect(await escalate(s.ctx(T0 + 73 * 3_600_000))).toEqual({ escalated: 1 });
    expect(await escalate(s.ctx(T0 + 74 * 3_600_000))).toEqual({ escalated: 0 });
    const t = s.linkTo(ADMIN, '/api/auth/approve')!;
    expect(await decideByLink(s.ctx(T0 + 75 * 3_600_000), t, 'approved')).toMatchObject({ ok: true });
  });

  it('family invites are limited (3 to start), and cancelling one gives it back', async () => {
    const { s, parent } = await withParent();
    const links = [];
    for (let i = 0; i < 3; i++) links.push((await createInvite(s.ctx(), parent, { kind: 'family' })).link);
    const fresh = (await s.db.prepare('SELECT * FROM users WHERE id = ?').bind(parent.id).first<User>())!;
    expect(fresh.invites_left).toBe(0);
    await expect(createInvite(s.ctx(), fresh, { kind: 'family' })).rejects.toThrow(/No family invites left/);
    const m = (await me(s.ctx(), fresh, false)) as { invites: { id: string }[] };
    expect(m.invites).toHaveLength(3);
    await revokeInvite(s.ctx(), fresh, { id: m.invites[0].id });
    const back = (await s.db.prepare('SELECT * FROM users WHERE id = ?').bind(parent.id).first<User>())!;
    expect(back.invites_left).toBe(1);
  });

  it('an invite link is single use and expires after 14 days', async () => {
    const { s, parent } = await withParent();
    const a = await createInvite(s.ctx(), parent, { kind: 'family' });
    await acceptInvite(s.ctx(), { token: s.inviteToken(a.link), email: 'one@example.com' });
    await expect(acceptInvite(s.ctx(), { token: s.inviteToken(a.link), email: 'two@example.com' })).rejects.toThrow(/already used/);
    const b = await createInvite(s.ctx(), parent, { kind: 'family' });
    await expect(inviteInfo(s.ctx(T0 + 15 * DAY), { token: s.inviteToken(b.link) })).rejects.toThrow(/expired/);
    await expect(inviteInfo(s.ctx(), { token: 'x'.repeat(30) })).rejects.toThrow(/not valid/);
  });

  it('a viewer joins at once with limited access; only the owner manages people', async () => {
    const { s, parent } = await withParent();
    const hh = ((await me(s.ctx(), parent, false)) as { households: { id: string }[] }).households[0].id;
    const { link } = await createInvite(s.ctx(), parent, { kind: 'join', household: hh, role: 'viewer' });
    expect(await inviteInfo(s.ctx(), { token: s.inviteToken(link) })).toEqual({ kind: 'join', role: 'viewer' });
    expect(await acceptInvite(s.ctx(), { token: s.inviteToken(link), email: 'grandma@example.com' })).toEqual({ ok: true, pending: false });
    const gReq = await s.signIn('grandma@example.com');
    const grandma = await s.accepted(gReq);
    const gm = (await me(s.ctx(), grandma, false)) as { households: { id: string; role: string; members: { email: string }[] }[] };
    expect(gm.households[0]).toMatchObject({ id: hh, role: 'viewer' });
    expect(gm.households[0].members.map((m) => m.email)).toEqual(['parent@example.com', 'grandma@example.com']);
    // a viewer can't invite to the family or remove anyone
    await expect(createInvite(s.ctx(), grandma, { kind: 'join', household: hh, role: 'viewer' })).rejects.toThrow(/Only a parent/);
    await expect(removeMember(s.ctx(), grandma, { household: hh, user: parent.id })).rejects.toThrow(/owner cannot be removed/);
    await expect(createInvite(s.ctx(), grandma, { kind: 'family' })).rejects.toThrow(/Only a family owner/);
    expect(gm).toMatchObject({ canInviteFamilies: false });
    // the viewer sees the dashboard of the family's synced device, once a parent's device links it
    expect(await familyKeyFor(s.ctx(), grandma)).toBeNull();
    await linkFamily(s.ctx(), parent, 'family-key-1');
    expect(await familyKeyFor(s.ctx(), grandma)).toBe('family-key-1');
    // the owner can remove the viewer
    await removeMember(s.ctx(), parent, { household: hh, user: grandma.id });
    expect(await familyKeyFor(s.ctx(), grandma)).toBeNull();
  });

  it('a co-parent can invite a viewer, and an existing member joins without a new account', async () => {
    const { s, parent } = await withParent();
    const hh = ((await me(s.ctx(), parent, false)) as { households: { id: string }[] }).households[0].id;
    const { link } = await createInvite(s.ctx(), parent, { kind: 'join', household: hh, role: 'coparent' });
    await acceptInvite(s.ctx(), { token: s.inviteToken(link), email: 'partner@example.com' });
    const partner = await s.accepted(await s.signIn('partner@example.com'));
    const v = await createInvite(s.ctx(), partner, { kind: 'join', household: hh, role: 'viewer' });
    await acceptInvite(s.ctx(), { token: s.inviteToken(v.link), email: ADMIN });
    const admin = (await s.db.prepare('SELECT * FROM users WHERE email = ?').bind(ADMIN).first<User>())!;
    const am = (await me(s.ctx(), admin, false)) as { households: { role: string }[] };
    expect(am.households.map((x) => x.role)).toEqual(['owner', 'viewer']); // their own family, plus viewer of this one
    await expect(createInvite(s.ctx(), partner, { kind: 'family' })).rejects.toThrow(/Only a family owner/); // a co-parent has limited access too
    await expect(acceptInvite(s.ctx(), { token: s.inviteToken((await createInvite(s.ctx(), parent, { kind: 'family' })).link), email: ADMIN })).rejects.toThrow(/already has Puzzle Trail/);
  });

  it('the super admin can suspend a person and everyone they invited, and restore them', async () => {
    const { s, admin, parent, parentReq } = await withParent();
    const { link } = await createInvite(s.ctx(), parent, { kind: 'family' });
    await acceptInvite(s.ctx(), { token: s.inviteToken(link), email: 'child-branch@example.com' });
    const kid = (await s.db.prepare('SELECT * FROM users WHERE email = ?').bind('child-branch@example.com').first<User>())!;
    await decide(s.ctx(), parent, kid.id, 'approved');
    await expect(suspend(s.ctx(), parent, { user: kid.id })).rejects.toThrow(/Super admin only/);
    expect(await suspend(s.ctx(), admin, { user: parent.id, branch: true })).toEqual({ ok: true, count: 2 });
    expect(await sessionUser(s.ctx(), parentReq)).toBeNull();
    const ov = await adminOverview(s.ctx(), admin);
    expect(ov.counts).toMatchObject({ suspended: 2, active: 1 });
    await suspend(s.ctx(), admin, { user: parent.id, branch: true, restore: true });
    expect((await adminOverview(s.ctx(), admin)).counts).toMatchObject({ active: 3 });
    await expect(suspend(s.ctx(), admin, { user: admin.id })).rejects.toThrow(/cannot be suspended/);
  });
});
