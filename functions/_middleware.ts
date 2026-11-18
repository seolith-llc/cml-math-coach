/**
 * Every request: keep crawlers and AI agents out, and mark everything noindex (server/guard.ts).
 * Where sign-in is required (server/hosts.ts), every data API also needs a signed-in member who accepted the terms
 * in the last 30 days; the app shell itself holds no data. CI may call with the CRON_SECRET bearer.
 */
import { guard, withNoindex } from '../server/guard';
import { OPEN_API, authRequired } from '../server/hosts';
import { requireMember, sessionUser } from '../server/accounts';
import { HttpError, json } from '../server/parent';
import { accountsCtx, bearerOk, type Env } from '../server/env';

export async function onRequest({ request, env = {}, next }: { request: Request; env?: Env; next: () => Promise<Response> }): Promise<Response> {
  const blocked = guard(request);
  if (blocked) return blocked;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (path.startsWith('/api/') && !OPEN_API.includes(path) && authRequired(env, request) && !bearerOk(request, env.CRON_SECRET)) {
    if (!env.DB) return withNoindex(json(503, { error: 'Storage is not set up yet' }));
    try {
      requireMember(await sessionUser(accountsCtx(env, request), request), Date.now());
    } catch (e) {
      return withNoindex(json(e instanceof HttpError ? e.status : 401, { error: e instanceof HttpError ? e.message : 'Please sign in' }));
    }
  }
  return withNoindex(await next());
}
