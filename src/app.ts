import { load } from './core/storage';
import { configureSpeech, stopSpeaking, unlockSpeechOnFirstGesture, voiceOptions } from './voice/speech';
import { stopListening } from './voice/recognition';
import { h, iconButton } from './ui/dom';
import { icon } from './ui/icons';
import { homeScreen } from './screens/home';
import { practiceScreen } from './screens/practice';
import { reviewScreen } from './screens/review';
import { meetScreen } from './screens/meet';
import { learnScreen, strategiesScreen, topicScreen } from './screens/learn';
import { progressScreen } from './screens/progress';
import { privacyScreen, settingsScreen } from './screens/settings';
import { parentScreen } from './screens/parent';

/** What every screen returns. `destroy` stops timers, speech and listening. */
export interface View {
  title: string;
  el: HTMLElement;
  destroy?: () => void;
}

/** #/<route>/<param>. One screen per file in src/screens. */
const routes: Record<string, (param?: string) => View> = {
  '': homeScreen,
  practice: practiceScreen,
  review: reviewScreen,
  meet: meetScreen,
  learn: (p) => (p === 'strategies' ? strategiesScreen() : p ? topicScreen(p) : learnScreen()),
  toolkit: strategiesScreen, // old link
  progress: progressScreen,
  settings: settingsScreen,
  privacy: privacyScreen,
  parent: (p) => (p ? parentScreen(p) : settingsScreen())
};

export function applyVoiceSettings(): void {
  const s = load().settings;
  configureSpeech(voiceOptions(s.voice, s.rate));
}

export function startApp(root: HTMLElement): void {
  applyVoiceSettings();
  unlockSpeechOnFirstGesture();
  let current: View | undefined;
  const title = h('h1', { class: 'bar-title' });
  const back = iconButton('back', 'Back', () => (history.length > 1 ? history.back() : (location.hash = '#/')), 'bar-back');
  const gear = h('a', { class: 'icon-btn bar-gear', href: '#/settings', 'aria-label': 'Settings', title: 'Settings', html: icon('gear') });
  const main = h('main', { id: 'main', tabindex: '-1' });
  root.replaceChildren(h('header', { class: 'bar' }, back, title, gear), main);

  const render = () => {
    current?.destroy?.();
    stopSpeaking();
    stopListening();
    const [, name = '', param] = location.hash.replace(/^#/, '').split('/');
    current = (routes[name] ?? routes[''])(param);
    const home = !name || !routes[name];
    title.textContent = home ? 'Math Coach' : current.title;
    document.title = home ? 'Math Coach' : `${current.title} · Math Coach`;
    // visibility (not display) keeps the three-column bar centered
    back.style.visibility = home || name === 'parent' ? 'hidden' : '';
    gear.style.visibility = name === 'settings' || name === 'parent' ? 'hidden' : '';
    main.replaceChildren(current.el);
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', render);
  render();
}
