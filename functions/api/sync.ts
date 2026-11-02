/** POST /api/sync: the child's device uploads progress (see server/parent.ts). */
import { handle, sync, type DB } from '../../server/parent';

export async function onRequestPost({ request, env }: { request: Request; env: { DB?: DB } }): Promise<Response> {
  return handle(request, env.DB, (db, body) => sync(db, body));
}
