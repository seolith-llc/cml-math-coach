import { load } from '../core/storage';
import { STICKER_LABELS, stickerSvg } from '../content/stickers';
import { h } from '../ui/dom';
import { buddyView } from '../ui/buddy';
import type { View } from '../app';

/**
 * #/stickers: the sticker book (game look). Only what was collected, newest first, each with what earned it.
 * No empty slots and no "x of 24": nothing to complete (docs/GAME-MODE.md guardrails).
 */
export function stickersScreen(): View {
  const all = [...(load().stickers ?? [])].reverse();
  if (!all.length) {
    const buddy = buddyView('big');
    buddy.say('Finish a round to find a sticker!', 'happy', 8000, true);
    return { title: 'Sticker book', el: h('div', { class: 'stack' }, h('section', { class: 'card round-cheer' }, buddy.el), h('a', { class: 'btn primary hero', href: '#/practice' }, 'Play')) };
  }
  const day = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return {
    title: 'Sticker book',
    el: h('div', { class: 'stack' },
      h('section', { class: 'card sticker-book', role: 'list', 'aria-label': `${all.length} stickers` },
        ...all.map((st) => h('div', { class: 'sticker-cell', role: 'listitem' },
          h('span', { class: 'sticker-art', html: stickerSvg(st.design) }),
          h('span', { class: 'sticker-why' }, STICKER_LABELS[st.kind]),
          h('span', { class: 'sticker-day' }, day(st.at))))))
  };
}
