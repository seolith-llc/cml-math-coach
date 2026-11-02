/** POST /api/parent: read (or, with action "delete", erase) dashboard data. Needs the family link + PIN. */
import { deleteFamily, handle, readDashboard, type DB } from '../../server/parent';

export async function onRequestPost({ request, env }: { request: Request; env: { DB?: DB } }): Promise<Response> {
  return handle(request, env.DB, (db, body) => (body.action === 'delete' ? deleteFamily(db, body) : readDashboard(db, body)));
}
