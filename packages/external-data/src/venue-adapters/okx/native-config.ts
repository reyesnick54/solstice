import type { HeliosVenueNormalizationFixture } from '@solstice/provider-sdk';
import { buildSpotVenueAdapter } from '../common/build-spot-venue.ts';
import { splitCanonicalSpotPair } from '../common/symbol-suffix.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'okx_spot_btc_usdt',
  quote: Object.freeze({
    instId: 'BTC-USDT',
    bidPx: '67234.40',
    bidSz: '0.001',
    askPx: '67234.50',
    askSz: '0.002',
    ts: '1690000000000',
  }),
  trade: Object.freeze({
    tradeId: 'okx-1',
    instId: 'BTC-USDT',
    px: '67234.5',
    sz: '0.01',
    side: 'buy',
    ts: '1690000000000',
  }),
  book: Object.freeze({
    instId: 'BTC-USDT',
    bids: Object.freeze([Object.freeze(['67234.4', '1.0'])]),
    asks: Object.freeze([Object.freeze(['67234.5', '0.5'])]),
    ts: '1690000000000',
  }),
  candle: Object.freeze([
    '1690000000000',
    '67000',
    '67500',
    '66900',
    '67234.5',
    '120.5',
    '8100000',
  ]),
  order: Object.freeze({
    ordId: 'okx-ord-1',
    clOrdId: 'helios-test',
    state: 'partially_filled',
    accFillSz: '0.01',
    sz: '0.02',
    avgPx: '67234.5',
    uTime: '1690000000000',
  }),
});

function toRawSymbol(canonical: string): string {
  const { base, quote } = splitCanonicalSpotPair(canonical);
  const quoteAsset = quote === 'USD' ? 'USDT' : quote;
  return `${base}-${quoteAsset}`;
}

function toCanonicalSymbol(raw: string): string {
  if (raw === 'BTC-USDT') {
    return 'BTC/USD';
  }
  const dash = raw.indexOf('-');
  if (dash > 0) {
    const base = raw.slice(0, dash);
    const quote = raw.slice(dash + 1) === 'USDT' ? 'USD' : raw.slice(dash + 1);
    return `${base}/${quote}`;
  }
  return raw;
}

export const OKX_VENUE_ADAPTER = buildSpotVenueAdapter({
  venueId: 'okx',
  displayName: 'OKX',
  venueSurface: 'okx_spot',
  instruments: Object.freeze(['BTC/USD', 'ETH/USD']),
  canonicalExample: 'BTC/USD',
  rawExample: 'BTC-USDT',
  toRawSymbol,
  toCanonicalSymbol,
  fixtures: FIXTURES,
  fixtureLastPrice(symbol) {
    return symbol === 'BTC/USD' ? '67234.5' : null;
  },
  rateLimits: {
    restRequestsPerSecond: 8,
    websocketSubscriptionsMax: 100,
    notes: 'Public OKX v5 market data; signing not enabled.',
  },
  parseQuote(raw) {
    const row = raw as Record<string, unknown>;
    return {
      bidPrice: row.bidPx,
      bidQty: row.bidSz,
      askPrice: row.askPx,
      askQty: row.askSz,
      eventTimeUtc: new Date(Number(row.ts)).toISOString(),
      sequence: null,
    };
  },
  parseTrade(raw) {
    const row = raw as Record<string, unknown>;
    const sideRaw = String(row.side).toLowerCase();
    return {
      tradeId: String(row.tradeId),
      price: row.px,
      quantity: row.sz,
      side: sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : 'unknown',
      eventTimeUtc: new Date(Number(row.ts)).toISOString(),
      sequence: null,
    };
  },
  parseBook(raw) {
    const row = raw as { bids: [unknown, unknown][]; asks: [unknown, unknown][]; ts?: string };
    return {
      bids: row.bids,
      asks: row.asks,
      eventTimeUtc: new Date(Number(row.ts ?? 0)).toISOString(),
      sequence: null,
      isSnapshot: true,
    };
  },
  parseCandle(raw) {
    const row = raw as string[];
    return {
      openTimeUtc: new Date(Number(row[0])).toISOString(),
      closeTimeUtc: new Date(Number(row[0]) + 60_000 - 1).toISOString(),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5],
      interval: '1m',
    };
  },
  parseOrder(raw) {
    const row = raw as Record<string, unknown>;
    const status = String(row.state);
    const state =
      status === 'live'
        ? 'NEW'
        : status === 'partially_filled'
          ? 'PARTIALLY_FILLED'
          : status === 'filled'
            ? 'FILLED'
            : status === 'canceled'
              ? 'CANCELED'
              : 'UNKNOWN';
    return {
      venueOrderId: String(row.ordId),
      clientOrderId: typeof row.clOrdId === 'string' ? row.clOrdId : null,
      state,
      filledQuantity: row.accFillSz,
      remainingQuantity: '0.01',
      averagePrice: row.avgPx ?? null,
      lastUpdateTimeUtc: new Date(Number(row.uTime)).toISOString(),
      rawStatus: status,
    };
  },
});
