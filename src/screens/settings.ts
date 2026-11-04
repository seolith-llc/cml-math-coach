import { load, reset, save } from '../core/storage';
import { PREMIUM_VOICES, listVoices, speak, voiceOptions, voiceQuality, voicesReady } from '../voice/speech';
import { sttSupported } from '../voice/recognition';
import { disableSync, enableSync, parentLink } from '../sync/sync';
import { group, h, list, toast } from '../ui/dom';
import { applyVoiceSettings } from '../app';
import type { View } from '../app';

const SAMPLE = "Hi! Let's solve some fun problems together.";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function toggle(label: string, value: boolean, onChange: (v: boolean) => void, disabled = false) {
  const box = h('input', { type: 'checkbox', role: 'switch', checked: value, disabled, onchange: () => onChange(box.checked) });
  return h('label', { class: 'row switch' }, h('span', { class: 'row-label' }, label), box);
}

export function settingsScreen(): View {
  const state = load();
  const s = state.settings;
  const persist = () => {
    save(state);
    applyVoiceSettings();
  };

  const name = h('input', { class: 'row-input', type: 'text', value: s.name, placeholder: 'Name', 'aria-label': 'Name', autocomplete: 'off', oninput: () => { s.name = name.value.trim(); save(state); } });

  // One picker: natural (cloud) voices first, then the voices on this device.
  const voice = h('select', { class: 'row-input', 'aria-label': 'Voice', onchange: () => { s.voice = voice.value; persist(); void speak(SAMPLE, voiceOptions(s.voice, s.rate)); } },
    h('optgroup', { label: 'Natural' }, ...PREMIUM_VOICES.map((v) => h('option', { value: `natural:${v}`, selected: s.voice === `natural:${v}` }, cap(v)))));
  const device = h('optgroup', { label: 'This device' }, h('option', { value: 'device:', selected: s.voice === 'device:' }, 'Automatic'));
  voice.append(device);
  void voicesReady().then(() => {
    for (const v of listVoices()) device.append(h('option', { value: `device:${v.voiceURI}`, selected: s.voice === `device:${v.voiceURI}` }, `${v.name}${voiceQuality(v) >= 3 ? ' ★' : ''}`));
  });
  const rate = h('input', { type: 'range', min: '0.6', max: '1.4', step: '0.05', value: String(s.rate), 'aria-label': 'Speed',
    oninput: () => { s.rate = +rate.value; persist(); }, onchange: () => void speak(SAMPLE) });

  return {
    title: 'Settings',
    el: h('div', { class: 'stack' },
      group(null, name),
      group('Voice',
        h('label', { class: 'row' }, h('span', { class: 'row-label' }, 'Voice'), voice),
        h('label', { class: 'row' }, h('span', { class: 'row-label' }, 'Speed'), rate),
        toggle('Read aloud', s.speak, (v) => { s.speak = v; save(state); }),
        toggle('Hands-free', s.handsFree, (v) => { s.handsFree = v; save(state); }, !sttSupported())),
      parentGroup(),
      list([
        { label: 'Privacy', href: '#/privacy' },
        { label: h('span', { class: 'danger' }, 'Reset progress'), onclick: () => { if (confirm('Erase all progress on this device?')) { reset(); toast('Progress erased'); location.hash = '#/'; } } }
      ]))
  };
}

/** Parent dashboard: off → PIN + Turn on. On → private link to share, Turn off. */
function parentGroup(): HTMLElement {
  const wrap = h('div');
  const draw = () => {
    const sync = load().sync;
    if (!sync) {
      const pin = h('input', { class: 'row-input pin', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: 8, placeholder: 'PIN (4–8 digits)', 'aria-label': 'New parent PIN' });
      const on = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        if (!/^\d{4,8}$/.test(pin.value)) return toast('PIN must be 4–8 digits');
        on.disabled = true;
        const r = await enableSync(pin.value);
        on.disabled = false;
        if (!r.ok) return toast(r.error ?? 'Could not turn on');
        draw();
      } }, 'Turn on');
      wrap.replaceChildren(group('Parent dashboard', h('div', { class: 'row' }, pin, on)));
      return;
    }
    const link = parentLink(sync.familyId);
    const share = async () => {
      try {
        if (navigator.share) return await navigator.share({ title: 'Math Coach', url: link });
      } catch {
        /* cancelled */
      }
      await navigator.clipboard?.writeText(link).then(() => toast('Link copied'), () => toast(link));
    };
    const off = async () => {
      const pin = prompt('Parent PIN');
      if (!pin) return;
      const r = await disableSync(pin);
      if (!r.ok) return toast(r.error ?? 'Could not turn off');
      draw();
    };
    wrap.replaceChildren(list([
      { label: 'Open dashboard', href: `#/parent/${sync.familyId}` },
      { label: 'Share dashboard link', onclick: () => void share() },
      sync.lastError ? { label: 'Last sync', value: h('span', { class: 'danger' }, sync.lastError) } : null,
      { label: 'Turn off', onclick: () => void off() }
    ], 'Parent dashboard'));
  };
  draw();
  return wrap;
}

export function privacyScreen(): View {
  const items = [
    'Progress is saved on this device.',
    'With the parent dashboard on, results (topic, answer, time, first name) are stored for the dashboard. Turning it off deletes them.',
    'Natural voices send the text being read to Cloudflare Workers AI.',
    'Spoken answers are processed by your browser’s speech service.'
  ];
  return { title: 'Privacy', el: h('div', { class: 'stack' }, group(null, h('ul', { class: 'bullets' }, ...items.map((x) => h('li', {}, x))))) };
}
