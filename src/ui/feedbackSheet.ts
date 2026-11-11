/**
 * The Feedback button's sheet: Problem or Idea, a message, Send. The screen, the problem on screen (if any) and
 * the grade go along automatically, so "this one is wrong" can be traced. Posted to /api/feedback (server/userFeedback.ts).
 */
import { load } from '../core/storage';
import { h, segmented } from './dom';

type Kind = 'problem' | 'idea';

/** A random id per install, only so the server can rate-limit one device. Not linked to the family. */
function deviceId(): string {
  const KEY = 'mc.feedbackDevice';
  try {
    const have = localStorage.getItem(KEY);
    if (have && /^[A-Za-z0-9_-]{8,64}$/.test(have)) return have;
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    const id = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_');
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return 'nostorage';
  }
}

/** The problem the child is looking at: the first problem card on screen. */
function problemOnScreen(): string | undefined {
  for (const el of document.querySelectorAll<HTMLElement>('[data-problem-id]')) {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) return el.dataset.problemId;
  }
  return undefined;
}

export function openFeedback(): void {
  const context = { route: location.hash, problemId: problemOnScreen(), grade: load().settings.grade };
  let kind: Kind = context.problemId ? 'problem' : 'idea';
  const message = h('textarea', { class: 'feedback-text', rows: '5', maxlength: '2000', 'aria-label': 'Message' });
  const status = h('p', { class: 'feedback-status', role: 'status', 'aria-live': 'polite' });
  const send = h('button', { class: 'btn primary', type: 'submit' }, 'Send');
  const close = () => { dialog.close(); dialog.remove(); };

  const form = h('form', { class: 'feedback-form', method: 'dialog', onsubmit: async (e: SubmitEvent) => {
    e.preventDefault();
    if (message.value.trim().length < 3) { status.textContent = 'Write a few words first.'; message.focus(); return; }
    send.disabled = true;
    status.textContent = 'Sending…';
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, message: message.value, ...context, device: navigator.userAgent, deviceId: deviceId() })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `Couldn't send (${res.status})`);
      form.replaceChildren(h('p', { class: 'feedback-done' }, 'Thank you!'), h('button', { class: 'btn primary', type: 'button', onclick: close }, 'Done'));
    } catch (err) {
      send.disabled = false;
      status.textContent = navigator.onLine ? (err as Error).message : 'No connection. Try again when you are online.';
    }
  } },
    segmented('Kind', [{ value: 'problem', label: 'Problem' }, { value: 'idea', label: 'Idea' }], kind, (v) => (kind = v as Kind)),
    message,
    status,
    h('div', { class: 'feedback-actions' }, h('button', { class: 'btn plain', type: 'button', onclick: close }, 'Cancel'), send));

  const dialog = h('dialog', { class: 'sheet', 'aria-label': 'Feedback' }, h('h2', {}, 'Feedback'), form);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });   // tap outside the sheet
  document.body.append(dialog);
  dialog.showModal();
  message.focus();
}
