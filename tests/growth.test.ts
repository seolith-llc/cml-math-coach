import { describe, expect, it, vi } from 'vitest';
import { makeDb } from './parent-server.test';
import { FREE_LIMITS, PAUSE_AT, RESUME_AT, decide, getCapacity, setCapacity } from '../server/capacity';
import { AUTH_LIMITS, acceptInvite, completeSignIn, createInvite, growInvites, inviteByEmail, me, parseAdmins, requestSignIn, sessionUser, acceptTerms, type AccountsCtx, type User } from '../server/accounts';
import { onRequestGet as tts } from '../functions/api/tts';
import { TERMS_VERSION } from '../src/content/legal';
import type { Mailer } from '../server/email';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 20, 12);

function world(now = T0) {
  const db = makeDb();
  const sent: { to: string; text: string }[] = [];
  const mailer: Mailer = async (m) => { sent.push({ to: m.to, text: m.text }); return 'id'; };
  const ctx = (t = now): AccountsCtx => ({ db, mailer, origin: 'https://x.example', admins: parseAdmins(''), now: t });
  return { db, sent, ctx };
}

async function admin(w: ReturnType<typeof world>) {
  await requestSignIn(w.ctx(), { email: parseAdmins('')[0] });
  const t = new URL(w.sent[w.sent.length - 1].text.match(/https:\/\/\S+/)![0]).searchParams.get('t')!;
  const r = await completeSignIn(w.ctx(), t);
  const cookie = ('cookie' in r ? r.cookie : '').split(';')[0];
  const u = (await sessionUser(w.ctx(), new Request('https://x.example/', { headers: { cookie } })))!;
  await acceptTerms(w.ctx(), u, { version: TERMS_VERSION });
  return (await w.db.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first<User>())!;
}

describe('capacity guard (step085)', () => {
  it('pauses above 80% of any free limit and resumes only under 60%', () => {
    expect(decide({ requests: 70_000 }, false)).toMatchObject({ paused: false, worst: { key: 'requests', share: 0.7 } });
    expect(decide({ requests: 10, rowsWritten: 85_000 }, false)).toMatchObject({ paused: true, worst: { key: 'rowsWritten' } });
    expect(decide({ rowsWritten: 70_000 }, true).paused).toBe(true); // between 60% and 80%: stays paused
    expect(decide({ rowsWritten: 59_000 }, true).paused).toBe(false);
    expect(decide({}, true)).toEqual({ paused: true, worst: null }); // no numbers: no change
    expect(PAUSE_AT).toBeGreaterThan(RESUME_AT);
    expect(decide({ neurons: 9_000 }, false, { ...FREE_LIMITS, neurons: 100_000 }).paused).toBe(false); // a paid plan
  });

  it('stores the decision; while paused, new families wait but family members can still join', async () => {
    const w = world();
    const boss = await admin(w);
    expect((await getCapacity(w.db)).paused).toBe(false);
    const hh = ((await me(w.ctx(), boss, false)) as { households: { id: string }[] }).households[0].id;
    const fam = await createInvite(w.ctx(), boss, { kind: 'family' });
    const join = await createInvite(w.ctx(), boss, { kind: 'join', household: hh, role: 'viewer' });
    const c = await setCapacity(w.db, { usage: { requests: 95_000, rowsRead: 'x' } });
    expect(c).toMatchObject({ paused: true, worst: { key: 'requests' }, usage: { requests: 95_000 } });
    expect(((await me(w.ctx(), boss, false)) as { familiesPaused: boolean }).familiesPaused).toBe(true);
    await expect(createInvite(w.ctx(), boss, { kind: 'family' })).rejects.toThrow(/paused/);
    await expect(acceptInvite(w.ctx(), { token: fam.link.split('/#/invite/')[1], email: 'new@example.com' })).rejects.toThrow(/paused/);
    await expect(inviteByEmail(w.ctx(), 'new@example.com')).rejects.toThrow(/paused/);
    expect(await acceptInvite(w.ctx(), { token: join.link.split('/#/invite/')[1], email: 'gran@example.com' })).toEqual({ ok: true, pending: false });
    await setCapacity(w.db, { usage: { requests: 10_000 } });
    expect((await getCapacity(w.db)).paused).toBe(false);
  });

  it('no new natural-voice clips while paused (the app uses the device voice)', async () => {
    const w = world();
    await setCapacity(w.db, { usage: { neurons: 9_500 } });
    const run = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const res = await tts({ request: new Request('https://x.example/api/tts?v=luna&t=hello', { headers: { 'sec-fetch-site': 'same-origin' } }), env: { AI: { run }, DB: w.db } });
    expect(res.status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('invites grow with practice (step085)', () => {
  async function owner(w: ReturnType<typeof world>) {
    const boss = await admin(w);
    const { link } = await createInvite(w.ctx(), boss, { kind: 'family' });
    await acceptInvite(w.ctx(), { token: link.split('/#/invite/')[1], email: 'parent@example.com' });
    const u = (await w.db.prepare("SELECT * FROM users WHERE email = 'parent@example.com'").first<User>())!;
    const hh = (await w.db.prepare('SELECT household FROM members WHERE user = ?').bind(u.id).first<{ household: string }>())!.household;
    await w.db.prepare("UPDATE households SET family_key = 'fk' WHERE id = ?").bind(hh).run();
    await w.db.prepare("INSERT INTO families (key, pin_salt, pin_hash, created_at) VALUES ('fk', 's', 'h', 1)").run();
    return u;
  }
  const practise = (w: ReturnType<typeof world>, days: number[], base: number) =>
    Promise.all(days.map((d, i) => w.db.prepare("INSERT INTO attempts (family, ts, problem_id, topic, grade, level, correct, first_try, skipped, hints, seconds, mode) VALUES ('fk', ?, ?, 'coins', 2, 1, 1, 1, 0, 0, 10, 'practice')").bind(base - d * DAY, `coins:2:1:${i}`).run()));

  it('one more family invite for a week with 3+ practice days, at most once a week, up to 10', async () => {
    const w = world();
    const u = await owner(w);
    const later = T0 + 8 * DAY;
    await practise(w, [0, 1], later);
    expect(await growInvites(w.ctx(later))).toEqual({ granted: 0 }); // 2 days is not enough
    await practise(w, [3], later);
    expect(await growInvites(w.ctx(later))).toEqual({ granted: 1 });
    expect(await growInvites(w.ctx(later + 3_600_000))).toEqual({ granted: 0 }); // once a week
    const left = async () => (await w.db.prepare('SELECT invites_left FROM users WHERE id = ?').bind(u.id).first<{ invites_left: number }>())!.invites_left;
    expect(await left()).toBe(AUTH_LIMITS.familyInvitesStart + 1);
    await w.db.prepare('UPDATE users SET invites_left = ?, invites_granted_at = NULL WHERE id = ?').bind(AUTH_LIMITS.familyInvitesMax, u.id).run();
    expect(await growInvites(w.ctx(later + 8 * DAY))).toEqual({ granted: 0 }); // already at the cap
  });

  it('nobody new gets extra invites in their first week', async () => {
    const w = world();
    await owner(w);
    await practise(w, [0, 1, 2, 3], T0);
    expect(await growInvites(w.ctx(T0))).toEqual({ granted: 0 });
  });
});
