import { load } from '../core/storage';
import { disableSync, enableSync, parentLink, syncNow } from '../sync/sync';
import { h, toast } from './dom';

const ago = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'not yet');

/** Settings card: turn on syncing with a parent PIN, then share the private dashboard link. */
export function parentSetupCard(): HTMLElement {
  const card = h('div', { class: 'card' });

  function render() {
    const state = load();
    if (!state.sync) {
      const pin1 = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: 8, placeholder: 'PIN (4–8 digits)', 'aria-label': 'New parent PIN' });
      const pin2 = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: 8, placeholder: 'Repeat PIN', 'aria-label': 'Repeat parent PIN' });
      const msg = h('p', { class: 'small', role: 'status' });
      const go = h('button', {
        class: 'btn primary', type: 'button',
        onclick: async () => {
          if (!/^\d{4,8}$/.test(pin1.value)) return (msg.textContent = 'Choose a PIN with 4 to 8 digits.');
          if (pin1.value !== pin2.value) return (msg.textContent = 'The two PINs do not match.');
          go.disabled = true;
          msg.textContent = 'Setting up…';
          const r = await enableSync(pin1.value);
          go.disabled = false;
          if (!r.ok) return (msg.textContent = `Could not turn on: ${r.error}. Check the internet connection and try again.`);
          toast('Parent dashboard is on');
          render();
        }
      }, 'Turn on parent dashboard');
      card.replaceChildren(
        h('h2', {}, '👨‍👩‍👧 Parent dashboard'),
        h('p', { class: 'muted' }, 'See progress from your own phone or computer: practice time, accuracy, topics that need help, mock meet scores and recent mistakes.'),
        h('p', { class: 'muted small' }, 'Turning this on sends practice results (topics, answers, scores, time, first name) to this app\'s private storage. Only someone with your private link AND your PIN can see it. You can delete it at any time.'),
        h('div', { class: 'form' }, h('label', {}, 'Choose a parent PIN (keep it secret from your child)', pin1), h('label', {}, 'Repeat the PIN', pin2)),
        go, msg);
      return;
    }
    const link = parentLink(state.sync.familyId);
    const linkInput = h('input', { type: 'text', value: link, readonly: true, 'aria-label': 'Private dashboard link', onfocus: () => linkInput.select() });
    const status = h('p', { class: 'small muted', role: 'status' }, `Last synced: ${ago(state.sync.lastSyncAt)}${state.sync.lastError ? ` · last error: ${state.sync.lastError}` : ''}`);
    const share = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Math Coach parent dashboard', text: 'Private parent dashboard (you will need the PIN):', url: link });
          return;
        } catch {
          /* cancelled: fall back to copying */
        }
      }
      try {
        await navigator.clipboard.writeText(link);
        toast('Link copied');
      } catch {
        linkInput.select();
        toast('Select the link and copy it');
      }
    };
    card.replaceChildren(
      h('h2', {}, '👨‍👩‍👧 Parent dashboard is on'),
      h('p', { class: 'muted small' }, 'Open this private link on YOUR phone or computer and enter your PIN. Bookmark it there. Keep it away from your child.'),
      h('div', { class: 'link-box' }, linkInput),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: share }, '📤 Share / copy link'),
        h('button', {
          class: 'btn', type: 'button',
          onclick: async () => {
            status.textContent = 'Syncing…';
            const r = await syncNow();
            status.textContent = r.ok ? `Synced just now (${r.sent} new result${r.sent === 1 ? '' : 's'}).` : `Sync failed: ${r.error}`;
          }
        }, '↻ Sync now')),
      status,
      h('details', {},
        h('summary', { class: 'small' }, 'Turn off and delete online data'),
        (() => {
          const pin = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, placeholder: 'Parent PIN', 'aria-label': 'Parent PIN' });
          const msg = h('p', { class: 'small', role: 'status' });
          return h('div', { class: 'form' },
            h('p', { class: 'small muted' }, 'This deletes the copy used by the dashboard. Progress on this device is kept.'),
            h('label', {}, 'Parent PIN', pin),
            h('button', {
              class: 'btn danger', type: 'button',
              onclick: async () => {
                if (!confirm('Delete the online dashboard data and turn syncing off?')) return;
                const r = await disableSync(pin.value);
                if (!r.ok) return (msg.textContent = r.error ?? 'Could not delete');
                toast('Online data deleted');
                render();
              }
            }, 'Delete online data'),
            msg);
        })()));
  }
  render();
  return card;
}
