import { describe, expect, it } from 'vitest';
import { gateFor } from '../src/core/gate';
import { TERMS_VERSION } from '../src/content/legal';

const now = Date.UTC(2026, 10, 18);
const fresh = { version: TERMS_VERSION, at: now - 1000 };

describe('the gate before every screen (step078)', () => {
  it('before sign-in is required: the device acceptance decides, as in phase 1', () => {
    expect(gateFor('', { signedIn: false, required: false }, null, now)).toBe('terms');
    expect(gateFor('', { signedIn: false, required: false }, fresh, now)).toBeNull();
  });
  it('once required: sign in first, then wait for approval, then the account’s terms', () => {
    expect(gateFor('practice', { signedIn: false, required: true }, fresh, now)).toBe('signin');
    expect(gateFor('', { signedIn: true, required: true, status: 'pending' }, fresh, now)).toBe('waiting');
    expect(gateFor('', { signedIn: true, required: true, status: 'active', termsUntil: null }, fresh, now)).toBe('terms');
    expect(gateFor('', { signedIn: true, required: true, status: 'active', termsUntil: now + 5 }, null, now)).toBeNull();
    expect(gateFor('', { signedIn: true, required: true, status: 'active', termsUntil: now - 5 }, fresh, now)).toBe('terms');
  });
  it('always lets the legal pages, sign-in and invite links open', () => {
    for (const r of ['signin', 'invite', 'about', 'terms', 'privacy']) expect(gateFor(r, { signedIn: false, required: true }, null, now)).toBeNull();
  });
});
