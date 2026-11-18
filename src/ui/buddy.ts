/**
 * The game-look buddy on screen (docs/GAME-MODE.md, phase 2): poses, a speech bubble (visual only; the coach voice
 * already talks), and walking along the progress stones during a round. Only shown with <html data-look="game">.
 */
import { load } from '../core/storage';
import { BUDDIES, FIXED_LINES, MISS_LINES, RIGHT_LINES, buddySvg, pickLine, type Pose } from '../content/buddies';
import { h } from './dom';
import { gameLook } from './fx';

export function buddyName(): string {
  const b = load().settings.buddy;
  return b ? b.name || BUDDIES[b.kind].label : '';
}

/** A buddy figure with a speech bubble. */
export function buddyView(size: 'big' | 'small' = 'big') {
  const b = load().settings.buddy;
  const kind = b?.kind ?? 'owl';
  const art = h('div', { class: 'buddy-art', html: buddySvg(kind, 'idle') });
  const bubble = h('div', { class: 'buddy-bubble', role: 'status', 'aria-live': 'polite', hidden: true });
  const el = h('div', { class: `buddy ${size} pose-idle`, 'aria-label': buddyName() || BUDDIES[kind].label }, bubble, art);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastLine: string | undefined;

  const pose = (p: Pose) => {
    art.innerHTML = buddySvg(kind, p);
    el.className = `buddy ${size} pose-${p}`;
  };
  /** Show a line for a while; the pose goes back to idle afterwards (unless `stay`). */
  const say = (text: string, p: Pose = 'happy', ms = 2200, stay = false) => {
    clearTimeout(timer);
    lastLine = text;
    bubble.textContent = text;
    bubble.hidden = false;
    pose(p);
    timer = setTimeout(() => {
      bubble.hidden = true;
      if (!stay) pose('idle');
    }, ms);
  };
  return { el, pose, say, last: () => lastLine };
}

/**
 * The buddy walking on the round's progress stones: one stone forward per answer, cheering a right one,
 * thinking with the child on a miss. Returns null outside the game look or before a buddy is chosen.
 */
export function trailBuddy(dotsEl: HTMLElement, scope: HTMLElement) {
  if (!gameLook() || !load().settings.buddy) return null;
  const buddy = buddyView('small');
  dotsEl.classList.add('has-buddy');
  dotsEl.append(buddy.el);
  const place = () => {
    const now = (dotsEl.querySelector('.dots > .now') ?? [...dotsEl.querySelectorAll('.dots > *')].pop()) as HTMLElement | undefined;
    if (!now) return;
    const host = dotsEl.getBoundingClientRect();
    const r = now.getBoundingClientRect();
    const x = r.left - host.left + r.width / 2;
    buddy.el.style.left = `${x}px`;
    // The bubble sits beside the buddy (never above it, where the top bar is), on the side with more room.
    buddy.el.classList.toggle('bubble-left', x > host.width / 2);
  };
  requestAnimationFrame(place);
  const onResize = () => place();
  window.addEventListener('resize', onResize);
  // Every checked answer on a card in this screen (fx.cheer): cheer a right one, think together on a miss.
  const onAnswer = (e: Event) => {
    const right = (e as CustomEvent<{ right: boolean }>).detail.right;
    if (right) buddy.say(pickLine(RIGHT_LINES, buddy.last()), 'happy');
    else buddy.say(pickLine(MISS_LINES, buddy.last()), 'think', 2600);
  };
  scope.addEventListener('pt:answer', onAnswer);
  return {
    /** After dots.update(): walk to the next stone. */
    place: () => requestAnimationFrame(place),
    fixed: () => buddy.say(pickLine(FIXED_LINES, buddy.last()), 'cheer'),
    cheer: (text: string) => buddy.say(text, 'cheer', 3000, true),
    destroy: () => {
      window.removeEventListener('resize', onResize);
      scope.removeEventListener('pt:answer', onAnswer);
    }
  };
}
