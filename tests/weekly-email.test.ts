import { describe, expect, it } from 'vitest';
import { makeDb } from './parent-server.test';
import { sync, readDashboard } from '../server/parent';
import { confirmEmail, sendWeekly, setEmail, stopEmail, testEmail, unsubscribe, type Mailer } from '../server/email';
import { buildDigest, currentWeekKey, sendWindow } from '../server/digest';
import { onRequestPost as weeklyRoute } from '../functions/api/weekly';

const FAMILY = 'FamilyIdForEmailTests_0001';
const PIN = '2468';
const ORIGIN = 'https://cml-math-coach.seolith.com';
// Sunday 8 Nov 2026, 18:30 in Chicago (CST, UTC-6) = Monday 00:30 UTC
const SUN_EVENING = Date.UTC(2026, 10, 9, 0, 30);

function fakeMailer() {
  const sent: Parameters<Mailer>[0][] = [];
  const mailer: Mailer = async (m) => {
    sent.push(m);
    return 'msg-' + sent.length;
  };
  return { sent, mailer };
}

async function seed(db: ReturnType<typeof makeDb>, now = SUN_EVENING) {
  const DAY = 86_400_000;
  const attempts = [
    ...[1, 2, 3].map((d, i) => ({ ts: now - d * DAY, problemId: `coins:2:1:${i + 1}`, topicId: 'coins', grade: 2, level: 1, correct: true, firstTry: true, seconds: 60 })),
    { ts: now - DAY, problemId: 'calendar:2:1:7', topicId: 'calendar', grade: 2, level: 1, correct: false, firstTry: false, answer: 'Tues<script>', seconds: 90 }
  ];
  await sync(db, { familyId: FAMILY, pin: PIN, child: { name: 'Sam <b>', grade: 2 }, attempts, snapshot: { activeDays: [] } }, now - 3600_000);
}

const confirmTokenFrom = (text: string) => text.match(/confirm\?t=([A-Za-z0-9_-]+)/)![1];
const unsubTokenFrom = (text: string) => text.match(/unsubscribe\?u=([A-Za-z0-9_-]+)/)![1];

describe('send window (America/Chicago)', () => {
  it('opens Sunday 5pm and closes Monday 6am local, across daylight saving', () => {
    expect(sendWindow(SUN_EVENING)).toBe('2026-11-08');
    expect(sendWindow(Date.UTC(2026, 10, 8, 22, 59))).toBeNull(); // Sun 4:59 pm CST
    expect(sendWindow(Date.UTC(2026, 10, 8, 23, 7))).toBe('2026-11-08'); // Sun 5:07 pm CST
    expect(sendWindow(Date.UTC(2026, 10, 9, 11, 30))).toBe('2026-11-08'); // Mon 5:30 am CST
    expect(sendWindow(Date.UTC(2026, 10, 9, 12, 30))).toBeNull(); // Mon 6:30 am
    expect(sendWindow(Date.UTC(2026, 6, 12, 23, 7))).toBe('2026-07-12'); // July: Sun 6:07 pm CDT
    expect(sendWindow(Date.UTC(2026, 6, 13, 0, 7))).toBe('2026-07-12'); // July: Sun 7:07 pm CDT
    expect(currentWeekKey(Date.UTC(2026, 10, 11, 15))).toBe('2026-11-08'); // Wednesday -> last Sunday
  });
});

describe('weekly email opt-in flow', () => {
  it('requires a confirmed address, then sends a test with unsubscribe headers', async () => {
    const db = makeDb();
    await seed(db);
    const { sent, mailer } = fakeMailer();
    const ctx = { db, mailer, origin: ORIGIN, now: SUN_EVENING };
    await expect(setEmail(ctx, { familyId: FAMILY, pin: '0000', email: 'p@example.com' })).rejects.toMatchObject({ status: 401 });
    await expect(setEmail(ctx, { familyId: FAMILY, pin: PIN, email: 'not-an-email' })).rejects.toMatchObject({ status: 400 });
    await setEmail(ctx, { familyId: FAMILY, pin: PIN, email: ' Parent@Example.com ' });
    expect(sent[0]).toMatchObject({ to: 'parent@example.com', subject: 'Confirm your weekly Math Coach email' });
    await expect(testEmail(ctx, { familyId: FAMILY, pin: PIN })).rejects.toThrow(/Confirm your email/);

    const dash1 = await readDashboard(db, { familyId: FAMILY, pin: PIN }, SUN_EVENING);
    expect(dash1.email).toEqual({ address: 'parent@example.com', verified: false, weekly: true, nudges: true });

    const res = await confirmEmail(db, confirmTokenFrom(sent[0].text), SUN_EVENING + 1000);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('parent@example.com');
    expect((await confirmEmail(db, confirmTokenFrom(sent[0].text), SUN_EVENING + 2000)).status).toBe(410); // single use

    await testEmail(ctx, { familyId: FAMILY, pin: PIN });
    const t = sent[1];
    expect(t.subject).toMatch(/^\[Test\] Sam <b>'s math week: 4 problems, 75% right first try$/);
    expect(t.headers!['List-Unsubscribe']).toMatch(/^<https:\/\/cml-math-coach\.seolith\.com\/api\/email\/unsubscribe\?u=/);
    expect(t.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    // user content is escaped in HTML
    expect(t.html).toContain('Sam &lt;b&gt;');
    expect(t.html).toContain('Tues&lt;script&gt;');
    expect(t.html).not.toContain('<script>');
    expect(t.text).toContain('Mistakes:');
    expect(t.text).toMatch(/Answered Tues<script>\. Correct: \w+day/);
  });

  it('expired confirmation links are rejected', async () => {
    const db = makeDb();
    await seed(db);
    const { sent, mailer } = fakeMailer();
    await setEmail({ db, mailer, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN, email: 'p@example.com' });
    expect((await confirmEmail(db, confirmTokenFrom(sent[0].text), SUN_EVENING + 4 * 86_400_000)).status).toBe(410);
  });

  it('caps confirmation/test emails per day', async () => {
    const db = makeDb();
    await seed(db);
    const { mailer } = fakeMailer();
    const ctx = { db, mailer, origin: ORIGIN, now: SUN_EVENING };
    for (let i = 0; i < 5; i++) await setEmail(ctx, { familyId: FAMILY, pin: PIN, email: `p${i}@example.com` });
    await expect(setEmail(ctx, { familyId: FAMILY, pin: PIN, email: 'p9@example.com' })).rejects.toMatchObject({ status: 429 });
  });

  it('503 when email is not configured', async () => {
    const db = makeDb();
    await seed(db);
    await expect(setEmail({ db, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN, email: 'p@example.com' })).rejects.toMatchObject({ status: 503 });
  });
});

describe('weekly batch', () => {
  async function confirmed() {
    const db = makeDb();
    await seed(db);
    const m = fakeMailer();
    await setEmail({ db, mailer: m.mailer, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN, email: 'p@example.com' });
    await confirmEmail(db, confirmTokenFrom(m.sent[0].text), SUN_EVENING);
    return { db, ...m };
  }

  it('sends once per week, only in the window', async () => {
    const { db, sent, mailer } = await confirmed();
    const before = sent.length;
    expect((await sendWeekly({ db, mailer, origin: ORIGIN, now: SUN_EVENING - 6 * 3_600_000 })).reason).toMatch(/Outside/);
    const r1 = await sendWeekly({ db, mailer, origin: ORIGIN, now: SUN_EVENING });
    expect(r1).toMatchObject({ week: '2026-11-08', sent: 1, failed: 0, remaining: 0 });
    expect(sent[before].subject).toBe("Sam <b>'s math week: 4 problems, 75% right first try");
    const r2 = await sendWeekly({ db, mailer, origin: ORIGIN, now: SUN_EVENING + 3_600_000 }); // second cron slot
    expect(r2.sent).toBe(0);
    expect(sent.length).toBe(before + 1);
  });

  it('skips families inactive for 4+ weeks, and stops after unsubscribe or stop', async () => {
    const { db, sent, mailer } = await confirmed();
    const later = SUN_EVENING + 35 * 86_400_000; // 5 weeks later, still a Sunday evening
    const r = await sendWeekly({ db, mailer, origin: ORIGIN, now: later });
    expect(r).toMatchObject({ sent: 0, skipped: 1 });

    const test = await testEmail({ db, mailer, origin: ORIGIN, now: SUN_EVENING + 86_400_000 }, { familyId: FAMILY, pin: PIN });
    expect(test.sent).toBe(true);
    const unsub = await unsubscribe(db, unsubTokenFrom(sent[sent.length - 1].text));
    expect(await unsub.text()).toContain('<h1>Unsubscribed</h1>');
    const r3 = await sendWeekly({ db, mailer, origin: ORIGIN, now: SUN_EVENING + 7 * 86_400_000 });
    expect(r3.sent + r3.skipped).toBe(0);

    await setEmail({ db, mailer, origin: ORIGIN, now: SUN_EVENING + 8 * 86_400_000 }, { familyId: FAMILY, pin: PIN, email: 'p@example.com' });
    await stopEmail({ db, origin: ORIGIN }, { familyId: FAMILY, pin: PIN });
    expect((await readDashboard(db, { familyId: FAMILY, pin: PIN })).email).toBeNull();
  });

  it('records failures without marking the week as sent', async () => {
    const { db } = await confirmed();
    const failing: Mailer = async () => { throw new Error('Email address is not verified'); };
    const r = await sendWeekly({ db, mailer: failing, origin: ORIGIN, now: SUN_EVENING });
    expect(r).toMatchObject({ sent: 0, failed: 1, errors: ['Email address is not verified'] });
    const { mailer, sent } = fakeMailer();
    expect((await sendWeekly({ db, mailer, origin: ORIGIN, now: SUN_EVENING + 60_000 })).sent).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('/api/weekly requires the bearer secret', async () => {
    const db = makeDb();
    const req = (auth?: string) => new Request(`${ORIGIN}/api/weekly`, { method: 'POST', headers: auth ? { authorization: auth } : {}, body: '{}' });
    const env = { DB: db, CRON_SECRET: 'a-long-enough-cron-secret', AWS_ACCESS_KEY_ID: 'x', AWS_SECRET_ACCESS_KEY: 'y', MAIL_FROM: 'c@seolith.com' };
    expect((await weeklyRoute({ request: req(), env })).status).toBe(401);
    expect((await weeklyRoute({ request: req('Bearer wrong-secret-of-same-len'), env })).status).toBe(401);
    expect((await weeklyRoute({ request: req('Bearer a-long-enough-cron-secret'), env: { ...env, CRON_SECRET: 'short' } })).status).toBe(401);
    const ok = await weeklyRoute({ request: req('Bearer a-long-enough-cron-secret'), env });
    expect(ok.status).toBe(200);
  });
});

describe('digest content', () => {
  it('quiet week has its own subject and a nudge', () => {
    const now = SUN_EVENING;
    const d = buildDigest(
      { child: { name: 'Ava', grade: 3 }, lastSync: now, snapshot: null, attempts: [{ ts: now - 10 * 86_400_000, problemId: 'coins:3:1:1', topicId: 'coins', grade: 3, level: 1, correct: true, firstTry: true, skipped: false, hints: 0, seconds: 30, mode: 'practice' }] },
      { appUrl: ORIGIN + '/', unsubscribeUrl: ORIGIN + '/api/email/unsubscribe?u=x' },
      now
    )!;
    expect(d.subject).toBe("Ava didn't practice math this week");
    expect(d.text).toMatch(/No practice in the last 7 days/);
  });
});

describe('email log', () => {
  it('records every send with the SES message id or the error', async () => {
    const db = makeDb();
    await seed(db);
    const { sent, mailer } = fakeMailer();
    await setEmail({ db, mailer, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN, email: 'p@example.com' });
    await confirmEmail(db, confirmTokenFrom(sent[0].text), SUN_EVENING);
    await testEmail({ db, mailer, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN });
    const failing: Mailer = async () => { throw new Error('Email address is not verified'); };
    await expect(testEmail({ db, mailer: failing, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN })).rejects.toThrow();
    const { results } = await db.prepare('SELECT kind, ok, detail FROM email_log ORDER BY rowid').all();
    expect(results).toEqual([
      { kind: 'confirm', ok: 1, detail: 'msg-1' },
      { kind: 'test', ok: 1, detail: 'msg-2' },
      { kind: 'test', ok: 0, detail: 'Email address is not verified' }
    ]);
    expect(JSON.stringify(results)).not.toContain('p@example.com');
  });
});

describe('email log: refusals', () => {
  it('logs a Send test that is refused before reaching SES', async () => {
    const db = makeDb();
    await seed(db);
    const { mailer } = fakeMailer();
    await setEmail({ db, mailer, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN, email: 'p@example.com' });
    await expect(testEmail({ db, mailer, origin: ORIGIN, now: SUN_EVENING }, { familyId: FAMILY, pin: PIN })).rejects.toThrow(/Confirm/);
    const { results } = await db.prepare("SELECT kind, ok, detail FROM email_log WHERE kind = 'test'").all();
    expect(results).toEqual([{ kind: 'test', ok: 0, detail: 'not sent: Confirm your email address first' }]);
  });
});
