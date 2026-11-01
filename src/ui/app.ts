import { load } from '../core/storage';
import { configureSpeech, stopSpeaking, unlockSpeechOnFirstGesture } from '../voice/speech';
import { stopListening } from '../voice/recognition';
import { h } from './dom';
import { homeView, learnView, progressView, settingsView, toolkitView, topicView } from './views';
import { practiceView, reviewView } from './practice';
import { meetView } from './meet';

export interface View {
  title: string;
  el: HTMLElement;
  destroy?: () => void;
}

function route(hash: string): View {
  const [, a, b] = hash.replace(/^#/, '').split('/');
  switch (a) {
    case 'practice': return practiceView(b);
    case 'review': return reviewView();
    case 'meet': return meetView();
    case 'learn': return b ? topicView(b) : learnView();
    case 'toolkit': return toolkitView();
    case 'progress': return progressView();
    case 'settings': return settingsView();
    default: return homeView();
  }
}

export function startApp(root: HTMLElement): void {
  const s = load().settings;
  configureSpeech({ rate: s.rate, voiceURI: s.voiceURI, engine: s.voiceEngine, premiumVoice: s.premiumVoice });
  unlockSpeechOnFirstGesture();
  let current: View | undefined;
  const titleEl = h('h1', { class: 'page-title' });
  const back = h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Home' }, '🏠');
  const main = h('main', { id: 'main', tabindex: '-1' });
  const header = h('header', { class: 'topbar' },
    back, titleEl,
    h('span', { class: 'grade-badge', id: 'grade-badge' }),
    h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Settings' }, '⚙️'));
  root.replaceChildren(header, main);

  const render = () => {
    current?.destroy?.();
    stopSpeaking();
    stopListening();
    current = route(location.hash || '#/');
    titleEl.textContent = current.title;
    document.title = `${current.title} · CML Math Coach`;
    back.hidden = !location.hash || location.hash === '#/';
    (header.querySelector('#grade-badge') as HTMLElement).textContent = `Grade ${load().settings.grade}`;
    main.replaceChildren(current.el);
    main.focus({ preventScroll: true });
  };
  window.addEventListener('hashchange', render);
  render();
}
