// Home: segregated overview. Totals are never blended across asset classes or
// currencies: there is no live FX or token price to do so honestly.

import { api } from '../api.js';
import { money, token, dateTime, humanize, assetLabel } from '../format.js';
import { badge, clear, errorState, h, loading, note, panel, stat, table } from '../ui.js';
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

/** The headline figures, each class on its own, never summed. */
function positionStrip() {
  const body = h('div', null, loading('Loading your position'));
  const root = h('section', { class: 'position', 'aria-label': 'Your position' }, body);
  (async () => {
    try {
      const [accounts, portfolio, grow] = await Promise.allSettled([api.get('/accounts'), api.get('/exchange/portfolio'), api.get('/grow/plan')]);
      const tiles = [];
      if (accounts.status === 'fulfilled') {
        const rows = cashByCurrency(items(accounts.value));
        if (rows.length === 0) tiles.push(stat('Cash', '—', 'Open an account in Money & Banking'));
        for (const [currency, minor] of rows) tiles.push(stat(`Cash · ${currency}`, money({ minorUnits: String(minor), currency }), 'Read from the ledger'));
      } else tiles.push(stat('Cash', 'Unavailable', 'Accounts did not load'));
      if (portfolio.status === 'fulfilled') {
        for (const a of portfolio.value.items || []) {
          const moon = a.assetId === 'MOONREY_COIN';
          tiles.push(stat(assetLabel(a.assetId), token(a.available, a.assetId), `Available · ${token(a.reserved, a.assetId)} reserved`, moon ? 'moon' : 'gold'));
        }
      } else tiles.push(stat('Digital assets', 'Unavailable', 'Exchange portfolio did not load'));
      if (grow.status === 'fulfilled') tiles.push(stat('Investments', humanize(grow.value.state || 'Not started'), grow.value.exists ? 'Paper allocation' : 'No Grow plan yet'));
      else tiles.push(stat('Investments', 'Unavailable', 'Not enabled for this account'));
      clear(body).append(h('div', { class: 'stats' }, tiles), h('p', { class: 'position-foot' }, 'SR and MR are testnet assets with no market value, so no dollar value is shown for them and nothing here is added together.'));
    } catch (error) {
      clear(body).append(errorState(error));
    }
  })();
  return root;
}

export function homeView({ navigate }) {
  return view(
    positionStrip(),
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
      title: 'Agent actions awaiting you',
      subtitle: 'Proposals only. Nothing runs without your approval and the Kernel.',
      className: 'panel-third',
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
      title: 'Capabilities',
      subtitle: 'What the backend enables for your account right now',
      className: 'panel-two-thirds',
      load: () => api.get('/me/capabilities'),
      render: (c) => {
        const keys = Object.keys(c).filter((k) => typeof c[k] === 'boolean').slice(0, 16);
        const half = Math.ceil(keys.length / 2);
        return h('div', { class: 'kv-grid' }, autoKv(c, { only: keys.slice(0, half) }), autoKv(c, { only: keys.slice(half) }));
      },
    }),
  );
}
