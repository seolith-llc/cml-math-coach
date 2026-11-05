/** One-click unsubscribe (RFC 8058): GET shows a button, POST unsubscribes (also used by mail apps directly). */
import { confirmButtonPage, htmlResponse, unsubscribe } from '../../../server/email';
import type { Env } from '../../../server/env';

const token = (r: Request) => new URL(r.url).searchParams.get('u') ?? '';
const kind = (r: Request) => new URL(r.url).searchParams.get('k');

export const onRequestGet = ({ request }: { request: Request }) => confirmButtonPage('unsubscribe', token(request), kind(request));

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.DB) return htmlResponse(503, 'Not available');
  return unsubscribe(env.DB, token(request), kind(request));
}
