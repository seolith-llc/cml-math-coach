/**
 * The signed-in person, from POST /api/auth (server/accounts.ts). The last answer is kept on this device (flags only,
 * never emails), so the app opens offline with the same gate; it is refreshed at start, on focus and after actions.
 */
import type { AccountState } from '../core/gate';

export interface Member { id: string; email: string; role: 'owner' | 'coparent' | 'viewer'; me: boolean }
export interface Household { id: string; role: Member['role']; members: Member[] }
export interface Invite { id: string; kind: 'family' | 'join'; role: string | null; created_at: number; expires_at: number }
export interface Me extends AccountState {
  email?: string;
  admin?: boolean;
  termsDue?: boolean;
  daysLeft?: number;
  termsVersion?: string;
  invitesLeft?: number | null;
  canInviteFamilies?: boolean;
  households?: Household[];
  invites?: Invite[];
  waiting?: { user: string; email: string; created_at: number }[];
}

const KEY = 'pt-account';

function read(): AccountState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.signedIn === 'boolean') return v;
  } catch { /* private mode */ }
  return { signedIn: false, required: false };
}

let state: AccountState = typeof localStorage === 'undefined' ? { signedIn: false, required: false } : read();
let latest: Me | null = null;

export const account = (): AccountState => state;
export const latestMe = (): Me | null => latest;

function keep(me: Me) {
  const next: AccountState = {
    signedIn: me.signedIn,
    required: me.required,
    status: me.status,
    termsUntil: me.signedIn ? (me.termsUntil ?? null) : undefined
  };
  const changed = JSON.stringify(next) !== JSON.stringify(state);
  state = next;
  latest = me;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  if (changed) window.dispatchEvent(new Event('pt:account'));
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function call<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('./api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, action }) });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* not JSON (e.g. offline page) */ }
  if (!res.ok) throw new ApiError(res.status, typeof data.error === 'string' ? data.error : 'Something went wrong');
  return data as T;
}

/** Asks the server who is signed in (offline: keeps the last answer). */
export async function refreshAccount(): Promise<Me | null> {
  try {
    const me = await call<Me>('me');
    keep(me);
    return me;
  } catch {
    return null;
  }
}

/** Records the terms on the account too (the device acceptance is saved by the accept screen). */
export async function acceptTermsOnAccount(version: string): Promise<void> {
  if (!state.signedIn) return;
  await call('terms', { version }).catch(() => {});
  await refreshAccount();
}

export async function signOutHere(): Promise<void> {
  await call('signout').catch(() => {});
  keep({ signedIn: false, required: state.required });
}
