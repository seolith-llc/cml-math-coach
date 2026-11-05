/** POST /api/push: { action: key | subscribe | unsubscribe | touch } for daily practice reminders. See server/push.ts. */
import { handle } from '../../server/parent';
import { publicKey, subscribe, touch, unsubscribe } from '../../server/push';
import type { Env } from '../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  return handle(request, env.DB, (db, body) => {
    switch (body.action) {
      case 'key': return publicKey(db);
      case 'subscribe': return subscribe(db, body);
      case 'unsubscribe': return unsubscribe(db, body);
      case 'touch': return touch(db, body);
      default: return Promise.resolve({ error: 'Unknown action' });
    }
  });
}
