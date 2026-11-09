import { load, save, type AppState } from '../core/storage';

/**
 * Sends the child's progress to the parent dashboard (Cloudflare D1 via /api/sync).
 * - Uploads only attempts newer than the last confirmed one, in batches.
 * - Debounced after each answer; flushed when the app goes to the background; retried when back online.
 * - Works offline-first: nothing is lost if a sync fails, it is simply retried later.
 */

const BATCH = 400;
let timer: number | undefined;
let running: Promise<SyncResult> | undefined;

export interface SyncResult {
  ok: boolean;
  sent: number;
  error?: string;
}

export function newFamilyId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18)); // 144 bits
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parentLink(familyId: string): string {
  return `${location.origin}${location.pathname}#/parent/${familyId}`;
}

/** Compact summary the dashboard shows alongside the attempt log. */
export function snapshot(state: AppState) {
  const now = Date.now();
  return {
    v: 1,
    grade: state.settings.grade,
    stats: state.stats,
    meets: state.meets.slice(-60),
    activeDays: state.activeDays.slice(-400),
    reviewQueue: state.review.length,
    reviewDue: state.review.filter((r) => r.due <= now).length,
    // last round per grade and kind: problem ids and results only (problems regenerate from ids)
    rounds: state.rounds ?? {}
  };
}

function payload(state: AppState, attempts: AppState['log'], pin?: string) {
  return {
    familyId: state.sync!.familyId,
    ...(pin ? { pin } : {}),
    child: { name: state.settings.name, grade: state.settings.grade },
    snapshot: snapshot(state),
    attempts
  };
}

async function post(body: unknown): Promise<Response> {
  return fetch('./api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export function syncNow(pin?: string): Promise<SyncResult> {
  if (running) return running;
  running = (async () => {
    const state = load();
    if (!state.sync) return { ok: false, sent: 0, error: 'Sync is off' };
    let sent = 0;
    try {
      // always send at least once so the snapshot (and the PIN on first setup) gets through
      do {
        const pending = state.log.filter((a) => a.ts > state.sync!.lastTs).slice(0, BATCH);
        const res = await post(payload(state, pending, pin));
        if (!res.ok) {
          const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`;
          throw new Error(msg);
        }
        pin = undefined;
        sent += pending.length;
        if (pending.length) state.sync!.lastTs = pending[pending.length - 1].ts;
        if (pending.length < BATCH) break;
      } while (true);
      state.sync!.lastSyncAt = Date.now();
      state.sync!.lastError = undefined;
      save(state);
      return { ok: true, sent };
    } catch (e) {
      state.sync!.lastError = (e as Error).message || 'Network error';
      save(state);
      return { ok: false, sent, error: state.sync!.lastError };
    }
  })().finally(() => (running = undefined));
  return running;
}

/** First-time setup: create the family on the server with the parent's PIN. */
export async function enableSync(pin: string): Promise<SyncResult> {
  const state = load();
  state.sync = { familyId: newFamilyId(), lastTs: 0 };
  save(state);
  const r = await syncNow(pin);
  if (!r.ok) {
    delete state.sync;
    save(state);
  }
  return r;
}

/** Erase the server copy (needs the PIN) and stop syncing. Local progress stays on the device. */
export async function disableSync(pin: string): Promise<SyncResult> {
  const state = load();
  if (!state.sync) return { ok: true, sent: 0 };
  const res = await fetch('./api/parent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'delete', familyId: state.sync.familyId, pin })
  }).catch(() => undefined);
  if (!res?.ok) {
    const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : 'Network error';
    return { ok: false, sent: 0, error: msg ?? 'Could not delete' };
  }
  delete state.sync;
  save(state);
  return { ok: true, sent: 0 };
}

/** Background flush that survives the page closing. */
function beacon() {
  const state = load();
  if (!state.sync || typeof navigator.sendBeacon !== 'function') return;
  const pending = state.log.filter((a) => a.ts > state.sync!.lastTs).slice(0, BATCH);
  if (!pending.length) return;
  const ok = navigator.sendBeacon('./api/sync', new Blob([JSON.stringify(payload(state, pending))], { type: 'application/json' }));
  // Not confirmed, so lastTs stays put; the next normal sync re-sends and the server ignores duplicates.
  void ok;
}

export function startAutoSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('cml:progress', () => {
    if (!load().sync) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), 4000);
  });
  window.addEventListener('online', () => load().sync && void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beacon();
    else if (load().sync) void syncNow();
  });
  if (load().sync) void syncNow();
}
