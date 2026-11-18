import { describe, expect, it } from 'vitest';
import { ACCEPT_DAYS, DISCLAIMER, PRIVACY, TERMS, TERMS_VERSION, daysLeft, termsDue } from '../src/content/legal';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 18, 12);

describe('terms: accepted 30 days at a time (step077)', () => {
  it('is due when never accepted, for an older version, or after 30 days', () => {
    expect(termsDue(null, now)).toBe(true);
    expect(termsDue({ version: '2000-01-01', at: now }, now)).toBe(true);
    expect(termsDue({ version: TERMS_VERSION, at: now - (ACCEPT_DAYS - 1) * DAY }, now)).toBe(false);
    expect(termsDue({ version: TERMS_VERSION, at: now - ACCEPT_DAYS * DAY }, now)).toBe(true);
  });
  it('is due again if the clock says it was accepted in the future (a changed device clock)', () => {
    expect(termsDue({ version: TERMS_VERSION, at: now + 3 * DAY }, now)).toBe(true);
  });
  it('counts the days left', () => {
    expect(daysLeft({ version: TERMS_VERSION, at: now }, now)).toBe(30);
    expect(daysLeft({ version: TERMS_VERSION, at: now - 29.5 * DAY }, now)).toBe(1);
    expect(daysLeft(null, now)).toBe(0);
  });
  it('says plainly that the app is not official, and names no third party', () => {
    expect(DISCLAIMER).toMatch(/not affiliated with, endorsed by, sponsored by, or sanctioned by/);
    const all = JSON.stringify([DISCLAIMER, PRIVACY, TERMS]);
    expect(all).not.toMatch(new RegExp(String.fromCharCode(99, 111, 103, 97, 116) + '|' + String.fromCharCode(99, 109, 108) + '\\b', 'i'));
    expect(all).not.toMatch(/youtube/i);
  });
});

