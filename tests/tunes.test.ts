import { describe, expect, it } from 'vitest';
import { TUNES, TUNE_INFO, barEvents, beatSeconds, midiToHz, musicLevel, sceneForRoute } from '../src/core/tunes';

describe('game music (composed in code)', () => {
  for (const tune of TUNES)
    it(`${tune}: soft, slow, every note inside its bar and in a gentle range`, () => {
      expect(TUNE_INFO[tune].bpm).toBeGreaterThanOrEqual(56);
      expect(TUNE_INFO[tune].bpm).toBeLessThanOrEqual(90); // calm, not a driving beat
      for (let bar = 0; bar < 64; bar++) {
        const ev = barEvents(tune, bar);
        expect(ev.length, `${tune} bar ${bar}`).toBeGreaterThan(0);
        for (const e of ev) {
          expect(e.beat).toBeGreaterThanOrEqual(0);
          expect(e.beat).toBeLessThan(4);
          expect(e.beats).toBeGreaterThan(0);
          expect(e.midi).toBeGreaterThanOrEqual(33); // no rumble
          expect(e.midi).toBeLessThanOrEqual(96); // no shrill highs
          expect(e.vel).toBeGreaterThan(0);
          expect(e.vel).toBeLessThanOrEqual(0.6);
        }
      }
    });

  it('is the same for the same bar, and varies from bar to bar', () => {
    for (const tune of TUNES) {
      expect(barEvents(tune, 9)).toEqual(barEvents(tune, 9));
      const shapes = new Set(Array.from({ length: 16 }, (_, b) => JSON.stringify(barEvents(tune, b))));
      expect(shapes.size, tune).toBeGreaterThan(4);
    }
  });

  it('three tunes that sound different', () => {
    const first = TUNES.map((t) => JSON.stringify(barEvents(t, 0).map((e) => e.voice)));
    expect(new Set(first).size).toBe(3);
  });

  it('ducks to near silence under the voice, quiet on questions, silent in tests', () => {
    expect(musicLevel('map', false)).toBe(1);
    expect(musicLevel('question', false)).toBeLessThan(0.5);
    expect(musicLevel('map', true)).toBeLessThanOrEqual(0.05);
    expect(musicLevel('question', true)).toBeLessThanOrEqual(0.05);
    expect(musicLevel('off', false)).toBe(0);
    expect(sceneForRoute('test')).toBe('off');
    expect(sceneForRoute('parent')).toBe('off');
    expect(sceneForRoute('practice')).toBe('question');
    expect(sceneForRoute('')).toBe('map');
    expect(sceneForRoute('world')).toBe('map');
  });

  it('pitch and tempo helpers', () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(81)).toBeCloseTo(880);
    expect(beatSeconds('breeze')).toBeCloseTo(60 / 64);
  });
});
