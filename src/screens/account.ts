/**
 * Accounts on the device (docs/REDESIGN.md §3, step078): sign in by email link, accept an invite, wait for approval,
 * the family's people and invites, and the super admin's page. Server rules: server/accounts.ts.
 */
import { call, latestMe, refreshAccount, signOutHere, type Household, type Invite, type Me } from '../sync/account';
import { fill, group, h, list, toast } from '../ui/dom';
import type { View } from '../app';

const ROLE: Record<string, string> = { owner: 'Owner', coparent: 'Co-parent', viewer: 'Viewer' };
const day = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function emailForm(button: string, send: (email: string) => Promise<void>): HTMLElement {
  const input = h('input', { class: 'row-input', type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'Email', 'aria-label': 'Email', required: true }) as HTMLInputElement;
  const out = h('p', { class: 'feedback', role: 'status' });
  const btn = h('button', { class: 'btn primary hero', type: 'submit' }, button) as HTMLButtonElement;
  const form = h('form', { class: 'stack', onsubmit: async (e: Event) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    btn.disabled = true;
    out.className = 'feedback';
    out.textContent = '';
    try {
      await send(input.value.trim());
    } catch (err) {
      out.className = 'feedback bad';
      out.textContent = (err as Error).message;
      btn.disabled = false;
    }
  } }, group(null, h('div', { class: 'row' }, input)), btn, out);
  setTimeout(() => input.focus(), 50);
  return form;
}

/** After the email is sent: the 6-digit code from it signs in right here (the Home Screen app has its own storage). */
function sentView(email: string): HTMLElement {
  const code = h('input', { class: 'row-input code', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '6-digit code', 'aria-label': 'Code from the email' }) as HTMLInputElement;
  const out = h('p', { class: 'feedback', role: 'status' });
  const btn = h('button', { class: 'btn primary hero', type: 'submit' }, 'Sign in') as HTMLButtonElement;
  const form = h('form', { class: 'stack', onsubmit: async (e: Event) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.value.trim())) return;
    btn.disabled = true;
    try {
      await call('code', { email, code: code.value.trim() });
      await refreshAccount();
      location.hash = '#/';
    } catch (err) {
      out.className = 'feedback bad';
      out.textContent = (err as Error).message;
      btn.disabled = false;
    }
  } }, group(null, h('div', { class: 'row' }, code)), btn, out);
  setTimeout(() => code.focus(), 50);
  return h('div', { class: 'stack' }, h('h2', { class: 'page-heading' }, 'Check your email'), group(null, h('div', { class: 'row' }, h('span', { class: 'row-label' }, email))), form);
}

/** #/signin */
export function signinScreen(): View {
  const root = h('div', { class: 'stack' });
  fill(root, emailForm('Email me a sign-in link', async (email) => {
    await call('signin', { email });
    fill(root, sentView(email));
  }));
  return { title: 'Sign in', el: root };
}

/** #/invite/<token>: what the invite offers, then the invitee's email. */
export function inviteScreen(token = ''): View {
  const root = h('div', { class: 'stack' });
  void (async () => {
    try {
      const info = await call<{ kind: 'family' | 'join'; role: string | null }>('invite-info', { token });
      const what = info.kind === 'family' ? 'Start your family on Puzzle Trail' : `Join a family as ${info.role === 'viewer' ? 'a viewer' : 'a co-parent'}`;
      fill(root, h('h2', { class: 'page-heading' }, what), emailForm('Join', async (email) => {
        const r = await call<{ pending: boolean }>('invite-accept', { token, email });
        fill(root, sentView(email), r.pending ? group(null, h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Approval'), h('span', { class: 'row-value' }, 'Waiting'))) : null);
      }));
    } catch (e) {
      fill(root, h('h2', { class: 'page-heading' }, 'Invite'), h('p', { class: 'feedback bad', role: 'alert' }, (e as Error).message));
    }
  })();
  return { title: 'Invite', el: root };
}

/** Shown instead of the app while a new family waits for approval. */
export function waitingScreen(): View {
  const me = latestMe();
  return {
    title: 'Puzzle Trail',
    el: h('div', { class: 'stack' },
      h('h2', { class: 'page-heading' }, 'Waiting for approval'),
      list([
        me?.email ? { label: me.email } : null,
        { label: 'Check again', onclick: async () => { await refreshAccount(); location.hash = '#/'; } },
        { label: 'Sign out', onclick: async () => { await signOutHere(); location.hash = '#/'; } }
      ]))
  };
}

/* ---------------- People (Settings → People) ---------------- */

async function share(link: string) {
  try {
    if (navigator.share) await navigator.share({ title: 'Puzzle Trail invite', url: link });
    else {
      await navigator.clipboard.writeText(link);
      toast('Link copied');
    }
  } catch { /* cancelled */ }
}

function inviteLabel(i: Invite): string {
  return i.kind === 'family' ? 'Another family' : ROLE[i.role ?? ''] ?? 'Member';
}

function householdSection(hh: Household, refresh: () => void): HTMLElement[] {
  const canInvite = hh.role === 'owner' || hh.role === 'coparent';
  const make = (role: 'coparent' | 'viewer') => async () => {
    try {
      const r = await call<{ link: string }>('invite-create', { kind: 'join', household: hh.id, role });
      await share(r.link);
      refresh();
    } catch (e) { toast((e as Error).message); }
  };
  return [
    list(hh.members.map((m) => ({
      label: m.me ? `${m.email} (you)` : m.email,
      value: ROLE[m.role],
      onclick: m.role !== 'owner' && (hh.role === 'owner' || m.me)
        ? async () => {
            if (!confirm(m.me ? 'Leave this family?' : `Remove ${m.email}?`)) return;
            try { await call('member-remove', { household: hh.id, user: m.id }); refresh(); } catch (e) { toast((e as Error).message); }
          }
        : undefined
    })), hh.role === 'owner' ? 'Your family' : 'Family'),
    canInvite ? list([{ label: 'Invite a co-parent', onclick: make('coparent') }, { label: 'Invite a viewer', onclick: make('viewer') }]) : h('span'),
    list([{ label: 'Progress', href: `#/family/${hh.id}` }])
  ];
}

/** #/people: my families, their people, invites, approvals. */
export function peopleScreen(): View {
  const root = h('div', { class: 'stack' });
  const draw = (me: Me | null) => {
    if (!me?.signedIn) {
      fill(root, list([{ label: 'Sign in', href: '#/signin' }]));
      return;
    }
    const refresh = () => void refreshAccount().then(draw);
    const familyInvite = async () => {
      try {
        const r = await call<{ link: string }>('invite-create', { kind: 'family' });
        await share(r.link);
        refresh();
      } catch (e) { toast((e as Error).message); }
    };
    fill(root,
      ...(me.households ?? []).flatMap((hh) => householdSection(hh, refresh)),
      me.canInviteFamilies ? list([{ label: 'Invite another family', value: me.invitesLeft === null || me.invitesLeft === undefined ? undefined : me.invitesLeft, onclick: familyInvite }]) : null,
      me.invites?.length
        ? list(me.invites.map((i) => ({
            label: inviteLabel(i),
            value: day(i.expires_at),
            onclick: async () => {
              if (!confirm('Cancel this invite link?')) return;
              try { await call('invite-revoke', { id: i.id }); refresh(); } catch (e) { toast((e as Error).message); }
            }
          })), 'Open invites')
        : null,
      me.waiting?.length
        ? list(me.waiting.map((w) => ({
            label: w.email,
            value: day(w.created_at),
            onclick: async () => {
              const yes = confirm(`Approve ${w.email}? Only approve someone you know.`);
              const no = !yes && confirm(`Decline ${w.email}?`);
              if (!yes && !no) return;
              try { await call('decide', { user: w.user, decision: yes ? 'approved' : 'denied' }); refresh(); } catch (e) { toast((e as Error).message); }
            }
          })), 'Waiting for approval')
        : null,
      list([
        me.admin ? { label: 'Admin', href: '#/admin' } : null,
        { label: me.email ?? 'Signed in', value: me.daysLeft ? `${me.daysLeft} days` : undefined },
        { label: h('span', { class: 'danger' }, 'Sign out'), onclick: async () => { await signOutHere(); location.hash = '#/'; } }
      ]));
  };
  draw(latestMe());
  void refreshAccount().then(draw);
  return { title: 'People', el: root };
}

/* ---------------- Admin (super admin only) ---------------- */

interface AdminData {
  counts: Record<string, number>;
  users: { id: string; email: string; status: string; created_at: number; last_seen: number | null; invited_by: string | null }[];
}

/** #/admin: counts and people; tap a person to suspend them (and everyone they invited) or restore them. */
export function adminScreen(): View {
  const root = h('div', { class: 'stack' });
  const load = async () => {
    try {
      const d = await call<AdminData>('admin');
      const tile = (n: number | undefined, label: string) => h('div', { class: 'tile' }, h('strong', {}, String(n ?? 0)), h('span', {}, label));
      fill(root,
        h('div', { class: 'tiles', style: '--n: 3' }, tile(d.counts.active, 'Active'), tile(d.counts.pending, 'Waiting'), tile(d.counts.suspended, 'Suspended')),
        list(d.users.map((u) => ({
          label: u.email,
          value: u.status === 'active' ? day(u.last_seen ?? u.created_at) : u.status,
          onclick: async () => {
            const restore = u.status === 'suspended';
            if (!confirm(restore ? `Restore ${u.email} and everyone they invited?` : `Suspend ${u.email}?`)) return;
            const branch = restore || confirm('Also suspend everyone they invited?');
            try {
              const r = await call<{ count: number }>('suspend', { user: u.id, branch, restore });
              toast(`${r.count} updated`);
              void load();
            } catch (e) { toast((e as Error).message); }
          }
        })), 'People'));
    } catch (e) {
      fill(root, h('p', { class: 'feedback bad', role: 'alert' }, (e as Error).message));
    }
  };
  void load();
  return { title: 'Admin', el: root };
}
