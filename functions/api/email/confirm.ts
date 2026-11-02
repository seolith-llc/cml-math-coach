/** GET shows a "Confirm" button (safe from link scanners); POST confirms the address. */
import { confirmButtonPage, confirmEmail, htmlResponse } from '../../../server/email';
import type { Env } from '../../../server/env';

const token = (r: Request) => new URL(r.url).searchParams.get('t') ?? '';

export const onRequestGet = ({ request }: { request: Request }) => confirmButtonPage('confirm', token(request));

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.DB) return htmlResponse(503, 'Not available');
  return confirmEmail(env.DB, token(request));
}
