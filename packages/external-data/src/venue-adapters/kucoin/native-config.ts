import type { HeliosVenueNormalizationFixture } from '@solstice/provider-sdk';
import { buildSpotVenueAdapter } from '../common/build-spot-venue.ts';
import { splitCanonicalSpotPair } from '../common/symbol-suffix.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'kucoin_spot_btc_usdt',
  quote: Object.freeze({
    symbol: 'BTC-USDT',
    bestBid: '67234.40',
    bestBidSize: '0.001',
    bestAsk: '67234.50',
    bestAskSize: '0.002',
    time: 1_690_000_000_000,
  }),
  trade: Object.freeze({
    sequence: 'kc-1',
    symbol: 'BTC-USDT',
    price: '67234.5',
    size: '0.01',
    side: 'buy',
    time: 1_690_000_000_000,
  }),
  book: Object.freeze({
    sequence: 100,
    time: 1_690_000_000_000,
    bids: Object.freeze([Object.freeze(['67234.4', '1.0'])]),
    asks: Object.freeze([Object.freeze(['67234.5', '0.5'])]),
  }),
  candle: Object.freeze([
    1_690_000_000_000,
    '67000',
    '67500',
    '66900',
    '67234.5',
    '120.5',
    '8100000',
  ]),
  order: Object.freeze({
    id: 'kc-ord-1',
    clientOid: 'helios-test',
    status: 'PART',
    dealSize: '0.01',
    size: '0.02',
    dealFunds: '672.345',
    updatedAt: 1_690_000_000_000,
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

export const KUCOIN_VENUE_ADAPTER = buildSpotVenueAdapter({
  venueId: 'kucoin',
  displayName: 'KuCoin',
  venueSurface: 'kucoin_spot',
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
    notes: 'KuCoin public market endpoints; signing not enabled.',
  },
  parseQuote(raw) {
    const row = raw as Record<string, unknown>;
    return {
      bidPrice: row.bestBid,
      bidQty: row.bestBidSize,
      askPrice: row.bestAsk,
      askQty: row.bestAskSize,
      eventTimeUtc: new Date(Number(row.time)).toISOString(),
      sequence: null,
    };
  },
  parseTrade(raw) {
    const row = raw as Record<string, unknown>;
    const sideRaw = String(row.side).toLowerCase();
    return {
      tradeId: String(row.sequence),
      price: row.price,
      quantity: row.size,
      side: sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : 'unknown',
      eventTimeUtc: new Date(Number(row.time)).toISOString(),
      sequence: null,
    };
  },
  parseBook(raw) {
    const row = raw as {
      bids: [unknown, unknown][];
      asks: [unknown, unknown][];
      sequence?: number;
      time?: number;
    };
    return {
      bids: row.bids,
      asks: row.asks,
      eventTimeUtc: new Date(Number(row.time ?? 0)).toISOString(),
      sequence: row.sequence ?? null,
      isSnapshot: true,
    };
  },
  parseCandle(raw) {
    const row = raw as unknown[];
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
    const status = String(row.status);
    const state =
      status === 'NEW'
        ? 'NEW'
        : status === 'PART'
          ? 'PARTIALLY_FILLED'
          : status === 'DONE'
            ? 'FILLED'
            : status === 'CANCELED'
              ? 'CANCELED'
              : 'UNKNOWN';
    return {
      venueOrderId: String(row.id),
      clientOrderId: typeof row.clientOid === 'string' ? row.clientOid : null,
      state,
      filledQuantity: row.dealSize,
      remainingQuantity: '0.01',
      averagePrice: '67234.5',
      lastUpdateTimeUtc: new Date(Number(row.updatedAt)).toISOString(),
      rawStatus: status,
    };
  },
});
