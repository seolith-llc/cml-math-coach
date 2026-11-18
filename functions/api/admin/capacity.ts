/** POST /api/admin/capacity (bearer CRON_SECRET, from the hourly job): today's account usage → pause or resume (server/capacity.ts). */
import { setCapacity } from '../../../server/capacity';
import { json, readJson } from '../../../server/parent';
import { bearerOk, type Env } from '../../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!bearerOk(request, env.CRON_SECRET)) return json(401, { error: 'Unauthorized' });
  if (!env.DB) return json(503, { error: 'Storage is not set up yet' });
  return json(200, await setCapacity(env.DB, await readJson(request, 10_000)));
}
