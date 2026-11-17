import { BUDDY_KINDS, load, save, type BuddyKind } from '../core/storage';
import { BUDDIES, buddySvg } from '../content/buddies';
import { h } from '../ui/dom';
import { sfx } from '../voice/music';
import type { View } from '../app';

/**
 * #/buddy: pick a buddy and name it (game look). Chosen once; changeable from Settings.
 * Nothing to dress up or buy: the buddy is a companion, not the game (docs/GAME-MODE.md refinement 2).
 */
export function buddyScreen(): View {
  const state = load();
  let kind: BuddyKind = state.settings.buddy?.kind ?? 'owl';
  const name = h('input', { class: 'answer buddy-name', type: 'text', maxlength: 16, autocomplete: 'off', placeholder: BUDDIES[kind].label, 'aria-label': 'Buddy name', value: state.settings.buddy?.name ?? '' });
  const tiles = BUDDY_KINDS.map((k) => {
    const b = h('button', { class: `buddy-tile${k === kind ? ' picked' : ''}`, type: 'button', 'aria-label': BUDDIES[k].label, 'aria-pressed': String(k === kind), onclick: () => {
      sfx('pop');
      kind = k;
      tiles.forEach((t, i) => {
        t.classList.toggle('picked', BUDDY_KINDS[i] === k);
        t.setAttribute('aria-pressed', String(BUDDY_KINDS[i] === k));
      });
      name.placeholder = BUDDIES[k].label;
    } }, h('span', { class: 'buddy-tile-art', html: buddySvg(k, 'happy') }), h('span', { class: 'buddy-tile-label' }, BUDDIES[k].label));
    return b;
  });
  const go = h('button', { class: 'btn primary hero', type: 'button', onclick: () => {
    state.settings.buddy = { kind, name: name.value.trim().slice(0, 16) };
    save(state);
    location.hash = '#/';
  } }, "Let's go");
  return { title: 'Your buddy', el: h('div', { class: 'stack buddy-pick' }, h('div', { class: 'buddy-tiles', role: 'group', 'aria-label': 'Buddies' }, ...tiles), name, go) };
}
