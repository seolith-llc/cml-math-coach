/** POST /api/handoff: { action: 'put', state } on the old address, { action: 'take', code } on the new one (server/handoff.ts). */
import { handle } from '../../server/parent';
import { putHandoff, takeHandoff } from '../../server/handoff';
import { NEW_HOST, OLD_HOSTS } from '../../server/hosts';
import { HttpError } from '../../server/parent';
import type { Env } from '../../server/env';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const host = new URL(request.url).host;
  return handle(request, env.DB, (db, body) => {
    // put only where the old address is (behind Cloudflare Access); take only on the new one
    if (body.action === 'put' && OLD_HOSTS.includes(host)) return putHandoff(db, body);
    if (body.action === 'take' && host === NEW_HOST) return takeHandoff(db, body);
    throw new HttpError(400, 'Not here');
  });
}
