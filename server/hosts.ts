/**
 * Where the app lives (docs/REDESIGN.md, phase 3, step080).
 * - NEW_HOST: the app's own sign-in is always required here; there is no Cloudflare Access in front of it.
 * - OLD_HOSTS: the earlier address. It stays behind Cloudflare Access and only hands each device's progress to NEW_HOST.
 */
import { NEW_HOST } from '../src/core/hosts';
export { NEW_HOST, NEW_ORIGIN, OLD_HOSTS } from '../src/core/hosts';

/** Whether this request must come from a signed-in member: always on NEW_HOST, everywhere once AUTH_REQUIRED=1. */
export function authRequired(env: { AUTH_REQUIRED?: string }, request: Request): boolean {
  return env.AUTH_REQUIRED === '1' || new URL(request.url).host === NEW_HOST;
}

/**
 * API paths that answer without a session: sign-in itself, the token-protected email links, the device hand-off
 * (one-time code), and scheduled or CI calls (bearer CRON_SECRET, checked by each function).
 */
export const OPEN_API: readonly string[] = [
  '/api/auth', '/api/auth/signin', '/api/auth/approve',
  '/api/email/confirm', '/api/email/unsubscribe',
  '/api/handoff',
  '/api/hourly', '/api/weekly', '/api/admin/invite', '/api/admin/capacity'
];
