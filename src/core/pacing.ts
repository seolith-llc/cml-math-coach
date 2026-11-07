/**
 * Timing for explanation playback (ms at 1× speed; the player divides by the speed).
 *
 *   lead:  let the picture move before the voice starts, so eyes and ears aren't competing.
 *   after: think time once the line ends; longer after the answer appears and at the end.
 *   read:  how long a silent step stays up, at a Grade 2–3 reading pace (~120 words a minute).
 */
export interface Pace {
  lead: number;
  after: number;
  read: number;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function pace(say: string, o: { first?: boolean; reveal?: boolean; last?: boolean } = {}): Pace {
  const n = words(say);
  const lead = o.first ? 250 : 450;
  const after = (o.last ? 1400 : o.reveal ? 1100 : 600) + Math.min(400, n * 20);
  const read = Math.max(2200, n * 500) + (o.reveal ? 800 : 0);
  return { lead, after, read };
}

/** Shortest believable time for speech to take; a voice that "finishes" faster than this failed silently. */
export const minSpeech = (say: string) => words(say) * 220;
