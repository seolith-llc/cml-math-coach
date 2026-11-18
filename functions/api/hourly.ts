/**
 * POST /api/hourly: the one scheduled job (GitHub Actions, every hour, bearer CRON_SECRET).
 * - device reminders for subscriptions whose local hour is now
 * - parent nudges (5 pm Chicago, not Sunday)
 * - the weekly summary (Sunday evening window; once per family per week)
 * - family approvals undecided for 72 hours go to the super admin (server/accounts.ts)
 * - one more family invite a week for owners whose family practised on 3+ days (phase 5)
 * Each part decides for itself whether it's time, so running hourly is always safe.
 */
import { sendNudges, sendWeekly } from '../../server/email';
import { json } from '../../server/parent';
import { sendReminders } from '../../server/push';
import { accountsCtx, bearerOk, mailerFrom, originFor, type Env } from '../../server/env';
import { escalate, growInvites } from '../../server/accounts';
import { sweepHandoffs } from '../../server/handoff';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!bearerOk(request, env.CRON_SECRET)) return json(401, { error: 'Unauthorized' });
  if (!env.DB) return json(503, { error: 'Database is not bound' });
  const origin = originFor(env, request);
  const mailer = mailerFrom(env);
  const run = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      return { error: (e as Error).message };
    }
  };
  const ctx = { db: env.DB, mailer, origin };
  return json(200, {
    reminders: await run(() => sendReminders(env.DB!, { subject: origin })),
    nudges: mailer ? await run(() => sendNudges(ctx)) : { error: 'Email is not configured' },
    weekly: mailer ? await run(() => sendWeekly(ctx)) : { error: 'Email is not configured' },
    handoffs: await run(() => sweepHandoffs(env.DB!)),
    invites: await run(() => growInvites(accountsCtx(env, request))),
    approvals: mailer ? await run(() => escalate(accountsCtx(env, request))) : { error: 'Email is not configured' }
  });
}
