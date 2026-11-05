/** POST /api/parent: dashboard data, and PIN-protected actions (delete, weekly email). See server/parent.ts and server/email.ts. */
import { deleteFamily, handle, readDashboard } from '../../server/parent';
import { setEmail, setPrefs, stopEmail, testEmail } from '../../server/email';
import { mailerFrom, originFor, type Env } from '../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  return handle(request, env.DB, (db, body) => {
    const ctx = { db, mailer: mailerFrom(env), origin: originFor(env, request) };
    switch (body.action) {
      case 'delete': return deleteFamily(db, body);
      case 'email-set': return setEmail(ctx, body);
      case 'email-test': return testEmail(ctx, body);
      case 'email-stop': return stopEmail(ctx, body);
      case 'email-prefs': return setPrefs(ctx, body);
      default: return readDashboard(db, body);
    }
  });
}
