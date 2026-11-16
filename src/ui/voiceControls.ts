import { load, save } from '../core/storage';
import { speak, stopSpeaking } from '../voice/speech';
import { icon } from './icons';
import { h, iconButton } from './dom';

/**
 * Pause/Play and Mute for a question, the same pair the explanation player has.
 * - Play reads the question; while anything is being said, it shows Pause, and Pause stops the voice.
 * - Mute is the Read aloud setting: muted, new questions and the coach's spoken feedback stay quiet
 *   until it's unmuted (on any question, the player or in Settings). Play still reads when tapped.
 */
export function voiceControls(text: () => string) {
  const state = load();
  let speaking = false;
  let turn = 0;

  const play = iconButton('play', 'Read aloud', () => (speaking ? stop() : void talk(text())), 'play-main');
  const mute = iconButton('speaker', 'Mute', () => {
    state.settings.speak = !state.settings.speak;
    save(state);
    if (!state.settings.speak) stop();
    show();
  }, 'voice');

  function show() {
    play.innerHTML = icon(speaking ? 'pause' : 'play');
    play.setAttribute('aria-label', speaking ? 'Pause' : 'Read aloud');
    play.title = speaking ? 'Pause' : 'Read aloud';
    const on = state.settings.speak;
    mute.innerHTML = icon(on ? 'speaker' : 'speakerOff');
    mute.setAttribute('aria-label', on ? 'Mute' : 'Unmute');
    mute.title = on ? 'Mute' : 'Unmute';
    mute.setAttribute('aria-pressed', String(!on));
    mute.classList.toggle('off', !on);
  }

  /** Say something about this question; Play turns into Pause until it's done (or stopped). */
  async function talk(t: string): Promise<void> {
    const mine = ++turn;
    speaking = true;
    show();
    await speak(t);
    if (mine === turn) {
      speaking = false;
      show();
    }
  }

  function stop() {
    turn++;
    stopSpeaking();
    speaking = false;
    show();
  }

  show();
  return {
    el: h('span', { class: 'voice-controls' }, play, mute),
    talk,
    stop,
    /** Muted with the Mute button (the Read aloud setting is off). */
    muted: () => !state.settings.speak
  };
}
