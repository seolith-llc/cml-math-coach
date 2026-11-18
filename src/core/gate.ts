/**
 * Which screen comes before everything else (pure; app.ts renders it). In order:
 * 1. signin  — the app's own sign-in is required (AUTH_REQUIRED, phase 3) and nobody is signed in on this device;
 * 2. waiting — signed in, but a new family is still waiting for its inviter (or the super admin) to approve it;
 * 3. terms   — the terms are due: for a signed-in person, their account's acceptance (server); otherwise this device's.
 * The legal pages, sign-in and invite links always open, so anyone can read before they accept or join.
 */
import { termsDue, type Acceptance } from '../content/legal';

export type Gate = 'signin' | 'waiting' | 'terms' | null;

export interface AccountState {
  signedIn: boolean;
  /** The server asks everyone to sign in (AUTH_REQUIRED). */
  required: boolean;
  status?: 'pending' | 'active' | 'denied' | 'suspended';
  /** Until when this person's accepted terms hold (ms), from the server's daysLeft; null when due. */
  termsUntil?: number | null;
}

export const OPEN_ROUTES = ['signin', 'invite', 'about', 'terms', 'privacy'];

export function gateFor(route: string, account: AccountState, deviceTerms: Acceptance | null, now = Date.now()): Gate {
  if (OPEN_ROUTES.includes(route)) return null;
  if (account.required && !account.signedIn) return 'signin';
  if (account.signedIn && account.status === 'pending') return 'waiting';
  if (account.signedIn) return !account.termsUntil || now >= account.termsUntil ? 'terms' : null;
  return termsDue(deviceTerms, now) ? 'terms' : null;
}
