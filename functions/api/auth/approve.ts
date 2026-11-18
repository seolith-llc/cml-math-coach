/** The approval link sent to an inviter (or the super admin): GET shows Approve / Decline; POST decides once. */
import { decideByLink } from '../../../server/accounts';
import { authPage } from '../../../server/authPages';
import { htmlResponse } from '../../../server/email';
import { accountsCtx, type Env } from '../../../server/env';

const token = (r: Request) => (new URL(r.url).searchParams.get('t') ?? '').replace(/[^A-Za-z0-9_-]/g, '');

export const onRequestGet = ({ request }: { request: Request }) => {
  const t = token(request);
  return htmlResponse(200, authPage('Approve a family',
    `<h1>Approve this family?</h1><p>Approve only someone you know.</p>
<form method="post" action="?t=${t}&d=approved"><button type="submit">Approve</button></form>
<form method="post" action="?t=${t}&d=denied" style="margin-top:12px"><button type="submit" class="quiet">Decline</button></form>`));
};

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.DB) return htmlResponse(503, authPage('Not available', '<h1>Not available</h1>'));
  const r = await decideByLink(accountsCtx(env, request), token(request), new URL(request.url).searchParams.get('d') ?? '');
  if ('error' in r) return htmlResponse(400, authPage('Approve', `<h1>Approve</h1><p>${r.error}</p>`));
  const who = r.email.replace(/[<>&]/g, '');
  return htmlResponse(200, authPage('Done', r.decision === 'approved' ? `<h1>Approved</h1><p>${who} can now sign in.</p>` : `<h1>Declined</h1><p>${who} won't get access.</p>`));
}
