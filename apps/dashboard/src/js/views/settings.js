import { api, getSession } from '../api.js';
import { enrollTotp, isStrong, requireStrong, signOut } from '../auth.js';
import { CONFIG } from '../config.js';
import { dateTime, humanize } from '../format.js';
import { act, badge, h, kv, note, panel } from '../ui.js';
import { autoKv, view } from './common.js';

export function settingsView({ refreshShell }) {
  return view(
    panel({
      title: 'Profile & identity',
      load: () => api.get('/auth/session'),
      render: (s) =>
        kv([
          ['Email', (getSession() || {}).email || '—'],
          ['Customer', h('span', { class: 'mono' }, s.customerId)],
          ['Identity verification', s.verification === 'VERIFIED' ? h('span', null, badge('VERIFIED', 'positive'), ' ', h('span', { class: 'muted small' }, '(simulated, sandbox)')) : badge(s.verification)],
          ['Risk', badge(s.risk)],
          ['Environment', badge(s.environment, 'info')],
          ['Production', s.production ? 'Yes' : 'No'],
        ]),
    }),
    panel({
      title: 'Sign-in security',
      subtitle: 'Two-step verification is required for financial actions',
      load: () => api.get('/auth/mfa/status'),
      render: (m, refresh) =>
        h(
          'div',
          { class: 'stack' },
          kv([
            ['Two-step verification', m.totpEnrolled ? badge('ON', 'positive') : badge('OFF', 'warning')],
            ['This session', badge(m.authenticationStrength, isStrong() ? 'positive' : 'muted')],
            ['Session expires', dateTime((getSession() || {}).accessExpiresAt)],
          ]),
          note('Signing in on another device ends the session here: SunRey keeps one active session per identity.'),
          h(
            'div',
            { class: 'row' },
            m.totpEnrolled
              ? h('button', { class: 'btn btn-sm', onclick: (e) => act(e.currentTarget, async () => { if (await requireStrong('Verifying this session')) { refresh(); refreshShell(); } }) }, 'Verify this session')
              : h('button', { class: 'btn btn-sm btn-primary', onclick: (e) => act(e.currentTarget, async () => { if (await enrollTotp()) refresh(); }) }, 'Set up two-step verification'),
            h('button', { class: 'btn btn-sm btn-danger', onclick: async () => { await signOut(); refreshShell(); } }, 'Sign out'),
          ),
        ),
    }),
    panel({
      title: 'Account capabilities',
      subtitle: 'Feature switches reported by the backend',
      load: () => api.get('/me/capabilities'),
      render: (c) => autoKv(c, { limit: 20 }),
    }),
    panel({
      title: 'Jurisdiction & activation',
      subtitle: 'What is live and what is gated',
      load: () => api.get('/economy/status'),
      render: (s) =>
        h(
          'div',
          { class: 'stack' },
          kv([
            ['Operating jurisdiction', 'GB (sandbox legal entity placeholder)'],
            ['API', CONFIG.apiBase.replace(/^https?:\/\//, '')],
            ['Market data', badge(s.marketData)],
            ['Live connectivity', s.live ? badge('ON', 'positive') : badge('OFF')],
            ['Dashboard release', CONFIG.release || 'local'],
            ['Built', dateTime(CONFIG.builtAt)],
          ]),
          note('Real money movement, live trading, token sales and mainnet each need licensing, a regulated partner, security review and a separate human approval before they can be switched on.', 'gold'),
        ),
    }),
    panel({
      title: 'Notifications',
      load: () => api.get('/notifications'),
      render: (n) => h('div', null, h('p', null, humanize(n.reason || n.state)), autoKv(n, { only: ['availability', 'state'] })),
    }),
  );
}
