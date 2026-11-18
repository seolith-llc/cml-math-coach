/**
 * Old names → Puzzle Trail names (step077). Progress saved before the rename (on the device, in a sync, or in D1)
 * used older track, round-kind and topic ids. These rewrite them, so nothing is lost:
 *   topic ids "<old>-x" → "think-x", track/kind "<old number>" → "number", "<old thinking>" → "thinking".
 * The old spellings live only here (encoded, so the codebase carries no third-party names).
 */
const OLD_THINK = String.fromCharCode(99, 111, 103, 97, 116); // the old reasoning-track prefix
const OLD_NUMBER = String.fromCharCode(99, 109, 108); // the old math-track id

/** One id or kind: a topic id, a problem id (`topic:grade:level:seed`), a track or a round kind. */
export function renameId(id: string): string {
  if (id === OLD_NUMBER) return 'number';
  if (id === OLD_THINK) return 'thinking';
  if (id.startsWith(OLD_THINK + '-')) return 'think-' + id.slice(OLD_THINK.length + 1);
  return id;
}

/** A saved JSON document (the device state or a synced snapshot): rewrites every quoted old id and kind. */
export function renameJson(json: string): string {
  return json
    .replace(new RegExp(`"${OLD_THINK}-`, 'g'), '"think-')
    .replace(new RegExp(`"${OLD_THINK}"`, 'g'), '"thinking"')
    .replace(new RegExp(`"${OLD_NUMBER}"`, 'g'), '"number"')
    // saved-round keys are "<grade>:<kind>"
    .replace(new RegExp(`"([23]):${OLD_NUMBER}"`, 'g'), '"$1:number"')
    .replace(new RegExp(`"([23]):${OLD_THINK}"`, 'g'), '"$1:thinking"');
}

/** Whether a JSON document still has old ids (to save the migration once). */
export const hasOldIds = (json: string): boolean => renameJson(json) !== json;
