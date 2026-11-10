// SunRey Exchange (testnet SR/MR). Order books shown here come from the
// canonical Exchange's internal sandbox liquidity and are labelled as such.
// No price, fill or depth is synthesised client-side.

import { api, friendlyMessage } from '../api.js';
import { requireStrong } from '../auth.js';
import { assetLabel, dateTime, humanize, money, relative, scaled, shortId, token } from '../format.js';
import { act, badge, dialog, field, h, kv, note, panel, svg, table, toast } from '../ui.js';
import { items, view } from './common.js';

const PRICE_DECIMALS = 6; // price units are quote-asset base units (6 decimals)

function price(units) {
  return units === null || units === undefined ? '—' : scaled(units, PRICE_DECIMALS, { minFraction: 2, maxFraction: 6 });
}

function coin(assetId, size = 28) {
  const moon = assetId === 'MOONREY_COIN' || assetId === 'MRC';
  const src = moon ? '/assets/moonrey-coin.webp' : '/assets/sunrey-coin.webp';
  return h('img', { class: `coin${size > 28 ? ' coin-lg' : ''}`, src, alt: moon ? 'MoonRey Coin' : 'SunRey Coin', width: String(size), height: String(size) });
}

/** Signed change in basis points, shown as a percentage of price (market data, not a return). */
function changeBps(bps) {
  if (bps === null || bps === undefined) return '—';
  const v = String(bps);
  const neg = v.startsWith('-');
  const text = scaled(neg ? v.slice(1) : v, 2, { minFraction: 2, maxFraction: 2 });
  return h('span', { class: neg ? 'ask' : 'bid' }, `${neg ? '−' : '+'}${text}%`);
}

/** A quote-side amount: USD as money, SR/MR as tokens. */
function quoteAmount(units, quoteAsset) {
  if (units === null || units === undefined) return '—';
  return quoteAsset === 'USD' ? money({ minorUnits: units, currency: 'USD' }) : token(units, quoteAsset, { maxFraction: 2 });
}

function candleChart(candles) {
  if (!candles || candles.length < 2) return null;
  const closes = candles.map((c) => Number(c.close ?? c.closePriceUnits ?? c.c));
  if (closes.some((x) => !Number.isFinite(x))) return null;
  const vols = candles.map((c) => Number(c.volume || 0));
  // Display-only geometry; values are never fed back into any calculation.
  const w = 800;
  const top = 18;
  const priceH = 200;
  const volH = 44;
  const hgt = top + priceH + 8 + volH;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const x = (i) => (i / (closes.length - 1)) * w;
  const y = (v) => top + priceH - ((v - min) / span) * priceH;
  const line = closes.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `0,${top + priceH} ${line} ${w},${top + priceH}`;
  const maxVol = Math.max(1, ...vols);
  const barW = w / closes.length;
  const grid = [0, 1, 2, 3].map((k) => svg('line', { class: 'chart-grid', x1: 0, x2: w, y1: top + (priceH / 3) * k, y2: top + (priceH / 3) * k }));
  const bars = vols.map((v, i) =>
    svg('rect', {
      class: closes[i] >= (closes[i - 1] ?? closes[i]) ? 'chart-vol up' : 'chart-vol down',
      x: i * barW + 1,
      width: Math.max(1, barW - 2),
      y: hgt - (v / maxVol) * volH,
      height: (v / maxVol) * volH,
    }),
  );
  const chart = svg(
    'svg',
    { class: 'chart', viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Price over the last 24 hours, with volume' },
    svg('defs', null, svg('linearGradient', { id: 'chart-fill', x1: 0, x2: 0, y1: 0, y2: 1 }, svg('stop', { offset: '0%', class: 'chart-fill-top' }), svg('stop', { offset: '100%', class: 'chart-fill-bottom' }))),
    ...grid,
    svg('polygon', { points: area, class: 'chart-area' }),
    svg('polyline', { points: line, fill: 'none', stroke: 'currentColor', 'vector-effect': 'non-scaling-stroke' }),
    ...bars,
  );
  const first = candles[0];
  const last = candles[candles.length - 1];
  return h(
    'figure',
    { class: 'chart-wrap' },
    h('div', { class: 'chart-scale' }, h('span', null, price(String(max))), h('span', null, price(String(min)))),
    chart,
    h('figcaption', { class: 'chart-axis' }, h('span', null, dateTime(first.openTime)), h('span', null, `${candles.length} × ${first.interval || '15m'} candles`), h('span', null, dateTime(last.openTime))),
  );
}

export function exchangeView() {
  let selected = null;
  const marketHost = h('div', { class: 'panel panel-wide' });
  let ordersPanel;
  let portfolioPanel;

  function bookSide(levels, side) {
    let running = 0n;
    const totals = levels.map((l) => {
      running += /^\d+$/.test(String(l.quantity)) ? BigInt(l.quantity) : 0n;
      return running;
    });
    const maxTotal = totals.length ? totals[totals.length - 1] : 0n;
    const pct = (t) => (maxTotal > 0n ? Number((t * 100n) / maxTotal) : 0);
    return h(
      'div',
      { class: 'book-side' },
      h('h4', null, side === 'bid' ? 'Bids' : 'Asks'),
      h('div', { class: 'book-row book-head' }, h('span', null, 'Price'), h('span', null, 'Quantity'), h('span', null, 'Total')),
      levels.length === 0 ? h('p', { class: 'muted small' }, 'No orders.') : null,
      levels.map((l, i) =>
        h(
          'div',
          { class: `book-row ${side}` },
          h('span', { class: `depth depth-${side === 'bid' ? 'bid' : 'ask'}`, style: `width:${pct(totals[i])}%` }),
          h('span', null, price(l.priceUnits)),
          h('span', null, l.quantity),
          h('span', null, String(totals[i])),
        ),
      ),
    );
  }

  function tradeTape(trades) {
    const rows = items(trades).slice(0, 14);
    if (!rows.length) return null;
    return h(
      'div',
      { class: 'tape' },
      h('h4', null, 'Recent trades'),
      h('div', { class: 'book-row book-head' }, h('span', null, 'Price'), h('span', null, 'Quantity'), h('span', null, 'Time')),
      rows.map((t) => h('div', { class: `book-row ${t.side === 'SELL' ? 'ask' : 'bid'}` }, h('span', null, price(t.priceUnits)), h('span', null, t.quantity), h('span', { class: 'muted' }, relative(t.executedAt)))),
    );
  }

  /** Every figure the market reports, grouped: price, 24h activity, liquidity. */
  function marketStats(market, d) {
    const st = d.statistics || {};
    const ok = st.valid;
    const base = market.baseAsset;
    const tile = (label, value, tone) => h('div', { class: `mstat${tone ? ' ' + tone : ''}` }, h('span', { class: 'mstat-label' }, label), h('span', { class: 'mstat-value' }, value));
    const groups = [
      ['Price', [
        tile('Last', d.lastEligibleTrade ? price(d.lastEligibleTrade.priceUnits || d.lastEligibleTrade) : 'No trade yet'),
        tile('Best bid', price(d.bestBid), 'bid'),
        tile('Best ask', price(d.bestAsk), 'ask'),
        tile('Spread', price(d.spreadUnits)),
      ]],
      ['Last 24 hours', [
        tile('Open', ok && st.openPriceUnits ? price(st.openPriceUnits) : '—'),
        tile('High', ok ? price(st.highPriceUnits) : '—'),
        tile('Low', ok ? price(st.lowPriceUnits) : '—'),
        tile('VWAP', ok && st.vwapUnits ? price(st.vwapUnits) : '—'),
        tile('Change', market.change24hBps !== undefined ? changeBps(market.change24hBps) : '—'),
        tile('Trades', ok ? String(st.tradeCount) : '—'),
        tile(`Volume (${assetLabel(base)})`, ok && st.volume ? token(st.volume, base, { maxFraction: 0 }) : '—'),
        tile(`Volume (${assetLabel(market.quoteAsset)})`, ok && st.quoteVolume ? quoteAmount(st.quoteVolume, market.quoteAsset) : '—'),
      ]],
      ['Liquidity', [
        tile('Bid depth', d.depthSummary ? token(d.depthSummary.bidDepth, base, { maxFraction: 0 }) : '—'),
        tile('Ask depth', d.depthSummary ? token(d.depthSummary.askDepth, base, { maxFraction: 0 }) : '—'),
        tile('Warnings', (d.liquidityWarnings || []).map((w) => humanize(w)).join(', ') || 'None'),
        tile('Data time', dateTime(d.dataTimestamp)),
      ]],
    ];
    return h(
      'div',
      { class: 'mstats' },
      !ok ? h('p', { class: 'muted small' }, `Statistics: ${humanize(st.reason || 'unavailable')}.`) : null,
      groups.map(([title, tiles]) => h('section', { class: 'mstat-group' }, h('h4', null, title), h('div', { class: 'mstat-grid' }, tiles))),
    );
  }

  async function renderMarket(market) {
    selected = market;
    marketHost.replaceChildren(h('div', { class: 'panel-body' }, h('p', { class: 'muted' }, 'Loading market…')));
    const id = encodeURIComponent(market.marketId);
    const [detail, book, candles, trades] = await Promise.allSettled([
      api.get(`/exchange/markets/${id}`),
      api.get(`/exchange/markets/${id}/order-book`),
      api.get(`/exchange/markets/${id}/candles`),
      api.get(`/exchange/markets/${id}/trades`),
    ]);
    const d = detail.status === 'fulfilled' ? detail.value : null;
    const b = book.status === 'fulfilled' ? book.value : null;
    const mismatch = d && b && b.marketId && d.marketId && b.marketId !== d.marketId;
    const chart = candles.status === 'fulfilled' ? candleChart(candles.value.candles) : null;
    marketHost.replaceChildren(
      h(
        'header',
        { class: 'panel-head market-head' },
        h('div', { class: 'asset-cell' }, coin(market.baseAsset, 56), h('div', null, h('h3', null, market.symbol), h('p', { class: 'muted small' }, `${humanize(market.state)} · data ${humanize(market.marketDataStatus)} · ${humanize(market.liquiditySource || '')}`))),
        d && d.lastEligibleTrade ? h('div', { class: 'market-last' }, h('span', { class: 'market-price' }, price(d.lastEligibleTrade.priceUnits || d.lastEligibleTrade)), market.change24hBps !== undefined ? changeBps(market.change24hBps) : null) : null,
      ),
      h(
        'div',
        { class: 'panel-body stack' },
        note('Testnet market. Liquidity is the Exchange’s internal sandbox book, not real buyers and sellers. Prices here are not a market value for SR or MR.', 'warning'),
        d ? marketStats(market, d) : h('p', { class: 'form-error' }, friendlyMessage(detail.reason)),
        h('h4', null, 'Price history'),
        chart || h('div', { class: 'chart-empty' }, candles.status === 'fulfilled' ? `No chart: ${humanize(candles.value.reason || 'insufficient trade history')}. Charts appear only from recorded trades.` : friendlyMessage(candles.reason)),
        h('h4', null, 'Order book'),
        mismatch ? note(`The backend returned the book for ${b.marketId}, not ${d.marketId}. Shown as returned; reported as a backend defect.`, 'warning') : null,
        b ? h('div', { class: 'book' }, bookSide(b.bids || [], 'bid'), bookSide(b.asks || [], 'ask')) : h('p', { class: 'form-error' }, friendlyMessage(book.reason)),
        trades.status === 'fulfilled' ? tradeTape(trades.value) : null,
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
      const rich = rows.some((m) => m.lastPriceUnits !== undefined);
      return table(
        [
          { label: 'Market', render: (m) => h('span', { class: 'asset-cell' }, coin(m.baseAsset), m.symbol) },
          ...(rich
            ? [
                { label: 'Last', align: 'right', render: (m) => price(m.lastPriceUnits) },
                { label: '24h', align: 'right', render: (m) => changeBps(m.change24hBps) },
              ]
            : [{ label: 'State', render: (m) => badge(m.state) }]),
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
          { label: 'Asset', render: (a) => h('span', { class: 'asset-cell' }, coin(a.assetId, 36), h('span', null, h('strong', null, assetLabel(a.assetId)), h('span', { class: 'muted small block' }, a.assetId === 'MOONREY_COIN' ? 'MoonRey Coin' : 'SunRey Coin'))) },
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
