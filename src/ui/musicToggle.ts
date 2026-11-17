import { load, save } from '../core/storage';
import { toggleTune } from '../core/tunes';
import { musicScene, refreshSound } from '../voice/music';
import { icon } from './icons';
import { iconButton } from './dom';

const LAST = 'cml-last-tune';

/**
 * The music on/off button in the top bar: game look only, on every screen where music can play
 * (hidden in Tests and the parent area, where it is silent anyway). Off is the same as Settings → Music → Off,
 * so it holds on every screen until turned back on; on brings back the last tune.
 */
export function musicToggle(): { el: HTMLButtonElement; sync: () => void } {
  const el = iconButton('music', 'Music off', () => {
    const state = load();
    let last: string | null = null;
    try { last = localStorage.getItem(LAST); } catch { /* private mode */ }
    const next = toggleTune(state.settings.music.tune, last);
    state.settings.music.tune = next.tune;
    save(state);
    try { if (next.last) localStorage.setItem(LAST, next.last); } catch { /* private mode */ }
    refreshSound();
  }, 'bar-music');

  const sync = () => {
    const s = load().settings;
    el.hidden = s.look !== 'game' || musicScene() === 'off';
    const on = s.music.tune !== 'off';
    el.innerHTML = icon(on ? 'music' : 'musicOff');
    const label = on ? 'Music off' : 'Music on';
    el.setAttribute('aria-label', label);
    el.title = label;
    el.setAttribute('aria-pressed', String(!on));
    el.classList.toggle('off', !on);
  };
  window.addEventListener('cml:music', sync);
  sync();
  return { el, sync };
}
