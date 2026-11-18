import { load } from './core/storage';
import { sceneForRoute } from './core/tunes';
import { setMusicScene, startSound } from './voice/music';
import { configureSpeech, stopSpeaking, unlockSpeechOnFirstGesture, voiceOptions } from './voice/speech';
import { stopListening } from './voice/recognition';
import { applyHighlight, applyLook, h, iconButton } from './ui/dom';
import { musicToggle } from './ui/musicToggle';
import { icon } from './ui/icons';
import { homeScreen } from './screens/home';
import { islandScreen, worldScreen } from './screens/world';
import { buddyScreen } from './screens/buddy';
import { stickersScreen } from './screens/stickers';
import { practiceScreen } from './screens/practice';
import { reviewScreen } from './screens/review';
import { testScreen } from './screens/test';
import { learnScreen, strategiesScreen, topicScreen } from './screens/learn';
import { progressScreen } from './screens/progress';
import { settingsScreen } from './screens/settings';
import { aboutScreen, acceptScreen, privacyScreen, termsScreen } from './screens/legal';
import { TERMS_VERSION } from './content/legal';
import { gateFor } from './core/gate';
import { account, acceptTermsOnAccount, refreshAccount } from './sync/account';
import { adminScreen, inviteScreen, peopleScreen, signinScreen, waitingScreen } from './screens/account';
import { familyScreen, parentScreen } from './screens/parent';
import { handoffScreen, movedScreen } from './screens/move';
import { bigScreen } from './screens/big';
import { moveFromOldHost, movedAlready, onOldHost } from './sync/move';
import { thinkingScreen } from './screens/thinking';
import { roundScreen } from './screens/round';
import { openFeedback } from './ui/feedbackSheet';

/** What every screen returns. `destroy` stops timers, speech and listening. */
export interface View {
  title: string;
  el: HTMLElement;
  destroy?: () => void;
}

/** #/<route>/<param>. One screen per file in src/screens. */
const routes: Record<string, (param?: string) => View> = {
  // Game look: the world map is Home (after choosing a buddy once). Classic look: the usual Home.
  '': () => (load().settings.look !== 'game' ? homeScreen() : load().settings.buddy ? worldScreen() : buddyScreen()),
  world: (p) => (p ? islandScreen(p) : worldScreen()),
  buddy: buddyScreen,
  stickers: stickersScreen,
  practice: practiceScreen,
  review: reviewScreen,
  test: testScreen,
  meet: testScreen, // old link
  learn: (p) => (p === 'strategies' ? strategiesScreen() : p ? topicScreen(p) : learnScreen()),
  toolkit: strategiesScreen, // old link
  thinking: thinkingScreen,
  round: roundScreen,
  progress: progressScreen,
  settings: settingsScreen,
  privacy: privacyScreen,
  terms: termsScreen,
  about: aboutScreen,
  signin: signinScreen,
  invite: inviteScreen,
  people: peopleScreen,
  admin: adminScreen,
  family: familyScreen,
  handoff: handoffScreen,
  big: bigScreen,
  parent: (p) => (p ? parentScreen(p) : settingsScreen())
};

export function applyVoiceSettings(): void {
  const s = load().settings;
  configureSpeech(voiceOptions(s.voice, s.rate));
}

export function startApp(root: HTMLElement): void {
  applyHighlight(load().settings.highlight);
  applyLook(load().settings.look, load().settings.motion);
  startSound();
  applyVoiceSettings();
  unlockSpeechOnFirstGesture();
  let current: View | undefined;
  const title = h('h1', { class: 'bar-title' });
  const back = iconButton('back', 'Back', () => (history.length > 1 ? history.back() : (location.hash = '#/')), 'bar-back');
  const gear = h('a', { class: 'icon-btn bar-gear', href: '#/settings', 'aria-label': 'Settings', title: 'Settings', html: icon('gear') });
  const homeLink = h('a', { class: 'icon-btn bar-home', href: '#/', 'aria-label': 'Home', title: 'Home', html: icon('home') });
  const main = h('main', { id: 'main', tabindex: '-1' });
  const feedback = iconButton('feedback', 'Feedback', () => openFeedback());
  const music = musicToggle(); // game look: stop or bring back the music from any screen
  root.replaceChildren(h('header', { class: 'bar' }, h('div', { class: 'bar-start' }, back, homeLink), title, h('div', { class: 'bar-end' }, music.el, feedback, gear)), main);

  // The old address, once this device has moved, only points to the new one (sync/move.ts).
  const moved = onOldHost() && movedAlready();
  let shownGate: ReturnType<typeof gateFor> = null;
  const render = () => {
    current?.destroy?.();
    stopSpeaking();
    stopListening();
    const [, name = '', param] = location.hash.replace(/^#/, '').split('/');
    // Before any screen (core/gate.ts): sign in (once required), wait for approval, then accept the terms
    // (the account's, or this device's before sign-in is required) every 30 days or when they change.
    const gate = gateFor(name, account(), load().settings.terms);
    shownGate = gate;
    current =
      moved ? movedScreen()
      : gate === 'signin' ? signinScreen()
      : gate === 'waiting' ? waitingScreen()
      : gate === 'terms' ? acceptScreen(() => void acceptTermsOnAccount(TERMS_VERSION).then(render))
      : (routes[name] ?? routes[''])(param);
    setMusicScene(sceneForRoute(routes[name] ? name : ''));
    const home = gate || !name || !routes[name];
    title.textContent = home ? 'Puzzle Trail' : current.title;
    document.title = home ? 'Puzzle Trail' : `${current.title} · Puzzle Trail`;
    // visibility (not display) keeps the three-column bar centered
    // The parent dashboard keeps Back and Home too: opened from the child's Home row, it needs a way back.
    back.style.visibility = home ? 'hidden' : '';
    homeLink.style.visibility = home ? 'hidden' : '';
    gear.style.visibility = name === 'settings' || name === 'parent' ? 'hidden' : '';
    feedback.hidden = name === 'parent'; // the parent dashboard is its own page
    main.replaceChildren(current.el);
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', render);
  // Who is signed in: at start, when the app comes back to the front, and whenever the answer changes the gate.
  // (only when the gate for this screen changes, so a round in progress is never thrown away)
  window.addEventListener('pt:account', () => {
    const name = location.hash.replace(/^#/, '').split('/')[1] ?? '';
    if (gateFor(name, account(), load().settings.terms) !== shownGate) render();
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void refreshAccount());
  render();
  void refreshAccount();
  void moveFromOldHost();
}
