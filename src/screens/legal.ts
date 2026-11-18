import { load, save } from '../core/storage';
import { APP_NAME, DISCLAIMER, PRIVACY, TERMS, TERMS_VERSION, type Section } from '../content/legal';
import { group, h } from '../ui/dom';
import type { View } from '../app';

const date = new Date(`${TERMS_VERSION}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function sections(list: Section[]): HTMLElement[] {
  return list.map((s) =>
    group(s.title, s.list ? h('ul', { class: 'bullets' }, ...s.body.map((x) => h('li', {}, x))) : h('div', { class: 'legal-text' }, ...s.body.map((x) => h('p', {}, x)))));
}

/** #/privacy */
export function privacyScreen(): View {
  return { title: 'Privacy', el: h('div', { class: 'stack legal' }, h('p', { class: 'legal-date' }, date), ...sections(PRIVACY)) };
}

/** #/terms */
export function termsScreen(): View {
  return { title: 'Terms', el: h('div', { class: 'stack legal' }, h('p', { class: 'legal-date' }, date), ...sections(TERMS)) };
}

/** #/about: what the app is, and what it is not. */
export function aboutScreen(): View {
  return { title: 'About', el: h('div', { class: 'stack legal' }, group(APP_NAME, h('div', { class: 'legal-text' }, h('p', {}, DISCLAIMER)))) };
}

/**
 * Shown instead of any screen until the terms are accepted on this device, and again every 30 days or when they change
 * (content/legal.ts termsDue). The terms and privacy policy are on the page itself, so nothing needs a second tap to read.
 */
export function acceptScreen(onAccept: () => void): View {
  const box = h('input', { type: 'checkbox', id: 'accept-terms' }) as HTMLInputElement;
  const go = h('button', { class: 'btn primary hero', type: 'button', disabled: true, onclick: () => {
    const state = load();
    state.settings.terms = { version: TERMS_VERSION, at: Date.now() };
    save(state);
    onAccept();
  } }, 'Accept') as HTMLButtonElement;
  box.addEventListener('change', () => { go.disabled = !box.checked; });
  return {
    title: APP_NAME,
    el: h('div', { class: 'stack legal accept' },
      group(null, h('div', { class: 'legal-text' }, h('p', {}, DISCLAIMER))),
      h('h2', { class: 'legal-h' }, 'Terms of use'),
      ...sections(TERMS),
      h('h2', { class: 'legal-h' }, 'Privacy policy'),
      ...sections(PRIVACY),
      h('section', { class: 'card accept-card' },
        h('label', { class: 'accept-row', for: 'accept-terms' }, box,
          h('span', {}, `I am a parent or guardian, 18 or older. I accept the terms of use and the privacy policy (${date}) for my family.`)),
        go))
  };
}
