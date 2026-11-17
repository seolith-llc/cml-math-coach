/**
 * Game-look music, composed in code (docs/GAME-MODE.md, phase 3): three soft instrumental tunes the child picks from.
 * No lyrics and no drums (lyrics hurt reading and memory; instrumental music didn't, in the research we follow).
 * Pure and deterministic: barEvents(tune, bar) says what to play in each 4-beat bar; voice/music.ts plays it.
 */
export type Tune = 'breeze' | 'bubbles' | 'stars';
export type TuneChoice = Tune | 'off';
export const TUNES: readonly Tune[] = ['breeze', 'bubbles', 'stars'];
export const TUNE_INFO: Record<Tune, { label: string; bpm: number }> = {
  breeze: { label: 'Breeze', bpm: 64 },
  bubbles: { label: 'Bubbles', bpm: 80 },
  stars: { label: 'Stars', bpm: 70 }
};

export type Voice = 'pad' | 'pluck' | 'bell' | 'bass';
export interface NoteEvent {
  /** Start, in beats from the start of the bar (0 ≤ beat < 4). */
  beat: number;
  midi: number;
  /** Length in beats. */
  beats: number;
  voice: Voice;
  /** Loudness 0–1 (the mixer keeps everything soft). */
  vel: number;
}

/** Chord roots and qualities per tune; four bars to a phrase. */
const CHORDS: Record<Tune, number[][]> = {
  breeze: [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]], // C, Am, F, G
  bubbles: [[48, 52, 55, 60], [41, 45, 48, 53], [45, 48, 52, 57], [43, 47, 50, 55]], // C, F, Am, G
  stars: [[41, 45, 48, 52], [40, 43, 47, 50], [38, 41, 45, 48], [36, 40, 43, 47]] // Fmaj7, Em7, Dm7, Cmaj7
};
const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76, 79];

/** A small seeded generator, so each bar is varied but always the same for the same bar. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const seedOf = (tune: Tune, bar: number) => (TUNES.indexOf(tune) + 1) * 7919 + bar * 104729;

export function barEvents(tune: Tune, bar: number): NoteEvent[] {
  const chord = CHORDS[tune][((bar % 4) + 4) % 4];
  const r = rng(seedOf(tune, bar));
  const out: NoteEvent[] = [];
  switch (tune) {
    case 'breeze': {
      // warm pad on the chord, a slow broken-chord arpeggio, a soft bass note
      for (const n of chord.slice(1)) out.push({ beat: 0, midi: n + 12, beats: 4, voice: 'pad', vel: 0.35 });
      out.push({ beat: 0, midi: chord[0], beats: 3.5, voice: 'bass', vel: 0.45 });
      const arp = [chord[1] + 24, chord[2] + 24, chord[3] + 24, chord[2] + 24];
      arp.forEach((m, i) => r() > 0.25 && out.push({ beat: i, midi: m, beats: 1, voice: 'pluck', vel: 0.3 + r() * 0.15 }));
      break;
    }
    case 'bubbles': {
      // marimba-like plucks wandering the pentatonic scale on 8ths, with rests; bass on 1 and 3
      let i = Math.floor(r() * 5) + 2;
      for (let k = 0; k < 8; k++) {
        if (r() < 0.35) continue;
        i = Math.max(0, Math.min(PENTATONIC.length - 1, i + Math.round((r() - 0.5) * 3)));
        out.push({ beat: k / 2, midi: PENTATONIC[i], beats: 0.5, voice: 'pluck', vel: 0.32 + r() * 0.15 });
      }
      out.push({ beat: 0, midi: chord[0], beats: 1.5, voice: 'bass', vel: 0.4 }, { beat: 2, midi: chord[0] + 7, beats: 1.5, voice: 'bass', vel: 0.32 });
      break;
    }
    case 'stars': {
      // a music box melody from the chord's tones, over a very soft pad
      for (const n of chord.slice(1)) out.push({ beat: 0, midi: n + 12, beats: 4, voice: 'pad', vel: 0.22 });
      const tones = chord.map((n) => n + 36);
      const rhythm = r() < 0.5 ? [0, 1, 1.5, 2, 3] : [0, 0.5, 1, 2, 2.5, 3];
      for (const b of rhythm) out.push({ beat: b, midi: tones[Math.floor(r() * tones.length)], beats: 0.75, voice: 'bell', vel: 0.28 + r() * 0.12 });
      break;
    }
  }
  return out;
}

/** Seconds per beat. */
export const beatSeconds = (tune: Tune) => 60 / TUNE_INFO[tune].bpm;

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Where the music is. Map screens play it; on questions it's very quiet; Tests and the parent area are silent. */
export type MusicScene = 'map' | 'question' | 'off';

/**
 * How loud the music is (0–1, before the child's volume). While the coach talks or the mic listens it ducks to near
 * silence, so it never competes with a question being read or answered.
 */
export function musicLevel(scene: MusicScene, voiceBusy: boolean): number {
  const base = scene === 'map' ? 1 : scene === 'question' ? 0.3 : 0;
  return voiceBusy ? Math.min(base, 0.05) : base;
}

/** Which scene a route is ('' and unknown routes are Home / the world map). */
export function sceneForRoute(route: string): MusicScene {
  if (route === 'test' || route === 'meet' || route === 'parent') return 'off'; // tests stay calm; the parent area is the parent's
  if (route === 'practice' || route === 'review' || route === 'round') return 'question';
  return 'map';
}
