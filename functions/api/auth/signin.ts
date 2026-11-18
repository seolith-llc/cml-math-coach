/** The sign-in link: GET shows a button (mail scanners don't press it); POST uses the link once and sets the session. */
import { completeSignIn } from '../../../server/accounts';
import { authPage } from '../../../server/authPages';
import { htmlResponse } from '../../../server/email';
import { accountsCtx, type Env } from '../../../server/env';

const token = (r: Request) => (new URL(r.url).searchParams.get('t') ?? '').replace(/[^A-Za-z0-9_-]/g, '');

export const onRequestGet = ({ request }: { request: Request }) =>
  htmlResponse(200, authPage('Sign in', `<h1>Sign in to Puzzle Trail</h1><form method="post" action="?t=${token(request)}"><button type="submit">Sign in</button></form>`));

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.DB) return htmlResponse(503, authPage('Not available', '<h1>Not available</h1>'));
  const r = await completeSignIn(accountsCtx(env, request), token(request));
  if ('error' in r) return htmlResponse(400, authPage('Sign in', `<h1>Sign in</h1><p>${r.error}</p><a class="btn" href="/#/signin">Get a new link</a>`));
  return new Response(null, { status: 303, headers: { location: '/#/', 'set-cookie': r.cookie, 'cache-control': 'no-store' } });
}
