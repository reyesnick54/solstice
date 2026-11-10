import { api } from '../api.js';
import { requireStrong } from '../auth.js';
import { CONFIG } from '../config.js';
import { assetLabel, dateTime, humanize, shortId, token } from '../format.js';
import { act, badge, dialog, field, h, kv, note, panel, table, toast } from '../ui.js';
import { autoKv, items, view } from './common.js';
import { isDemo } from '../demo/state.js';

const NATIVE = [
  { assetId: 'SUNREY_COIN', label: 'SunRey Coin', short: 'SRC', img: '/assets/sunrey-coin.webp' },
  { assetId: 'MOONREY_COIN', label: 'MoonRey Coin', short: 'MRC', img: '/assets/moonrey-coin.webp' },
];

function explorerLink(kind, id) {
  if (!CONFIG.explorerUrl || !id) return null;
  return h('a', { href: `${CONFIG.explorerUrl}/${kind}/${encodeURIComponent(id)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Explorer ↗');
}

export function walletsView() {
  let walletsPanel;
  let txPanel;

  walletsPanel = panel({
    title: 'Native wallets',
    subtitle: 'SR and MR on SunRey Chain. Network is reported by the backend.',
    wide: true,
    actions: [
      h(
        'button',
        {
          class: 'btn btn-sm btn-primary',
          onclick: () => {
            const asset = h('select', null, NATIVE.map((a) => h('option', { value: a.assetId }, a.label)));
            const go = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Create wallet');
            const idem = api.newIdempotencyKey('wallet');
            const d = dialog({
              title: 'Create a native wallet',
              content: h(
                'form',
                {
                  class: 'stack',
                  onsubmit: (e) => {
                    e.preventDefault();
                    act(go, async () => {
                      if (!(await requireStrong('Creating a wallet'))) return;
                      await api.post('/wallets', { assetId: asset.value }, { idempotency: idem });
                      d.close();
                      toast('Wallet created (testnet).', 'positive');
                      walletsPanel.refresh();
                      txPanel.refresh();
                    });
                  },
                },
                note('Keys are held by SunRey’s simulated custody. Production signing and mainnet are not active.'),
                field('Asset', asset),
                go,
              ),
            });
          },
        },
        'Create wallet',
      ),
    ],
    load: async () => {
      const [wallets, sr, mr] = await Promise.allSettled([api.get('/wallets'), api.get('/wallets/SRC'), api.get('/wallets/MRC')]);
      return { wallets, sr, mr };
    },
    render: ({ wallets, sr, mr }) => {
      const list = wallets.status === 'fulfilled' ? items(wallets.value) : [];
      const flags = wallets.status === 'fulfilled' ? wallets.value : {};
      return h(
        'div',
        { class: 'stack' },
        h(
          'div',
          { class: 'coin-cards' },
          [sr, mr].map((r, i) => {
            const meta = NATIVE[i];
            const w = r.status === 'fulfilled' ? r.value : null;
            const bal = w ? w.balance || w.available || w.balances || w : null;
            const qty = bal && typeof bal === 'object' ? bal.available ?? bal.quantity ?? bal.finalized ?? null : bal;
            return h(
              'div',
              { class: `coin-card ${i === 0 ? 'coin-card-sun' : 'coin-card-moon'}` },
              h('img', { class: 'coin-art', src: meta.img, alt: meta.label, width: '112', height: '120' }),
              h(
                'div',
                { class: 'coin-card-body' },
                h('span', { class: 'stat-label' }, `${meta.label} · ${meta.short}`),
                h('span', { class: 'coin-card-value' }, qty !== null && qty !== undefined ? token(qty, meta.assetId, { maxFraction: 2 }) : '—'),
                h('span', { class: 'stat-note' }, w ? humanize(w.network || w.chainEnvironment || w.environment || 'testnet') : 'No balance view'),
              ),
            );
          }),
        ),
        list.length
          ? table(
              [
                { label: 'Wallet', render: (w) => h('span', { class: 'mono' }, shortId(w.walletId || w.id, 14)) },
                { label: 'Asset', render: (w) => assetLabel(w.assetId) },
                { label: 'Address', render: (w) => h('span', { class: 'mono' }, shortId(w.address || w.depositAddress || '', 16)) },
                { label: 'Network', render: (w) => badge(w.network || w.chainEnvironment || 'TESTNET', 'info') },
                { label: 'Status', render: (w) => badge(w.status || 'ACTIVE') },
                { label: '', render: (w) => explorerLink('address', w.address || w.depositAddress) },
              ],
              list,
            )
          : h('p', { class: 'muted' }, 'No wallets yet. Create one to receive testnet SR or MR.'),
        kv([
          ['Production signing', flags.productionSigningAuthorized ? badge('AUTHORIZED', 'positive') : badge('NOT AUTHORIZED')],
          ['Production money movement', flags.productionMoneyMovement ? badge('ON', 'positive') : badge('OFF')],
          ['Explorer', CONFIG.explorerUrl ? h('a', { href: CONFIG.explorerUrl, target: '_blank', rel: 'noopener noreferrer' }, CONFIG.explorerUrl.replace(/^https?:\/\//, '')) : 'Not configured'],
        ]),
      );
    },
  });

  txPanel = panel({
    title: 'Wallet transactions',
    wide: true,
    actions: [
      h(
        'button',
        {
          class: 'btn btn-sm',
          onclick: (e) =>
            act(e.currentTarget, async () => {
              if (!(await requireStrong('Simulating a deposit'))) return;
              await api.post('/wallets/deposits/simulate', { quantity: '25' });
              toast('Simulated testnet deposit submitted.', 'positive');
              txPanel.refresh();
              walletsPanel.refresh();
            }),
        },
        'Simulate deposit',
      ),
    ],
    load: () => api.get('/wallets/transactions'),
    empty: (d) => items(d).length === 0 && 'No wallet transactions yet.',
    render: (d) =>
      table(
        [
          { label: 'When', render: (t) => dateTime(t.occurredAt || t.createdAt) },
          { label: 'Type', render: (t) => humanize(t.kind || t.type || t.direction) },
          { label: 'Amount', align: 'right', render: (t) => token(t.quantity ?? t.amount, t.assetId) },
          { label: 'Status', render: (t) => badge(t.status || t.finality) },
          { label: 'Confirmations', align: 'right', render: (t) => t.confirmations ?? '—' },
          { label: 'Block', align: 'right', render: (t) => t.blockHeight ?? '—' },
          { label: 'Tx', render: (t) => h('span', { class: 'mono' }, shortId(t.txHash || t.transactionId || t.id, 14)) },
          { label: '', render: (t) => explorerLink('tx', t.txHash || t.transactionId) },
        ],
        items(d),
      ),
  });

  return view(
    walletsPanel,
    isDemo()
      ? panel({
          title: 'SunRey Chain',
          subtitle: 'Network status',
          wide: true,
          load: () => api.get('/chain/status'),
          render: (c) => h('div', { class: 'kv-grid' }, autoKv(c, { only: ['network', 'blockHeight', 'finalizedHeight', 'averageBlockTime', 'finality'] }), autoKv(c, { only: ['validators', 'transactionsInLastDay', 'pendingTransactions', 'mainnetActive'] })),
        })
      : null,
    txPanel,
    panel({
      title: 'SunRey Coin',
      subtitle: 'Asset registry entry',
      load: () => api.get('/economy/sunrey-coin'),
      render: (d) => autoKv(d.asset || d, { only: ['canonicalName', 'status', 'decimals', 'supplyModel', 'assetClass', 'ledgerKind', 'erc20', 'evmToken', 'tickerStatus'] }),
    }),
    panel({
      title: 'MoonRey Coin',
      subtitle: 'Asset registry entry',
      load: () => api.get('/economy/moonrey-coin'),
      render: (d) => autoKv(d.asset || d, { only: ['canonicalName', 'status', 'decimals', 'supplyModel', 'assetClass', 'ledgerKind', 'erc20', 'evmToken', 'tickerStatus'] }),
    }),
  );
}
