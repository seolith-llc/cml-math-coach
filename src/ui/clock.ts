import { Countdown, formatClock, warnAt } from '../core/session';
import { h } from './dom';

export interface Clock {
  el: HTMLElement;
  /** Start (or restart) counting down from `seconds`. */
  start(seconds: number): void;
  stop(): void;
  /** Seconds used since the last start. */
  used(): number;
}

/**
 * Countdown face. Runs on wall-clock time, turns red near the end, calls onWarn once and onExpire once.
 */
export function clock(onExpire: () => void, onWarn?: () => void): Clock {
  const el = h('span', { class: 'clock', role: 'timer', 'aria-live': 'off' });
  let timer = 0;
  let cd: Countdown | undefined;
  let warned = false;
  let startedAt = 0;
  const tick = () => {
    if (!cd) return;
    const now = Date.now();
    const left = cd.left(now);
    el.textContent = formatClock(left);
    const warn = left <= warnAt(cd.seconds);
    el.classList.toggle('warn', warn);
    if (warn && !warned) {
      warned = true;
      onWarn?.();
    }
    if (cd.expired(now)) {
      api.stop();
      onExpire();
    }
  };
  const api: Clock = {
    el,
    start(seconds) {
      api.stop();
      startedAt = Date.now();
      cd = new Countdown(seconds, startedAt);
      warned = false;
      tick();
      timer = window.setInterval(tick, 250);
    },
    stop() {
      clearInterval(timer);
      timer = 0;
    },
    used: () => Math.round((Date.now() - startedAt) / 1000)
  };
  return api;
}
