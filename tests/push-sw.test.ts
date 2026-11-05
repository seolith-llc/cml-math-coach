import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

/** Runs public/push-sw.js against a fake service-worker global. */
function loadWorker() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const shown: unknown[] = [];
  const win = { focus: vi.fn(async () => 'focused'), navigate: vi.fn() };
  const self = {
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    registration: { scope: 'https://cml-math-coach.seolith.com/', showNotification: vi.fn(async (title: string, opts: unknown) => shown.push({ title, opts })) },
    clients: { matchAll: vi.fn(async () => [win]), openWindow: vi.fn() }
  };
  runInNewContext(readFileSync('public/push-sw.js', 'utf8'), { self, URL });
  return { handlers, shown, self, win };
}

describe('service worker push handler', () => {
  it('shows the reminder from the encrypted payload', async () => {
    const { handlers, shown } = loadWorker();
    let wait: Promise<unknown> = Promise.resolve();
    handlers.push({ data: { json: () => ({ title: 'Math Coach', body: "Sam, ready for today's 10?", url: './#/practice' }) }, waitUntil: (p: Promise<unknown>) => (wait = p) });
    await wait;
    expect(shown).toEqual([{ title: 'Math Coach', opts: { body: "Sam, ready for today's 10?", icon: 'icon-192.png', badge: 'icon-192.png', tag: 'daily-practice', data: { url: './#/practice' } } }]);
  });
  it('opens Practice in the existing window when tapped', async () => {
    const { handlers, win } = loadWorker();
    let wait: Promise<unknown> = Promise.resolve();
    const close = vi.fn();
    handlers.notificationclick({ notification: { close, data: { url: './#/practice' } }, waitUntil: (p: Promise<unknown>) => (wait = p) });
    await wait;
    expect(close).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith('https://cml-math-coach.seolith.com/#/practice');
    expect(win.focus).toHaveBeenCalled();
  });
});
