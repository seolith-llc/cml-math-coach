/**
 * Moving to the new address (phase 3, step080). Browsers keep saved progress per address, so:
 * - on the old address (behind Cloudflare Access): upload this device's progress under a one-time code, mark the device
 *   as moved, and open the new address with the code; afterwards the old address only says where the app is now;
 * - on the new address, #/handoff/<code> takes the progress (once) and keeps whichever copy has more answers.
 */
import { MOVE_ON, NEW_ORIGIN, OLD_HOSTS, pickState } from '../core/hosts';
import { importState, rawState } from '../core/storage';

const MOVED = 'pt-moved';

export const onOldHost = () => typeof location !== 'undefined' && OLD_HOSTS.includes(location.host);

export function movedAlready(): boolean {
  try {
    return !!localStorage.getItem(MOVED);
  } catch {
    return false;
  }
}

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('./api/handoff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not move');
  return data;
}

/** On the old address: hand the progress over and go. Resolves false (stay here) when moving is off or fails. */
export async function moveFromOldHost(): Promise<boolean> {
  if (!MOVE_ON || !onOldHost() || movedAlready()) return false;
  const raw = rawState();
  let target = `${NEW_ORIGIN}/`;
  try {
    if (raw) target = `${NEW_ORIGIN}/#/handoff/${(await post({ action: 'put', state: raw })).code}`;
  } catch {
    return false; // offline or a hiccup: try again next time the app opens
  }
  try {
    localStorage.setItem(MOVED, String(Date.now()));
  } catch { /* private mode */ }
  location.replace(target);
  return true;
}

/** On the new address, #/handoff/<code>: bring the progress in, then open Home. */
export async function takeHandoff(code: string): Promise<'moved' | 'expired'> {
  try {
    const { state } = (await post({ action: 'take', code })) as { state: string };
    importState(pickState(rawState(), state));
    return 'moved';
  } catch {
    return 'expired';
  }
}
