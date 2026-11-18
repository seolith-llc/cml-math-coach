/** POST /api/auth: accounts (server/accounts.ts). The body's "action" picks what to do; the session cookie says who. */
import {
  acceptInvite, acceptTerms, adminOverview, clearCookie, createInvite, decide, familyKeyFor, inviteInfo, me, removeMember,
  requestSignIn, requireMember, revokeInvite, sessionUser, signOut, suspend
} from '../../../server/accounts';
import { HttpError, json, loadData, readJson, sameOrigin, type FamilyRow } from '../../../server/parent';
import { accountsCtx, type Env } from '../../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: 'Forbidden' });
  if (!env.DB) return json(503, { error: 'Storage is not set up yet' });
  const ctx = accountsCtx(env, request);
  const required = env.AUTH_REQUIRED === '1';
  try {
    const body = await readJson(request, 20_000);
    const user = await sessionUser(ctx, request);
    const member = () => requireMember(user, Date.now());
    switch (body.action) {
      case 'me': return json(200, await me(ctx, user, required));
      case 'signin': return json(200, await requestSignIn(ctx, body));
      case 'invite-info': return json(200, await inviteInfo(ctx, body));
      case 'invite-accept': return json(200, await acceptInvite(ctx, body));
      case 'terms': return json(200, await acceptTerms(ctx, user, body));
      case 'invite-create': return json(200, await createInvite(ctx, member(), body));
      case 'invite-revoke': return json(200, await revokeInvite(ctx, member(), body));
      case 'member-remove': return json(200, await removeMember(ctx, member(), body));
      case 'decide': return json(200, await decide(ctx, member(), String(body.user ?? ''), body.decision === 'approved' ? 'approved' : 'denied'));
      case 'admin': return json(200, await adminOverview(ctx, member()));
      case 'suspend': return json(200, await suspend(ctx, member(), body));
      case 'dashboard': {
        const key = await familyKeyFor(ctx, member(), typeof body.household === 'string' ? body.household : undefined);
        const row = key ? await ctx.db.prepare('SELECT * FROM families WHERE key = ?').bind(key).first<FamilyRow>() : null;
        if (!row) throw new HttpError(404, 'No synced device for this family yet');
        return json(200, await loadData(ctx.db, row));
      }
      case 'signout': {
        await signOut(ctx, request);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': clearCookie() } });
      }
      default: throw new HttpError(400, 'Unknown action');
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    return json(500, { error: 'Something went wrong' });
  }
}
