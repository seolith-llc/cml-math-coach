/**
 * POST /api/weekly: sends this week's progress emails in batches.
 * Called by the scheduled GitHub Action with `Authorization: Bearer <CRON_SECRET>`.
 * Body: { force?: boolean, limit?: number }. `force` ignores the Sunday-evening window (manual runs).
 */
import { sendWeekly } from '../../server/email';
import { json, readJson } from '../../server/parent';
import { mailerFrom, originFor, type Env } from '../../server/env';

function authorized(request: Request, secret?: string): boolean {
  if (!secret || secret.length < 16) return false;
  const got = request.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (got.length !== want.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!authorized(request, env.CRON_SECRET)) return json(401, { error: 'Unauthorized' });
  if (!env.DB) return json(503, { error: 'Database is not bound' });
  const mailer = mailerFrom(env);
  if (!mailer) return json(503, { error: 'Email is not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MAIL_FROM)' });
  const body = await readJson(request).catch(() => ({}) as Record<string, unknown>);
  const result = await sendWeekly({ db: env.DB, mailer, origin: originFor(env, request) }, { force: body.force === true, limit: Number(body.limit) || undefined });
  return json(200, result);
}
