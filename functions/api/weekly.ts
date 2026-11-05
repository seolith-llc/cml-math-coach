/**
 * POST /api/weekly: sends this week's progress emails in batches.
 * Called by the scheduled GitHub Action with `Authorization: Bearer <CRON_SECRET>`.
 * Body: { force?: boolean, limit?: number }. `force` ignores the Sunday-evening window (manual runs).
 */
import { sendWeekly } from '../../server/email';
import { json, readJson } from '../../server/parent';
import { bearerOk, mailerFrom, originFor, type Env } from '../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!bearerOk(request, env.CRON_SECRET)) return json(401, { error: 'Unauthorized' });
  if (!env.DB) return json(503, { error: 'Database is not bound' });
  const mailer = mailerFrom(env);
  if (!mailer) return json(503, { error: 'Email is not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MAIL_FROM)' });
  const body = await readJson(request).catch(() => ({}) as Record<string, unknown>);
  const result = await sendWeekly({ db: env.DB, mailer, origin: originFor(env, request) }, { force: body.force === true, limit: Number(body.limit) || undefined });
  return json(200, result);
}
