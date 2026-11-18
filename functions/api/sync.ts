/** POST /api/sync: the child's device uploads progress (see server/parent.ts). A signed-in parent's device also links the family to their household. */
import { handle, sha256Hex, sync, validFamilyId } from '../../server/parent';
import { linkFamily, sessionUser } from '../../server/accounts';
import { accountsCtx, type Env } from '../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  return handle(request, env.DB, async (db, body) => {
    const out = await sync(db, body);
    try {
      const ctx = accountsCtx(env, request);
      const u = await sessionUser(ctx, request);
      if (u?.status === 'active' && validFamilyId(body.familyId)) await linkFamily(ctx, u, await sha256Hex('family:' + body.familyId));
    } catch {
      /* linking is a bonus; the sync itself already succeeded */
    }
    return out;
  });
}
