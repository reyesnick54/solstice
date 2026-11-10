// Vault & HIN: consent, rights, connected sources and revocation.
// Raw personal records stay in the Vault; nothing here is placed on-chain.

import { api } from '../api.js';
import { requireStrong } from '../auth.js';
import { dateTime, humanize, money, relative, shortId, token } from '../format.js';
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
          { label: 'Identity', render: (c) => (c.identityExposure ? humanize(c.identityExposure) : '—') },
          { label: 'Paid', render: (c) => c.compensation || '—' },
          { label: 'AI training', render: (c) => (c.aiTraining === undefined ? '—' : c.aiTraining ? 'Allowed' : 'No') },
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
      render: (v) =>
        h(
          'div',
          { class: 'stack' },
          note('Sensitive records are encrypted per category and never written to SunRey Chain. Only proofs and references can be.'),
          autoKv(v, { skip: ['categories'], limit: 14 }),
          Array.isArray(v.categories)
            ? table(
                [
                  { label: 'Category', render: (c) => humanize(c.category) },
                  { label: 'Records', align: 'right', render: (c) => c.records },
                  { label: 'Shared', render: (c) => c.sharedUnder },
                  { label: 'Updated', render: (c) => relative(c.lastUpdatedAt) },
                ],
                v.categories,
              )
            : null,
        ),
    }),
    panel({
      title: 'Human Information Network',
      subtitle: 'Your verified contributions and their status',
      load: () => api.get('/hin/me/summary'),
      render: (s) =>
        h(
          'div',
          { class: 'stack' },
          autoKv({ ...s, earnedSr: s.earnedSr ? token(s.earnedSr, 'SUNREY_COIN', { maxFraction: 2 }) : undefined, earnedUsd: s.earnedUsd ? money(s.earnedUsd) : undefined }, { skip: ['subject'], limit: 12 }),
          note('Contributions are economic inputs, not a score of you, and they do not mint SR or MR by themselves.'),
        ),
    }),
    panel({
      title: 'Data sources',
      subtitle: 'Connected sources feed your Vault; nothing is shared until you consent.',
      wide: true,
      load: () => api.get('/data/vault/sources'),
      empty: (d) => items(d).length === 0 && 'No sources connected.',
      render: (d, refresh) =>
        table(
          [
            { label: 'Source', render: (s) => h('span', null, h('strong', null, s.name || humanize(s.kind || s.sourceId)), s.exampleApis ? h('span', { class: 'muted small block' }, `e.g. ${s.exampleApis}`) : null) },
            { label: 'Data', render: (s) => (s.dataCategories || []).map(humanize).join(', ') || '—' },
            { label: 'How', render: (s) => s.method || '—' },
            { label: 'State', render: (s) => badge(s.state || s.status, String(s.state).toUpperCase() === 'AVAILABLE' ? 'muted' : undefined) },
            { label: 'Last sync', render: (s) => (s.lastSyncAt ? relative(s.lastSyncAt) : '—') },
            { label: 'Records', align: 'right', render: (s) => s.records ?? '—' },
            {
              label: '',
              render: (s) =>
                String(s.state).toUpperCase() === 'AVAILABLE'
                  ? h(
                      'button',
                      {
                        class: 'btn btn-sm',
                        onclick: (e) =>
                          act(e.currentTarget, async () => {
                            if (!(await requireStrong('Connecting a data source'))) return;
                            await api.post(`/data/vault/sources/${encodeURIComponent(s.sourceId)}/connect`, {});
                            toast(`${s.name} connected.`, 'positive');
                            refresh();
                          }),
                      },
                      'Connect',
                    )
                  : null,
            },
          ],
          items(d),
        ),
    }),
    panel({
      title: 'Access history',
      subtitle: 'Every read of your data, with its purpose',
      wide: true,
      load: () => api.get('/data/access-history'),
      empty: (d) => items(d).length === 0 && 'No access recorded.',
      render: (d) =>
        table(
          [
            { label: 'When', render: (a) => dateTime(a.occurredAt || a.accessedAt) },
            { label: 'Who', render: (a) => a.requester || a.actor || '—' },
            { label: 'Purpose', render: (a) => humanize(a.purpose) },
            { label: 'Data', render: (a) => (a.dataCategories || []).map(humanize).join(', ') || '—' },
            { label: 'Outcome', render: (a) => (a.outcome ? badge(a.outcome, String(a.outcome).startsWith('DENIED') ? 'negative' : 'positive') : '—') },
            { label: 'Ref', render: (a) => h('span', { class: 'mono' }, shortId(a.id || a.evidenceId || '', 10)) },
          ],
          items(d),
        ),
    }),
  );
}
