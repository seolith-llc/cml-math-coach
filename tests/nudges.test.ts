import { describe, expect, it } from 'vitest';
import { makeDb } from './parent-server.test';
import { sync, readDashboard } from '../server/parent';
import { confirmEmail, sendNudges, sendWeekly, setEmail, setPrefs, unsubscribe, type Mailer } from '../server/email';

const FAMILY = 'FamilyIdForNudgeTests_00001';
const PIN = '2468';
const ORIGIN = 'https://cml-math-coach.seolith.com';
const DAY = 86_400_000;
// Thursday 2026-11-12 17:20 in Chicago (CST) = 23:20 UTC
const THU_5PM = Date.UTC(2026, 10, 12, 23, 20);

function mailbox() {
  const sent: Parameters<Mailer>[0][] = [];
  const mailer: Mailer = async (m) => { sent.push(m); return 'id' + sent.length; };
  return { sent, mailer };
}

async function family(lastPracticeDaysAgo: number) {
  const db = makeDb();
  const { sent, mailer } = mailbox();
  const at = THU_5PM - lastPracticeDaysAgo * DAY;
  await sync(db, { familyId: FAMILY, pin: PIN, child: { name: 'Sam', grade: 2 }, attempts: [{ ts: at, problemId: 'coins:2:1:1', topicId: 'coins', grade: 2, level: 1, correct: true, firstTry: true }] }, at);
  await setEmail({ db, mailer, origin: ORIGIN, now: at }, { familyId: FAMILY, pin: PIN, email: 'p@example.com' });
  await confirmEmail(db, sent[0].text.match(/confirm\?t=([A-Za-z0-9_-]+)/)![1], at);
  sent.length = 0;
  return { db, sent, mailer };
}

describe('inactivity nudges', () => {
  it('nothing before 3 days off; one at 3 days; second at 7; then none', async () => {
    const { db, sent, mailer } = await family(2);
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM })).sent).toBe(0); // 2 days
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM + DAY })).sent).toBe(1); // 3 days (Fri)
    expect(sent[0].subject).toBe('Sam: a quick math round today?');
    expect(sent[0].headers!['List-Unsubscribe']).toMatch(/&k=nudges>$/);
    expect(sent[0].text).toMatch(/Last practice: Tuesday, Nov 10/);
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM + 2 * DAY })).sent).toBe(0); // Sat: 4 days, second waits for 7
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM + 5 * DAY })).sent).toBe(1); // Tue: 7 days
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM + 6 * DAY })).sent).toBe(0); // capped at 2
    expect(sent).toHaveLength(2);
  });
  it('only at 5 pm Chicago, never on Sunday, never twice a day', async () => {
    const { db, mailer } = await family(5);
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM - 3600e3 })).reason).toMatch(/Outside/); // 4 pm
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM + 3 * DAY })).reason).toMatch(/Outside/); // Sunday
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM })).sent).toBe(1);
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM + 600e3 })).sent).toBe(0);
  });
  it('practice resets the break, so a later break gets nudges again', async () => {
    const { db, mailer } = await family(3);
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM })).sent).toBe(1);
    await sync(db, { familyId: FAMILY, attempts: [{ ts: THU_5PM + DAY, problemId: 'coins:2:1:2', topicId: 'coins', grade: 2, level: 1, correct: true, firstTry: true }] }, THU_5PM + DAY);
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM + 4 * DAY + 3600e3 * 0 })).sent).toBe(1); // Mon, 3 days after Fri
  });
  it('respects the parent: prefs toggle and the one-click "turn off reminders" link', async () => {
    const { db, mailer, sent } = await family(4);
    await setPrefs({ db, origin: ORIGIN }, { familyId: FAMILY, pin: PIN, nudges: false });
    expect((await readDashboard(db, { familyId: FAMILY, pin: PIN })).email).toMatchObject({ nudges: false, weekly: true });
    expect((await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM })).sent).toBe(0);
    await setPrefs({ db, origin: ORIGIN }, { familyId: FAMILY, pin: PIN, nudges: true });
    await sendNudges({ db, mailer, origin: ORIGIN, now: THU_5PM });
    const token = sent[0].text.match(/unsubscribe\?u=([A-Za-z0-9_-]+)&k=nudges/)![1];
    const res = await unsubscribe(db, token, 'nudges');
    expect(await res.text()).toContain('<h1>Reminders off</h1>');
    expect((await readDashboard(db, { familyId: FAMILY, pin: PIN })).email).toMatchObject({ address: 'p@example.com', nudges: false, weekly: true });
  });
  it('weekly summary can be turned off on its own', async () => {
    const { db, mailer } = await family(1);
    await setPrefs({ db, origin: ORIGIN }, { familyId: FAMILY, pin: PIN, weekly: false });
    const SUN_EVENING = Date.UTC(2026, 10, 16, 0, 30);
    expect((await sendWeekly({ db, mailer, origin: ORIGIN, now: SUN_EVENING })).sent).toBe(0);
  });
});
