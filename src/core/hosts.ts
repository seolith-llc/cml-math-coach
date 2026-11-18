/** Where the app lives (phase 3, step080); shared by the app and the server (server/hosts.ts). */
export const NEW_HOST = 'puzzletrail.seolith.com';
export const OLD_HOSTS: readonly string[] = ['cml-math-coach.seolith.com'];
export const NEW_ORIGIN = `https://${NEW_HOST}`;

/**
 * Whether the old address sends devices to the new one. Turned on only once NEW_HOST is attached and serving
 * (Actions → Deploy prints "✔ <host> is active on Pages").
 */
export const MOVE_ON = true;

/** Which saved progress to keep when a device arrives with progress from the old address: the one with more answers. */
export function pickState(here: string | null, incoming: string): string {
  const answers = (raw: string | null) => {
    try {
      const s = raw ? JSON.parse(raw) : null;
      return Array.isArray(s?.log) ? s.log.length : 0;
    } catch {
      return -1;
    }
  };
  return answers(incoming) >= answers(here) ? incoming : (here as string);
}
