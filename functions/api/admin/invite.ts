/** POST /api/admin/invite (bearer CRON_SECRET, from Actions → Invite): the super admin invites families by email. */
import { inviteByEmail } from '../../../server/accounts';
import { HttpError, json, readJson } from '../../../server/parent';
import { accountsCtx, bearerOk, type Env } from '../../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!bearerOk(request, env.CRON_SECRET)) return json(401, { error: 'Unauthorized' });
  if (!env.DB) return json(503, { error: 'Storage is not set up yet' });
  try {
    const body = await readJson(request, 20_000);
    return json(200, await inviteByEmail(accountsCtx(env, request), body.emails));
  } catch (e) {
    return json(e instanceof HttpError ? e.status : 500, { error: e instanceof HttpError ? e.message : 'Something went wrong' });
  }
}
