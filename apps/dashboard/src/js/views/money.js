// Money & Banking: accounts, sandbox funding, own-account transfers,
// history and receipts. Every write goes through a Kernel-gated route with an
// idempotency key; balances are re-read from the ledger afterwards.

import { api, friendlyMessage } from '../api.js';
import { requireStrong } from '../auth.js';
import { dateTime, fiatExponent, humanize, money, shortId, toMinorUnits } from '../format.js';
import { act, badge, dialog, field, h, kv, note, panel, table, toast } from '../ui.js';
import { autoKv, items, view } from './common.js';

const CASH_CURRENCIES = ['USD', 'GBP', 'EUR', 'SAR'];

function availableOf(account) {
  const v = account.balance && account.balance.value;
  return v ? v.available || v.posted || v.ledger : null;
}

export function moneyView() {
  let accountsPanel;
  let historyPanel;
  const refreshAll = () => {
    accountsPanel.refresh();
    historyPanel.refresh();
  };

  async function promptCashAccount(button) {
    const currency = h('select', null, CASH_CURRENCIES.map((c) => h('option', { value: c }, c)));
    const go = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Open account');
    const idem = api.newIdempotencyKey('open');
    const d = dialog({
      title: 'Open a sandbox cash account',
      content: h(
        'form',
        {
          class: 'stack',
          onsubmit: (e) => {
            e.preventDefault();
            act(go, async () => {
              if (!(await requireStrong('Opening an account'))) return;
              const { data, status } = await api.post('/accounts', { currency: currency.value, accountType: 'CASH' }, { idempotency: idem });
              d.close();
              toast(status === 200 ? 'That account already exists.' : `Account opened: ${shortId(data.accountId || (data.account && data.account.id) || '')}`, 'positive');
              refreshAll();
            });
          },
        },
        note('Account opening is evaluated by the Compliance Kernel under your own identity. This is a simulated demand-deposit account, not a licensed bank account.'),
        field('Currency', currency),
        go,
      ),
    });
    void button;
  }

  async function fund(account) {
    const exp = fiatExponent(account.currency);
    const amount = h('input', { inputmode: 'decimal', placeholder: '100.00', required: true });
    const go = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Add sandbox funds');
    const err = h('p', { class: 'form-error', role: 'alert' });
    const idem = api.newIdempotencyKey('fund');
    const d = dialog({
      title: `Sandbox funding · ${account.currency}`,
      content: h(
        'form',
        {
          class: 'stack',
          onsubmit: (e) => {
            e.preventDefault();
            const minor = toMinorUnits(amount.value, exp);
            if (!minor || minor === '0') {
              err.textContent = `Enter an amount with at most ${exp} decimals.`;
              return;
            }
            act(go, async () => {
              if (!(await requireStrong('Adding funds'))) return;
              const { data } = await api.post('/sandbox/funding', { accountId: account.id, amountMinorUnits: minor, currency: account.currency }, { idempotency: idem });
              d.close();
              toast(`${money(data.amount)} posted (journal ${shortId(data.journalId)}). Simulated funds.`, 'positive');
              refreshAll();
            });
          },
        },
        note('This is the sandbox faucet. It posts a labelled simulated deposit through the Kernel and ledger. It is not real money and cannot be withdrawn to a bank.', 'warning'),
        field('Amount', amount, `${account.currency}, up to ${exp} decimals`),
        err,
        go,
      ),
    });
  }

  async function transfer(accounts) {
    if (accounts.length < 2) {
      toast('Open a second account in the same currency to transfer between your accounts.', 'info');
      return;
    }
    const opt = (a) => h('option', { value: a.id }, `${a.currency} · ${shortId(a.id, 18)} · ${money(availableOf(a))}`);
    const from = h('select', null, accounts.map(opt));
    const to = h('select', null, accounts.map(opt));
    to.selectedIndex = 1;
    const amount = h('input', { inputmode: 'decimal', placeholder: '25.00', required: true });
    const reference = h('input', { maxlength: '60', placeholder: 'Optional reference' });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const go = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Review transfer');
    const idem = api.newIdempotencyKey('xfer');
    const d = dialog({
      title: 'Transfer between your accounts',
      content: h(
        'form',
        {
          class: 'stack',
          onsubmit: (e) => {
            e.preventDefault();
            err.textContent = '';
            const src = accounts.find((a) => a.id === from.value);
            const dst = accounts.find((a) => a.id === to.value);
            if (src.id === dst.id) return (err.textContent = 'Choose two different accounts.');
            if (src.currency !== dst.currency) return (err.textContent = 'Both accounts must use the same currency. Currency conversion is not enabled here.');
            const minor = toMinorUnits(amount.value, fiatExponent(src.currency));
            if (!minor || minor === '0') return (err.textContent = 'Enter a valid amount.');
            act(go, async () => {
              if (!(await requireStrong('Moving money'))) return;
              try {
                const { data } = await api.post(
                  '/payments',
                  { sourceAccountId: src.id, destinationAccountId: dst.id, amountMinorUnits: minor, currency: src.currency, purpose: 'OWN_ACCOUNT_TRANSFER', ...(reference.value ? { reference: reference.value } : {}) },
                  { idempotency: idem },
                );
                d.close();
                receipt(data);
                refreshAll();
              } catch (error) {
                err.textContent = friendlyMessage(error);
              }
            });
          },
        },
        field('From', from),
        field('To', to),
        field('Amount', amount),
        field('Reference', reference),
        err,
        go,
      ),
    });
  }

  function receipt(payment) {
    dialog({
      title: 'Transfer receipt',
      content: h(
        'div',
        { class: 'stack' },
        autoKv(payment, { limit: 18 }),
        note('Simulated sandbox transfer recorded on the canonical ledger. No external bank was contacted.'),
      ),
    });
  }

  accountsPanel = panel({
    title: 'Accounts',
    subtitle: 'Simulated demand-deposit accounts. Balances are read from the ledger.',
    wide: true,
    actions: [
      h('button', { class: 'btn btn-sm', onclick: (e) => promptCashAccount(e.currentTarget) }, 'Open account'),
      h('button', { class: 'btn btn-sm btn-primary', onclick: async () => transfer(items(await api.get('/accounts'))) }, 'Transfer'),
    ],
    load: () => api.get('/accounts'),
    empty: (d) => items(d).length === 0 && 'No accounts yet. Open a sandbox cash account to begin.',
    render: (d) =>
      table(
        [
          { label: 'Account', render: (a) => h('span', { class: 'mono' }, shortId(a.id, 22)) },
          { label: 'Type', render: (a) => humanize(a.productType || a.type) },
          { label: 'Currency', key: 'currency' },
          { label: 'Status', render: (a) => badge(a.status) },
          { label: 'Licensing', render: (a) => humanize((a.productConfiguration && a.productConfiguration.licensingClaim) || '') },
          { label: 'Available', align: 'right', render: (a) => money(availableOf(a)) },
          { label: '', render: (a) => h('button', { class: 'btn btn-sm btn-ghost', onclick: (e) => { e.stopPropagation(); fund(a); } }, 'Add funds') },
        ],
        items(d),
        { onRow: (a) => accountDetail(a) },
      ),
  });

  function accountDetail(account) {
    const body = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Loading…'));
    dialog({ title: `Account ${shortId(account.id, 18)}`, content: body });
    Promise.allSettled([api.get(`/accounts/${encodeURIComponent(account.id)}`), api.get(`/accounts/${encodeURIComponent(account.id)}/activity`)]).then(([detail, activity]) => {
      body.replaceChildren(
        detail.status === 'fulfilled'
          ? kv([
              ['Status', badge(detail.value.status)],
              ['Currency', detail.value.currency],
              ['Jurisdiction', detail.value.jurisdiction],
              ['Opened', dateTime(detail.value.openedAt)],
              ['Available', money(availableOf(detail.value))],
              ['Restrictions', (detail.value.restrictions || []).join(', ') || 'None'],
              ['Bank details', detail.value.providerLink ? 'Issued by provider' : 'None issued: no licensed banking partner is connected'],
            ])
          : h('p', { class: 'form-error' }, friendlyMessage(detail.reason)),
        h('h4', null, 'Activity'),
        activity.status === 'fulfilled' && items(activity.value).length
          ? table(
              [
                { label: 'When', render: (r) => dateTime(r.postedAt || r.occurredAt || r.createdAt) },
                { label: 'What', render: (r) => r.description || humanize(r.kind || r.type) },
                { label: 'Amount', align: 'right', render: (r) => money(r.amount || r.signedAmount, account.currency) },
              ],
              items(activity.value),
            )
          : h('p', { class: 'muted' }, activity.status === 'fulfilled' ? 'No activity yet.' : friendlyMessage(activity.reason)),
      );
    });
  }

  historyPanel = panel({
    title: 'Transfers',
    subtitle: 'Own-account transfers recorded by the payments service',
    className: 'panel-two-thirds',
    load: () => api.get('/payments'),
    empty: (d) => items(d).length === 0 && 'No transfers yet.',
    render: (d) =>
      table(
        [
          { label: 'When', render: (p) => dateTime(p.createdAt || p.requestedAt) },
          { label: 'Payment', render: (p) => h('span', { class: 'mono' }, shortId(p.paymentId || p.id, 14)) },
          { label: 'Status', render: (p) => badge(p.status || p.state) },
          { label: 'Amount', align: 'right', render: (p) => money(p.amount || { minorUnits: p.amountMinorUnits, currency: p.currency }) },
        ],
        items(d),
        { onRow: receipt },
      ),
  });

  return view(
    accountsPanel,
    historyPanel,
    panel({
      title: 'External banks',
      subtitle: 'Deposits from and withdrawals to outside banks',
      className: 'panel-third',
      load: () => api.get('/me/capabilities'),
      render: (c) =>
        h(
          'div',
          null,
          kv([
            ['Bank withdrawals', c.withdrawalsEnabled ? badge('ENABLED', 'positive') : badge('DISABLED')],
            ['Outbound payments', c.paymentsEnabled ? badge('ENABLED', 'positive') : badge('DISABLED')],
            ['Currency exchange', c.fxEnabled ? badge('ENABLED', 'positive') : badge('DISABLED')],
            ['Cards', c.cardsEnabled ? badge('ENABLED', 'positive') : badge('DISABLED')],
          ]),
          note('Real deposits and withdrawals stay off until a licensed banking or payment partner is contracted, certified and approved. No account numbers are shown because none have been issued.', 'warning'),
        ),
    }),
    panel({
      title: 'Settlements & reconciliation',
      subtitle: 'Money-integration read model',
      wide: true,
      load: () => api.get('/money/history'),
      empty: (d) => items(d).length === 0 && 'No settlements recorded.',
      render: (d) =>
        table(
          [
            { label: 'When', render: (r) => dateTime(r.occurredAt) },
            { label: 'Source', render: (r) => humanize(r.sourceType) },
            { label: 'Asset', render: (r) => r.assetId },
            { label: 'Finality', render: (r) => badge(r.finality) },
            { label: 'Reference', render: (r) => h('span', { class: 'mono' }, shortId(r.reference, 16)) },
            { label: 'Simulated', render: (r) => (r.sandboxSimulation ? 'Yes' : 'No') },
          ],
          items(d),
        ),
    }),
  );
}
