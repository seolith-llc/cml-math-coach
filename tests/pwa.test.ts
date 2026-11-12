import { describe, expect, it } from 'vitest';
import { isSignedOut } from '../src/pwa';

describe('signed-out detection (Cloudflare Access)', () => {
  it('treats the sign-in redirect or a refusal as signed out', () => {
    expect(isSignedOut({ type: 'opaqueredirect', status: 0 })).toBe(true);
    expect(isSignedOut({ type: 'basic', status: 403 })).toBe(true);
    expect(isSignedOut({ type: 'basic', status: 401 })).toBe(true);
  });
  it('keeps going when the app answered', () => {
    expect(isSignedOut({ type: 'basic', status: 200 })).toBe(false);
    expect(isSignedOut({ type: 'basic', status: 304 })).toBe(false);
  });
});
