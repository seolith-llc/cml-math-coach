import { describe, expect, it } from 'vitest';
import { BUDDIES, FIXED_LINES, MISS_LINES, RIGHT_LINES, buddySvg, pickLine, type Pose } from '../src/content/buddies';
import { BUDDY_KINDS } from '../src/core/storage';

const POSES: Pose[] = ['idle', 'happy', 'think', 'cheer', 'sleep'];

describe('game buddies', () => {
  it('every buddy draws in every pose, and poses look different', () => {
    for (const k of BUDDY_KINDS) {
      expect(BUDDIES[k].label).toBeTruthy();
      const svgs = POSES.map((p) => buddySvg(k, p));
      for (const s of svgs) {
        expect(s).toMatch(/^<svg [^>]*viewBox="0 0 120 120"/);
        expect(s.endsWith('</svg>')).toBe(true);
        expect(s).not.toMatch(/undefined|NaN/);
      }
      expect(new Set(svgs).size).toBe(POSES.length);
    }
    // each buddy is its own drawing
    expect(new Set(BUDDY_KINDS.map((k) => buddySvg(k))).size).toBe(BUDDY_KINDS.length);
  });

  it('praise is about effort and strategy, never ability, and never loss-framed', () => {
    for (const line of [...RIGHT_LINES, ...MISS_LINES, ...FIXED_LINES]) {
      expect(line, line).not.toMatch(/smart|genius|clever|brilliant|natural|wrong|fail|lost|bad/i);
    }
    expect(RIGHT_LINES.length).toBeGreaterThanOrEqual(6);
  });

  it('never says the same line twice in a row', () => {
    let last: string | undefined;
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) {
      const line = pickLine(RIGHT_LINES, last, rand);
      expect(line).not.toBe(last);
      last = line;
    }
  });
});
