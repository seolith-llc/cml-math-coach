import { describe, expect, it } from 'vitest';
import { makeDb } from './parent-server.test';
import { FEEDBACK, feedbackEmail, parseFeedback, submitFeedback } from '../server/userFeedback';
import { HttpError } from '../server/parent';
import { onRequestPost as feedbackRoute } from '../functions/api/feedback';

const base = { kind: 'problem', message: 'The answer to this one should be 12, not 13.', route: '#/practice', problemId: 'calendar:2:3:41', grade: 2, device: 'Mozilla/5.0 (iPad)', deviceId: 'dev_ABCDEFGH12' };
const status = (fn: () => unknown) => {
  try { fn(); return 0; } catch (e) { return e instanceof HttpError ? e.status : -1; }
};

describe('feedback: checking what comes in', () => {
  it('keeps a valid message and its context', () => {
    const f = parseFeedback({ ...base, message: '  two\r\nlines  ' });
    expect(f).toMatchObject({ kind: 'problem', message: 'two\nlines', route: '#/practice', problemId: 'calendar:2:3:41', grade: 2 });
  });
  it('refuses a missing kind, an empty or huge message, and a missing device id', () => {
    expect(status(() => parseFeedback({ ...base, kind: 'bug' }))).toBe(400);
    expect(status(() => parseFeedback({ ...base, message: ' a ' }))).toBe(400);
    expect(status(() => parseFeedback({ ...base, message: 'x'.repeat(FEEDBACK.maxMessage + 1) }))).toBe(400);
    expect(status(() => parseFeedback({ ...base, deviceId: 'x' }))).toBe(400);
  });
  it('keeps problem ids with full 32-bit seeds (up to 10 digits)', () => {
    expect(parseFeedback({ ...base, problemId: 'missing-number:3:12:4294967295' }).problemId).toBe('missing-number:3:12:4294967295');
  });
  it('drops context it does not trust instead of storing it', () => {
    const f = parseFeedback({ ...base, route: 'javascript:alert(1)', problemId: '../../etc', grade: 9, device: 'evil\u0000‮' + 'a'.repeat(400) });
    expect(f.route).toBe('');
    expect(f.problemId).toBeNull();
    expect(f.grade).toBeNull();
    expect(f.device).toMatch(/^evila+$/);
    expect(f.device.length).toBe(200);
  });
});

describe('feedback: saving, limits and the owner email', () => {
  it('saves the message as new, and emails the owner', async () => {
    const db = makeDb();
    const sent: { to: string; subject: string; text: string }[] = [];
    const r = await submitFeedback(db, base, { now: 1_000, mailer: async (m) => { sent.push(m); return 'msg-1'; }, to: 'owner@example.com' });
    expect(r).toMatchObject({ ok: true, emailed: true });
    expect(r.id).toMatch(/^fb_[A-Za-z0-9_-]{12}$/);
    const row = await db.prepare('SELECT * FROM user_feedback WHERE id = ?').bind(r.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ kind: 'problem', status: 'new', problem_id: 'calendar:2:3:41', grade: 2, note: '' });
    expect(sent[0].to).toBe('owner@example.com');
    expect(sent[0].subject).toBe('Math Coach problem: The answer to this one should be 12, not 13.');
    expect(sent[0].text).toContain('problem calendar:2:3:41');
  });
  it('still saves when the email fails, and says so', async () => {
    const db = makeDb();
    const r = await submitFeedback(db, base, { mailer: async () => { throw new Error('SES down'); }, to: 'owner@example.com' });
    expect(r).toMatchObject({ ok: true, emailed: false });
    expect((await db.prepare('SELECT COUNT(*) AS n FROM user_feedback').first<{ n: number }>())?.n).toBe(1);
  });
  it('limits one device per hour, and the whole app per day', async () => {
    const db = makeDb();
    for (let i = 0; i < FEEDBACK.perDevicePerHour; i++) await submitFeedback(db, base, { now: 10_000 + i });
    await expect(submitFeedback(db, base, { now: 20_000 })).rejects.toMatchObject({ status: 429 });
    await expect(submitFeedback(db, base, { now: 10_000 + 3_600_001 })).resolves.toMatchObject({ ok: true }); // an hour later
    await expect(submitFeedback(db, { ...base, deviceId: 'other_device_1' }, { now: 20_000 })).resolves.toMatchObject({ ok: true });
    for (let i = 0; i < FEEDBACK.perDay; i++) await db.prepare("INSERT INTO user_feedback (id, ts, kind, message, device_id, updated_at) VALUES (?, ?, 'idea', 'x x x', ?, 0)").bind(`fb_fill${i}`, 50_000, `d${i}`).run();
    await expect(submitFeedback(db, { ...base, deviceId: 'fresh_device_9' }, { now: 60_000 })).rejects.toMatchObject({ status: 429 });
  });
  it('escapes the message in the HTML email', () => {
    const e = feedbackEmail({ id: 'fb_x', ts: 0, kind: 'idea', message: '<b>more</b> stars & badges', route: '', problemId: null, grade: null, device: '' });
    expect(e.html).toContain('&lt;b&gt;more&lt;/b&gt; stars &amp; badges');
    expect(e.subject).toBe('Math Coach idea: <b>more</b> stars & badges');
  });
});

describe('feedback: the /api/feedback route', () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('https://cml-math-coach.seolith.com/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  it('accepts same-origin posts, refuses cross-site ones, and reports missing storage', async () => {
    const db = makeDb();
    expect((await feedbackRoute({ request: post(base), env: { DB: db } })).status).toBe(200);
    expect((await feedbackRoute({ request: post(base, { 'sec-fetch-site': 'cross-site' }), env: { DB: db } })).status).toBe(403);
    expect((await feedbackRoute({ request: post(base), env: {} })).status).toBe(503);
    const bad = await feedbackRoute({ request: post({ ...base, message: '' }), env: { DB: db } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Write a few words first' });
  });
});
