/**
 * Feedback and suggestions from the in-app Feedback button (POST /api/feedback).
 * Stored privately in D1 and emailed to the owner; triaged with the "Feedback" workflow (scripts/feedback.mjs).
 * The repository is public, so messages never become GitHub issues.
 */
import { HttpError, type DB } from './parent';
import type { Mailer } from './email';

export const FEEDBACK = { maxMessage: 2000, minMessage: 3, perDevicePerHour: 10, perDay: 200 } as const;
export const KINDS = ['problem', 'idea'] as const;
export type Kind = (typeof KINDS)[number];

export interface Stored {
  id: string;
  ts: number;
  kind: Kind;
  message: string;
  route: string;
  problemId: string | null;
  grade: number | null;
  device: string;
}

const PROBLEM_ID = /^[a-z0-9-]+:[23]:\d{1,2}:\d{1,10}$/; // seeds are 32-bit: up to 10 digits
const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Checks and cleans the request body; throws HttpError(400) with a message the child or parent can act on. */
export function parseFeedback(body: Record<string, unknown>): Omit<Stored, 'id' | 'ts'> & { deviceId: string } {
  const kind = body.kind;
  if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) throw new HttpError(400, 'Choose Problem or Idea');
  const message = typeof body.message === 'string' ? body.message.replace(/\r\n?/g, '\n').trim() : '';
  if (message.length < FEEDBACK.minMessage) throw new HttpError(400, 'Write a few words first');
  if (message.length > FEEDBACK.maxMessage) throw new HttpError(400, `Keep it under ${FEEDBACK.maxMessage} characters`);
  const deviceId = body.deviceId;
  if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) throw new HttpError(400, 'Bad request');
  const route = typeof body.route === 'string' && /^(#\/[A-Za-z0-9/_:-]{0,120})?$/.test(body.route) ? body.route : '';
  const problemId = typeof body.problemId === 'string' && PROBLEM_ID.test(body.problemId) ? body.problemId : null;
  const grade = body.grade === 2 || body.grade === 3 ? body.grade : null;
  const device = typeof body.device === 'string' ? body.device.replace(/[^\x20-\x7E]/g, '').slice(0, 200) : '';
  return { kind: kind as Kind, message, route, problemId, grade, device, deviceId };
}

function newId(): string {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return 'fb_' + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_');
}

export function feedbackEmail(f: Stored): { subject: string; text: string; html: string } {
  const first = f.message.split('\n')[0].slice(0, 60);
  const text = [
    f.message,
    '',
    '—',
    `${f.id} · ${new Date(f.ts).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `Screen: ${f.route || 'home'}${f.problemId ? ` · problem ${f.problemId}` : ''}${f.grade ? ` · grade ${f.grade}` : ''}`,
    `Device: ${f.device || 'unknown'}`,
    '',
    'Triage it in GitHub: Actions → Feedback.'
  ].join('\n');
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    subject: `Math Coach ${f.kind === 'problem' ? 'problem' : 'idea'}: ${first}${f.message.length > first.length ? '…' : ''}`,
    text,
    html: `<pre style="font: 15px/1.5 -apple-system, sans-serif; white-space: pre-wrap">${esc(text)}</pre>`
  };
}

export async function submitFeedback(db: DB, body: Record<string, unknown>, opts: { now?: number; mailer?: Mailer; to?: string } = {}) {
  const now = opts.now ?? Date.now();
  const f = parseFeedback(body);
  const hour = await db.prepare('SELECT COUNT(*) AS n FROM user_feedback WHERE device_id = ? AND ts > ?').bind(f.deviceId, now - 3_600_000).first<{ n: number }>();
  if ((hour?.n ?? 0) >= FEEDBACK.perDevicePerHour) throw new HttpError(429, 'Thanks! That is a lot for one hour. Please try again later');
  const day = await db.prepare('SELECT COUNT(*) AS n FROM user_feedback WHERE ts > ?').bind(now - 86_400_000).first<{ n: number }>();
  if ((day?.n ?? 0) >= FEEDBACK.perDay) throw new HttpError(429, 'Feedback is paused for today. Please try again tomorrow');
  const stored: Stored = { id: newId(), ts: now, kind: f.kind, message: f.message, route: f.route, problemId: f.problemId, grade: f.grade, device: f.device };
  await db
    .prepare('INSERT INTO user_feedback (id, ts, kind, message, route, problem_id, grade, device, device_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(stored.id, now, stored.kind, stored.message, stored.route, stored.problemId, stored.grade, stored.device, f.deviceId, now)
    .run();
  // The email is a convenience: the message is already saved, so a mail failure doesn't fail the request
  let emailed = false;
  if (opts.mailer && opts.to) {
    try {
      await opts.mailer({ to: opts.to, ...feedbackEmail(stored) });
      emailed = true;
    } catch {
      emailed = false;
    }
  }
  return { ok: true, id: stored.id, emailed };
}
