/**
 * Is the app talking or listening right now? The game music (voice/music.ts) ducks under both.
 * speech.ts and recognition.ts report here; changes go out as a 'pt:voice' window event.
 */
let speaking = false;
let listening = false;

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pt:voice', { detail: { speaking, listening } }));
}

export function setSpeaking(v: boolean): void {
  if (speaking === v) return;
  speaking = v;
  emit();
}

export function setListening(v: boolean): void {
  if (listening === v) return;
  listening = v;
  emit();
}

export const voiceBusy = () => speaking || listening;
