// Home: segregated overview. Totals are never blended across asset classes or
// currencies: there is no live FX or token price to do so honestly.

import { api } from '../api.js';
import { money, token, dateTime, humanize, assetLabel } from '../format.js';
import { badge, h, note, panel, stat, table } from '../ui.js';
import { view, items, autoKv } from './common.js';

function cashByCurrency(accounts) {
  const totals = new Map();
  for (const account of accounts) {
    const value = account.balance && account.balance.value;
    const posted = value && (value.available || value.posted || value.ledger);
    if (!posted || !posted.currency) continue;
    const prev = totals.get(posted.currency) || 0n;
    totals.set(posted.currency, prev + BigInt(posted.minorUnits));
  }
  return [...totals.entries()];
}

export function homeView({ navigate }) {
  return view(
    panel({
      title: 'Your position',
      subtitle: 'Each class is shown separately. Deposits, investments and digital assets are never added together.',
      wide: true,
      load: async () => {
        const [accounts, portfolio, grow] = await Promise.allSettled([
          api.get('/accounts'),
          api.get('/exchange/portfolio'),
          api.get('/grow/plan'),
        ]);
        return { accounts, portfolio, grow };
      },
      render: ({ accounts, portfolio, grow }) => {
        const tiles = [];
        if (accounts.status === 'fulfilled') {
          const rows = cashByCurrency(items(accounts.value));
          if (rows.length === 0) tiles.push(stat('Cash deposits', '—', 'No cash account yet'));
          for (const [currency, minor] of rows) tiles.push(stat(`Cash · ${currency}`, money({ minorUnits: String(minor), currency }), 'Ledger-derived, simulated', 'gold'));
        } else tiles.push(stat('Cash deposits', 'Unavailable', 'Accounts did not load'));
        if (portfolio.status === 'fulfilled') {
          for (const a of portfolio.value.items || []) {
            tiles.push(stat(`${assetLabel(a.assetId)} · available`, token(a.available, a.assetId), `Reserved ${token(a.reserved, a.assetId)} · testnet`, a.assetId === 'MOONREY_COIN' ? 'moon' : 'gold'));
          }
        } else tiles.push(stat('Digital assets', 'Unavailable', 'Exchange portfolio did not load'));
        if (grow.status === 'fulfilled') {
          tiles.push(stat('Investments (Grow)', humanize(grow.value.state || 'Not requested'), grow.value.exists ? 'Paper / simulated' : 'No plan yet'));
        } else tiles.push(stat('Investments (Grow)', 'Unavailable', 'Not enabled for this account'));
        return h('div', null, h('div', { class: 'stats' }, tiles), h('p', { class: 'muted small', style: 'margin-top:12px' }, 'SR and MR are testnet assets with no real market value; no USD value is shown for them.'));
      },
    }),
    panel({
      title: 'Recent money activity',
      subtitle: 'From the canonical fiat ledger',
      className: 'panel-two-thirds',
      load: async () => {
        const accounts = items(await api.get('/accounts'));
        const per = await Promise.all(
          accounts.slice(0, 6).map((a) =>
            api
              .get(`/accounts/${encodeURIComponent(a.id)}/activity`)
              .then((r) => items(r).map((row) => ({ ...row, _account: a })))
              .catch(() => []),
          ),
        );
        return per.flat().sort((x, y) => String(y.postedAt || y.occurredAt || y.createdAt || '').localeCompare(String(x.postedAt || x.occurredAt || x.createdAt || ''))).slice(0, 10);
      },
      empty: (rows) => rows.length === 0 && 'No ledger activity yet. Fund a sandbox account from Money & Banking.',
      render: (rows) =>
        table(
          [
            { label: 'When', render: (r) => dateTime(r.postedAt || r.occurredAt || r.createdAt) },
            { label: 'Description', render: (r) => r.description || humanize(r.kind || r.type || r.category) },
            { label: 'Account', render: (r) => `${r._account.currency} · ${humanize(r._account.productType)}` },
            { label: 'Status', render: (r) => badge(r.status || r.settlementState || 'POSTED') },
            { label: 'Amount', align: 'right', render: (r) => money(r.amount || r.signedAmount || r.money, r._account.currency) },
          ],
          rows,
        ),
    }),
    panel({
      title: 'Environment',
      subtitle: 'Reported by the backend, not assumed',
      className: 'panel-third',
      load: () => api.get('/economy/status'),
      render: (s) =>
        h(
          'div',
          null,
          autoKv(s, { only: ['marketData', 'hin', 'productiveOracle', 'live', 'delayed', 'unavailable'] }),
          note('Live money movement, live trading and mainnet are switched off. Each needs licensing and a separate human approval.', 'gold'),
        ),
    }),
    panel({
      title: 'Agent actions awaiting you',
      subtitle: 'Proposals only. Nothing runs without your approval and the Kernel.',
      load: () => api.get('/agent/actions'),
      empty: (d) => items(d).length === 0 && 'No proposed actions.',
      render: (d) =>
        table(
          [
            { label: 'Proposed', render: (r) => humanize(r.kind || r.actionType || r.type) },
            { label: 'State', render: (r) => badge(r.state || r.status) },
            { label: 'Created', render: (r) => dateTime(r.createdAt || r.proposedAt) },
          ],
          items(d),
          { onRow: () => navigate('/agent') },
        ),
    }),
    panel({
      title: 'Capabilities',
      subtitle: 'What the backend enables for your account right now',
      load: () => api.get('/me/capabilities'),
      render: (c) => autoKv(c, { limit: 16 }),
    }),
  );
}
