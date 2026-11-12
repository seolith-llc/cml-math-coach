/**
 * Keeps the installed app current and honest about sign-in (the site is behind Cloudflare Access).
 * - Looks for a new version on open, when the app comes back to the foreground, and hourly.
 * - If the sign-in has expired, drops the offline copy and reloads, so the sign-in page appears
 *   instead of an old version that can't sync.
 */
import { registerSW } from 'virtual:pwa-register';

const CHECK_EVERY = 10 * 60_000;
let lastCheck = 0;

/** A response from the sign-in gate rather than from the app (redirect to sign in, or refused). */
export const isSignedOut = (res: Pick<Response, 'type' | 'status'>) => res.type === 'opaqueredirect' || res.status === 401 || res.status === 403;

async function checkSignIn(): Promise<void> {
  if (!navigator.onLine || Date.now() - lastCheck < CHECK_EVERY) return;
  lastCheck = Date.now();
  try {
    const res = await fetch('./?auth-check=1', { redirect: 'manual', cache: 'no-store', credentials: 'same-origin' });
    if (!isSignedOut(res)) return;
    for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
    for (const k of (await caches?.keys()) ?? []) await caches.delete(k);
    // Reload at most once a minute, so this can never loop.
    const key = 'cml-signin-reload';
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    location.reload();
  } catch {
    /* offline or blocked: keep going with the copy we have */
  }
}

export function startPwa(): void {
  let registration: ServiceWorkerRegistration | undefined;
  registerSW({ immediate: true, onRegisteredSW: (_url, r) => (registration = r) });
  const refresh = () => {
    void checkSignIn();
    void registration?.update().catch(() => {});
  };
  refresh();
  setInterval(refresh, 60 * 60_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());
}
