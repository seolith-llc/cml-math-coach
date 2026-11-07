import { describe, expect, it } from 'vitest';
import { minSpeech, pace } from '../src/core/pacing';

describe('explanation pacing', () => {
  const line = 'Take one triangle off both sides.';

  it('lets the picture move before speaking, less on the first frame', () => {
    expect(pace(line).lead).toBeGreaterThan(pace(line, { first: true }).lead);
  });

  it('pauses longer after the answer appears and longest at the end', () => {
    const plain = pace(line).after, reveal = pace(line, { reveal: true }).after, last = pace(line, { last: true }).after;
    expect(reveal).toBeGreaterThan(plain);
    expect(last).toBeGreaterThan(reveal);
  });

  it('gives longer lines more think time, within a cap', () => {
    expect(pace(`${line} ${line}`).after).toBeGreaterThan(pace(line).after);
    expect(pace(Array(200).fill('word').join(' ')).after).toBeLessThanOrEqual(1000);
  });

  it('silent steps stay up long enough for a Grade 2 reader (~120 wpm)', () => {
    expect(pace('Start with 4.').read).toBeGreaterThanOrEqual(2200);
    expect(pace(Array(20).fill('word').join(' ')).read).toBe(10000);
  });

  it('knows when speech ended suspiciously early', () => {
    expect(minSpeech(line)).toBe(6 * 220);
  });
});
