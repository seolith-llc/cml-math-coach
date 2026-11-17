/**
 * The four game-look buddies (docs/GAME-MODE.md, phase 2). Original drawings made of simple shapes, in-house.
 * buddySvg() is pure (a string), so it's testable without a DOM. Poses change the eyes, mouth and arms;
 * the motion itself (bob, hop, wave) is CSS on the wrapper, so reduced motion stops it.
 */
import type { BuddyKind } from '../core/storage';

export type Pose = 'idle' | 'happy' | 'think' | 'cheer' | 'sleep';

export const BUDDIES: Record<BuddyKind, { label: string; body: string; belly: string; accent: string }> = {
  owl: { label: 'Owl', body: '#7b5cff', belly: '#efe9ff', accent: '#ffb703' },
  fox: { label: 'Fox', body: '#ff8a3d', belly: '#fff3e6', accent: '#3a2a1f' },
  bunny: { label: 'Bunny', body: '#ff8ac6', belly: '#fff0f7', accent: '#c2368f' },
  dino: { label: 'Dino', body: '#2ec4b6', belly: '#e3fbf8', accent: '#8ac926' }
};

/** Ears, tufts, spikes: what makes each buddy itself (drawn behind the body). */
function features(kind: BuddyKind): string {
  const { body, accent, belly } = BUDDIES[kind];
  switch (kind) {
    case 'owl': return `<path d="M34 30 L40 10 L52 26 Z M86 30 L80 10 L68 26 Z" fill="${body}"/>`;
    case 'fox': return `<path d="M30 34 L36 8 L56 26 Z M90 34 L84 8 L64 26 Z" fill="${body}"/><path d="M36 28 L38 16 L48 25 Z M84 28 L82 16 L72 25 Z" fill="${belly}"/>`;
    case 'bunny': return `<ellipse cx="46" cy="16" rx="8" ry="22" fill="${body}"/><ellipse cx="74" cy="16" rx="8" ry="22" fill="${body}"/><ellipse cx="46" cy="18" rx="4" ry="15" fill="${belly}"/><ellipse cx="74" cy="18" rx="4" ry="15" fill="${belly}"/>`;
    case 'dino': return `<path d="M44 24 L50 10 L56 22 L62 8 L68 22 L74 10 L80 26 Z" fill="${accent}"/>`;
  }
}

function face(kind: BuddyKind, pose: Pose): string {
  const ink = '#1d1d2c';
  const { accent } = BUDDIES[kind];
  const rings = kind === 'owl' ? `<circle cx="47" cy="50" r="12" fill="#fff"/><circle cx="73" cy="50" r="12" fill="#fff"/>` : '';
  const eyes =
    pose === 'happy' || pose === 'cheer' ? `<path d="M40 52 Q47 43 54 52 M66 52 Q73 43 80 52" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    : pose === 'sleep' ? `<path d="M40 52 Q47 57 54 52 M66 52 Q73 57 80 52" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    : pose === 'think' ? `<circle cx="49" cy="47" r="5" fill="${ink}"/><circle cx="75" cy="47" r="5" fill="${ink}"/><path d="M66 36 L82 33" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="47" cy="51" r="5.5" fill="${ink}"/><circle cx="73" cy="51" r="5.5" fill="${ink}"/><circle cx="49" cy="49" r="1.8" fill="#fff"/><circle cx="75" cy="49" r="1.8" fill="#fff"/>`;
  const nose = kind === 'owl' ? `<path d="M55 58 L65 58 L60 66 Z" fill="${accent}"/>` : kind === 'fox' ? `<ellipse cx="60" cy="60" rx="5" ry="3.5" fill="${accent}"/>` : kind === 'bunny' ? `<ellipse cx="60" cy="60" rx="3.5" ry="2.5" fill="${accent}"/>` : '';
  const mouth =
    pose === 'cheer' ? `<path d="M48 68 Q60 84 72 68 Z" fill="${ink}"/><path d="M53 74 Q60 80 67 74" fill="#ff6b9a"/>`
    : pose === 'happy' ? `<path d="M48 68 Q60 80 72 68" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    : pose === 'think' ? `<circle cx="64" cy="71" r="3.5" fill="none" stroke="${ink}" stroke-width="3"/>`
    : pose === 'sleep' ? `<path d="M55 71 L65 71" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><text x="88" y="30" font-size="16" font-weight="700" fill="${ink}" font-family="system-ui">z</text><text x="98" y="18" font-size="11" font-weight="700" fill="${ink}" font-family="system-ui">z</text>`
    : `<path d="M51 69 Q60 76 69 69" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  const cheeks = `<circle cx="38" cy="64" r="5" fill="#ff6b9a" opacity=".35"/><circle cx="82" cy="64" r="5" fill="#ff6b9a" opacity=".35"/>`;
  return rings + eyes + nose + mouth + cheeks;
}

function arms(kind: BuddyKind, pose: Pose): string {
  const c = BUDDIES[kind].body;
  const arm = (d: string) => `<path d="${d}" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  switch (pose) {
    case 'cheer': return arm('M30 78 L14 52') + arm('M90 78 L106 52');
    case 'happy': return arm('M30 82 L16 70') + arm('M90 82 L104 70');
    case 'sleep': return arm('M90 80 L104 60'); // one arm waves goodnight
    case 'think': return arm('M30 84 L20 96') + arm('M90 82 L74 70');
    default: return arm('M30 84 L20 98') + arm('M90 84 L100 98');
  }
}

/** An original buddy in a pose, as SVG markup (120×120). */
export function buddySvg(kind: BuddyKind, pose: Pose = 'idle'): string {
  const { body, belly, accent } = BUDDIES[kind];
  const tail = kind === 'dino' ? `<path d="M92 96 Q114 96 112 78" stroke="${body}" stroke-width="10" fill="none" stroke-linecap="round"/>`
    : kind === 'fox' ? `<path d="M90 98 Q116 100 110 76" stroke="${body}" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="110" cy="76" r="5" fill="#fff"/>` : '';
  return `<svg class="buddy-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<ellipse cx="60" cy="114" rx="30" ry="4" fill="#000" opacity=".12"/>` +
    tail + features(kind) + arms(kind, pose) +
    `<ellipse cx="60" cy="68" rx="32" ry="40" fill="${body}"/>` +
    `<ellipse cx="60" cy="84" rx="20" ry="20" fill="${belly}"/>` +
    `<ellipse cx="46" cy="108" rx="9" ry="5" fill="${accent}"/><ellipse cx="74" cy="108" rx="9" ry="5" fill="${accent}"/>` +
    face(kind, pose) +
    `</svg>`;
}

/* ---------------- what the buddy says (docs/GAME-MODE.md refinement 5) ----------------
   Praise names effort and strategy, never ability ("smart"), and varies so it doesn't become a payout. */

export const RIGHT_LINES = ['You worked it out!', 'Careful thinking!', 'Nice checking!', 'You stuck with it!', 'Step by step. Yes!', 'Great focus!', 'You read it closely!', 'Good plan!'];
export const MISS_LINES = ["Let's look together.", "Tricky one. Let's see.", 'Good try. Let me show you.', 'Mistakes help us learn.'];
export const FIXED_LINES = ['You fixed it!', 'You went back and got it!', 'Trying again works!'];

/** A line that differs from the last one said. */
export function pickLine(lines: readonly string[], last?: string, rand: () => number = Math.random): string {
  const options = lines.filter((l) => l !== last);
  return options[Math.floor(rand() * options.length)] ?? lines[0];
}
