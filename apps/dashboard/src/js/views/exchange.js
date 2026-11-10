// SunRey Exchange (testnet SR/MR). Order books shown here come from the
// canonical Exchange's internal sandbox liquidity and are labelled as such.
// No price, fill or depth is synthesised client-side.

import { api, friendlyMessage } from '../api.js';
import { requireStrong } from '../auth.js';
import { assetLabel, dateTime, humanize, scaled, shortId, token } from '../format.js';
import { act, badge, dialog, field, h, kv, note, panel, svg, table, toast } from '../ui.js';
import { items, view } from './common.js';

const PRICE_DECIMALS = 6; // price units are quote-asset base units (6 decimals)

function price(units) {
  return units === null || units === undefined ? '—' : scaled(units, PRICE_DECIMALS, { minFraction: 2, maxFraction: 6 });
}

function coin(assetId) {
  const src = assetId === 'MOONREY_COIN' || assetId === 'MRC' ? '/assets/moonrey-coin.webp' : '/assets/sunrey-coin.webp';
  return h('img', { class: 'coin', src, alt: '', width: '28', height: '28' });
}

function candleChart(candles) {
  if (!candles || candles.length < 2) return null;
  const closes = candles.map((c) => Number(c.close ?? c.closePriceUnits ?? c.c));
  if (closes.some((x) => !Number.isFinite(x))) return null;
  const w = 600;
  const hgt = 160;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const pts = closes.map((v, i) => `${(i / (closes.length - 1)) * w},${hgt - 8 - ((v - min) / span) * (hgt - 16)}`).join(' ');
  // Display-only geometry; values are never fed back into any calculation.
  return svg('svg', { class: 'chart', viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Recorded trade prices' }, svg('polyline', { points: pts, fill: 'none', stroke: '#ffd21f', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
}

export function exchangeView() {
  let selected = null;
  const marketHost = h('div', { class: 'panel panel-wide' });
  let ordersPanel;
  let portfolioPanel;

  function bookSide(levels, side) {
    const maxQ = Math.max(1, ...levels.map((l) => Number(l.quantity) || 0));
    return h(
      'div',
      { class: 'book-side' },
      h('h4', null, side === 'bid' ? 'Bids' : 'Asks'),
      h('div', { class: 'book-row muted small' }, h('span', null, 'Price'), h('span', { class: 'num' }, 'Quantity')),
      levels.length === 0 ? h('p', { class: 'muted small' }, 'No orders.') : null,
      levels.map((l) =>
        h(
          'div',
          { class: `book-row ${side}` },
          h('span', { class: 'depth', style: `width:${Math.round(((Number(l.quantity) || 0) / maxQ) * 100)}%;background:${side === 'bid' ? '#2bd67b' : '#ff5c68'}` }),
          h('span', null, price(l.priceUnits)),
          h('span', { class: 'num' }, l.quantity),
        ),
      ),
    );
  }

  async function renderMarket(market) {
    selected = market;
    marketHost.replaceChildren(h('div', { class: 'panel-body' }, h('p', { class: 'muted' }, 'Loading market…')));
    const id = encodeURIComponent(market.marketId);
    const [detail, book, candles] = await Promise.allSettled([
      api.get(`/exchange/markets/${id}`),
      api.get(`/exchange/markets/${id}/order-book`),
      api.get(`/exchange/markets/${id}/candles`),
    ]);
    const d = detail.status === 'fulfilled' ? detail.value : null;
    const b = book.status === 'fulfilled' ? book.value : null;
    const mismatch = d && b && b.marketId && d.marketId && b.marketId !== d.marketId;
    const chart = candles.status === 'fulfilled' ? candleChart(candles.value.candles) : null;
    marketHost.replaceChildren(
      h('header', { class: 'panel-head' }, h('div', { class: 'asset-cell' }, coin(market.baseAsset), h('div', null, h('h3', null, market.symbol), h('p', { class: 'muted small' }, `${humanize(market.state)} · data ${humanize(market.marketDataStatus)} · ${humanize(market.liquiditySource || '')}`)))),
      h(
        'div',
        { class: 'panel-body stack' },
        note('Testnet market. Liquidity is the Exchange’s internal sandbox book, not real buyers and sellers. Prices here are not a market value for SR or MR.', 'warning'),
        d
          ? kv([
              ['Best bid', h('span', { class: 'bid' }, price(d.bestBid))],
              ['Best ask', h('span', { class: 'ask' }, price(d.bestAsk))],
              ['Spread', price(d.spreadUnits)],
              ['Last trade', d.lastEligibleTrade ? price(d.lastEligibleTrade.priceUnits || d.lastEligibleTrade) : 'No eligible trade yet'],
              ['Statistics', d.statistics && d.statistics.valid ? 'Valid' : humanize((d.statistics && d.statistics.reason) || 'Unavailable')],
              ['Warnings', (d.liquidityWarnings || []).map((w) => humanize(w)).join(', ') || 'None'],
              ['Data time', dateTime(d.dataTimestamp)],
            ])
          : h('p', { class: 'form-error' }, friendlyMessage(detail.reason)),
        h('h4', null, 'Price history'),
        chart || h('div', { class: 'chart-empty' }, candles.status === 'fulfilled' ? `No chart: ${humanize(candles.value.reason || 'insufficient trade history')}. Charts appear only from recorded trades.` : friendlyMessage(candles.reason)),
        h('h4', null, 'Order book'),
        mismatch ? note(`The backend returned the book for ${b.marketId}, not ${d.marketId}. Shown as returned; reported as a backend defect.`, 'warning') : null,
        b ? h('div', { class: 'book' }, bookSide(b.bids || [], 'bid'), bookSide(b.asks || [], 'ask')) : h('p', { class: 'form-error' }, friendlyMessage(book.reason)),
        ticket(market),
      ),
    );
  }

  function ticket(market) {
    let side = 'BUY';
    const buy = h('button', { type: 'button', class: 'buy', 'aria-pressed': 'true' }, 'Buy');
    const sell = h('button', { type: 'button', class: 'sell', 'aria-pressed': 'false' }, 'Sell');
    const setSide = (s) => {
      side = s;
      buy.setAttribute('aria-pressed', String(s === 'BUY'));
      sell.setAttribute('aria-pressed', String(s === 'SELL'));
    };
    buy.onclick = () => setSide('BUY');
    sell.onclick = () => setSide('SELL');
    const qty = h('input', { inputmode: 'numeric', placeholder: '1', required: true });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const go = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Get quote');
    return h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          err.textContent = '';
          const q = qty.value.trim();
          if (!/^[1-9]\d*$/.test(q)) return (err.textContent = 'Enter a whole number of units.');
          act(go, async () => {
            if (!(await requireStrong('Trading'))) return;
            try {
              const { data: quote } = await api.post('/exchange/quotes', { marketId: market.marketId, side, quantity: q });
              confirmOrder(market, side, q, quote);
            } catch (error) {
              err.textContent = friendlyMessage(error);
            }
          });
        },
      },
      h('h4', null, 'Place an order'),
      h('div', { class: 'row' }, h('div', { class: 'segmented', role: 'group', 'aria-label': 'Side' }, buy, sell), field(`Quantity (${assetLabel(market.baseAsset)} units)`, qty)),
      err,
      go,
    );
  }

  function confirmOrder(market, side, quantity, quote) {
    const confirm = h('button', { class: 'btn btn-primary btn-block' }, `Confirm ${side.toLowerCase()}`);
    const idem = api.newIdempotencyKey('order');
    const d = dialog({
      title: 'Review order',
      content: h(
        'div',
        { class: 'stack' },
        kv([
          ['Market', market.symbol],
          ['Side', badge(side, side === 'BUY' ? 'positive' : 'negative')],
          ['Quantity', quantity],
          ['Quoted price', price(quote.price)],
          ['Fee', quote.fee ?? '—'],
          ['Quote', h('span', { class: 'mono' }, shortId(quote.quoteId, 16))],
          ['Valid until', dateTime(quote.expiresAt || quote.validUntil)],
        ]),
        note('Testnet order against internal sandbox liquidity. A quote is not a guaranteed fill.', 'warning'),
        confirm,
      ),
    });
    confirm.onclick = () =>
      act(confirm, async () => {
        // stepUpSatisfied is sent only because requireStrong() just completed a
        // real TOTP step-up for this session.
        if (!(await requireStrong('Trading'))) return;
        const { data } = await api.post('/exchange/orders', { marketId: market.marketId, side, quantity, quoteId: quote.quoteId, confirmed: true, stepUpSatisfied: true }, { idempotency: idem });
        d.close();
        toast(`Order ${shortId(data.orderId, 14)} ${humanize(data.status)}.`, 'positive');
        ordersPanel.refresh();
        portfolioPanel.refresh();
        renderMarket(market);
      });
  }

  const marketsPanel = panel({
    title: 'Markets',
    subtitle: 'SunRey Coin and MoonRey Coin, native to SunRey Chain (testnet)',
    className: 'panel-third',
    load: () => api.get('/exchange/markets'),
    empty: (d) => items(d).length === 0 && 'No markets are listed.',
    render: (d) => {
      const rows = items(d);
      if (!selected && rows[0]) setTimeout(() => renderMarket(rows.find((r) => r.marketId === 'SRC-MRC') || rows[0]), 0);
      return table(
        [
          { label: 'Market', render: (m) => h('span', { class: 'asset-cell' }, coin(m.baseAsset), m.symbol) },
          { label: 'State', render: (m) => badge(m.state) },
        ],
        rows,
        { onRow: renderMarket },
      );
    },
  });

  portfolioPanel = panel({
    title: 'Exchange balances',
    subtitle: 'Custody balances for trading (testnet)',
    className: 'panel-two-thirds',
    actions: [
      h(
        'button',
        {
          class: 'btn btn-sm',
          onclick: (e) =>
            act(e.currentTarget, async () => {
              if (!(await requireStrong('Using the sandbox faucet'))) return;
              const { data } = await api.post('/exchange/fund', {});
              toast(`Sandbox faucet credited ${token(data.quantity, data.assetId)} (testnet).`, 'positive');
              portfolioPanel.refresh();
            }),
        },
        'Sandbox faucet',
      ),
    ],
    load: () => api.get('/exchange/portfolio'),
    render: (p) =>
      table(
        [
          { label: 'Asset', render: (a) => h('span', { class: 'asset-cell' }, coin(a.assetId), assetLabel(a.assetId)) },
          { label: 'Available', align: 'right', render: (a) => token(a.available, a.assetId) },
          { label: 'Reserved', align: 'right', render: (a) => token(a.reserved, a.assetId) },
          { label: 'Pending', align: 'right', render: (a) => token(a.pending, a.assetId) },
          { label: 'Finalized', align: 'right', render: (a) => token(a.finalized, a.assetId) },
        ],
        p.items || [],
      ),
  });

  ordersPanel = panel({
    title: 'Your orders',
    subtitle: 'Persisted by the canonical Exchange',
    wide: true,
    load: () => api.get('/exchange/orders'),
    empty: (d) => items(d).length === 0 && 'No orders yet.',
    render: (d, refresh) =>
      table(
        [
          { label: 'Order', render: (o) => h('span', { class: 'mono' }, shortId(o.orderId, 14)) },
          { label: 'Market', render: (o) => (o.marketId || o.symbol || '').replace(/^market:/, '') },
          { label: 'Side', render: (o) => badge(o.side, o.side === 'BUY' ? 'positive' : 'negative') },
          { label: 'Quantity', align: 'right', render: (o) => o.quantity },
          { label: 'Remaining', align: 'right', render: (o) => o.remaining ?? o.filledQuantity ?? '—' },
          { label: 'Avg price', align: 'right', render: (o) => price(o.averagePrice) },
          { label: 'Status', render: (o) => badge(o.status || o.view || (o.order && o.order.status) || 'UNKNOWN') },
          { label: 'Settlements', render: (o) => (o.settlementIds && o.settlementIds.length ? o.settlementIds.map((s) => shortId(s, 10)).join(', ') : '—') },
          {
            label: '',
            render: (o) =>
              ['PENDING', 'OPEN', 'PARTIALLY_FILLED', 'ACCEPTED'].includes(String(o.status || o.view || '').toUpperCase())
                ? h(
                    'button',
                    {
                      class: 'btn btn-sm btn-danger',
                      onclick: (e) =>
                        act(e.currentTarget, async () => {
                          if (!(await requireStrong('Cancelling an order'))) return;
                          await api.post(`/exchange/orders/${encodeURIComponent(o.orderId)}/cancel`, {});
                          toast('Cancellation submitted.', 'positive');
                          refresh();
                          portfolioPanel.refresh();
                        }),
                    },
                    'Cancel',
                  )
                : null,
          },
        ],
        items(d),
      ),
  });

  return view(
    marketsPanel,
    portfolioPanel,
    marketHost,
    ordersPanel,
    panel({
      title: 'Trade history',
      subtitle: 'Fills and exchange transactions',
      wide: true,
      load: async () => {
        const [fills, tx] = await Promise.all([api.get('/exchange/fills'), api.get('/exchange/transactions')]);
        return [...items(fills).map((f) => ({ ...f, _kind: 'FILL' })), ...items(tx)];
      },
      empty: (rows) => rows.length === 0 && 'No trades yet.',
      render: (rows) =>
        table(
          [
            { label: 'Kind', render: (r) => humanize(r._kind || r.kind) },
            { label: 'When', render: (r) => dateTime(r.occurredAt || r.executedAt || r.createdAt) },
            { label: 'Quantity', align: 'right', render: (r) => r.quantity ?? '—' },
            { label: 'Price', align: 'right', render: (r) => price(r.priceUnits || r.price) },
            { label: 'Reference', render: (r) => h('span', { class: 'mono' }, shortId(r.tradeId || r.settlementId || r.transactionId || '', 14)) },
          ],
          rows,
        ),
    }),
  );
}
