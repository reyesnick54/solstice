// Vault & HIN: consent, rights, connected sources and revocation.
// Raw personal records stay in the Vault; nothing here is placed on-chain.

import { api } from '../api.js';
import { requireStrong } from '../auth.js';
import { dateTime, humanize, shortId } from '../format.js';
import { act, badge, h, note, panel, table, toast } from '../ui.js';
import { autoKv, items, view } from './common.js';

export function vaultView() {
  let consentsPanel;
  consentsPanel = panel({
    title: 'Consents',
    subtitle: 'Who may use what, for which purpose. Revocable where the law allows.',
    wide: true,
    load: () => api.get('/data/consents'),
    empty: (d) => items(d).length === 0 && 'You have not granted any consents.',
    render: (d, refresh) =>
      table(
        [
          { label: 'Requester', render: (c) => c.requesterName || c.requester || '—' },
          { label: 'Purpose', render: (c) => humanize(c.purpose) },
          { label: 'Data', render: (c) => (c.dataCategories || c.categories || []).map(humanize).join(', ') || '—' },
          { label: 'Status', render: (c) => badge(c.status || c.state) },
          { label: 'Expires', render: (c) => dateTime(c.expiresAt || c.expiration) },
          {
            label: '',
            render: (c) =>
              String(c.status || c.state).toUpperCase() === 'ACTIVE' && c.revocable !== false
                ? h(
                    'button',
                    {
                      class: 'btn btn-sm btn-danger',
                      onclick: (e) =>
                        act(e.currentTarget, async () => {
                          if (!(await requireStrong('Revoking a consent'))) return;
                          await api.post(`/data/consents/${encodeURIComponent(c.id || c.consentId)}/revoke`, {});
                          toast('Consent revoked.', 'positive');
                          refresh();
                        }),
                    },
                    'Revoke',
                  )
                : null,
          },
        ],
        items(d),
      ),
  });

  return view(
    consentsPanel,
    panel({
      title: 'Your Vault',
      subtitle: 'Encrypted, subject-bound personal data store',
      load: () => api.get('/data/vault'),
      render: (v) => h('div', { class: 'stack' }, note('Sensitive records are encrypted per category and never written to SunRey Chain. Only proofs and references can be.'), autoKv(v, { limit: 14 })),
    }),
    panel({
      title: 'Human Information Network',
      subtitle: 'Your verified contributions and their status',
      load: () => api.get('/hin/me/summary'),
      render: (s) =>
        h(
          'div',
          { class: 'stack' },
          autoKv(s, { skip: ['subject'], limit: 12 }),
          note('Contributions are economic inputs, not a score of you, and they do not mint SR or MR by themselves.'),
        ),
    }),
    panel({
      title: 'Connected data sources',
      load: () => api.get('/data/vault/sources'),
      empty: (d) => items(d).length === 0 && 'No sources connected.',
      render: (d) => table([{ label: 'Source', render: (s) => s.name || humanize(s.kind || s.sourceId) }, { label: 'State', render: (s) => badge(s.state || s.status) }, { label: 'Connected', render: (s) => dateTime(s.connectedAt || s.createdAt) }], items(d)),
    }),
    panel({
      title: 'Access history',
      subtitle: 'Every read of your data, with its purpose',
      load: () => api.get('/data/access-history'),
      empty: (d) => items(d).length === 0 && 'No access recorded.',
      render: (d) =>
        table(
          [
            { label: 'When', render: (a) => dateTime(a.occurredAt || a.accessedAt) },
            { label: 'Who', render: (a) => a.requester || a.actor || '—' },
            { label: 'Purpose', render: (a) => humanize(a.purpose) },
            { label: 'Ref', render: (a) => h('span', { class: 'mono' }, shortId(a.id || a.evidenceId || '', 10)) },
          ],
          items(d),
        ),
    }),
  );
}
