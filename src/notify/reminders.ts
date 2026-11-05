import { dueReviews, load } from '../core/storage';
import { localDay } from '../core/progress';

/**
 * Daily practice reminders on this device (Web Push) and the app icon badge.
 * The parent turns reminders on in Settings; the server sends one a day at the chosen hour,
 * and skips it when the app reports that practice already happened today.
 */

type Support = 'ok' | 'install' | 'no';

/** 'install' = iPhone/iPad in a Safari tab: Apple allows web push only for the Home Screen app. */
export function reminderSupport(): Support {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'no';
  if ('PushManager' in window && 'Notification' in window) return 'ok';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'install' : 'no';
}

async function api(body: Record<string, unknown>) {
  const res = await fetch('./api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string; key?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

const b64uToBytes = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/** Must run from a tap (browsers only show the permission prompt for a user gesture). */
export async function enableReminder(hour: number): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are off for this app');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api({ action: 'key' });
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key!) as BufferSource }));
  const s = load().settings;
  await api({ action: 'subscribe', subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, hour, name: s.name, goal: s.goal });
}

export async function disableReminder(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

/** Reviews due as the app icon badge (Badging API; iPad needs the Home Screen app and notification permission). */
function updateBadge() {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  const state = load();
  const n = dueReviews(state, state.settings.grade).length;
  void (n ? nav.setAppBadge(n) : nav.clearAppBadge?.())?.catch(() => {});
}

let timer: number | undefined;

/** Tell the server "practiced today" (debounced) so today's reminder is skipped. */
async function reportPractice() {
  if (!load().settings.reminder.on || reminderSupport() !== 'ok') return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (sub) await api({ action: 'touch', endpoint: sub.endpoint, day: localDay() }).catch(() => {});
}

export function startReminders(): void {
  if (typeof window === 'undefined') return;
  updateBadge();
  window.addEventListener('cml:progress', () => {
    updateBadge();
    clearTimeout(timer);
    timer = window.setTimeout(() => void reportPractice(), 3000);
  });
}
