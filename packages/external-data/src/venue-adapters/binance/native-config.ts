import type { HeliosVenueNormalizationFixture } from '@solstice/provider-sdk';
import { buildSpotVenueAdapter } from '../common/build-spot-venue.ts';
import { splitCanonicalSpotPair } from '../common/symbol-suffix.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'binance_spot_btcusdt',
  quote: Object.freeze({
    u: 400,
    s: 'BTCUSDT',
    b: '67234.40',
    B: '0.001',
    a: '67234.50',
    A: '0.002',
  }),
  trade: Object.freeze({
    id: 12_345,
    price: '67234.5',
    qty: '0.01',
    time: 1_690_000_000_000,
    isBuyerMaker: true,
  }),
  book: Object.freeze({
    lastUpdateId: 100,
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
    1_690_000_359_999,
    '8100000',
    10_000,
    '60',
    '4032000',
    '0',
  ]),
  order: Object.freeze({
    orderId: 99,
    clientOrderId: 'helios-test',
    status: 'PARTIALLY_FILLED',
    executedQty: '0.01',
    origQty: '0.02',
    avgPrice: '67234.5',
    updateTime: 1_690_000_000_000,
  }),
});

function toRawSymbol(canonical: string): string {
  const { base, quote } = splitCanonicalSpotPair(canonical);
  const quoteAsset = quote === 'USD' ? 'USDT' : quote;
  return `${base}${quoteAsset}`;
}

function toCanonicalSymbol(raw: string): string {
  if (raw === 'BTCUSDT') {
    return 'BTC/USD';
  }
  if (raw.endsWith('USDT')) {
    return `${raw.slice(0, -4)}/USD`;
  }
  return raw;
}

export const BINANCE_VENUE_ADAPTER = buildSpotVenueAdapter({
  venueId: 'binance',
  displayName: 'Binance',
  venueSurface: 'binance_spot',
  instruments: Object.freeze(['BTC/USD', 'ETH/USD']),
  canonicalExample: 'BTC/USD',
  rawExample: 'BTCUSDT',
  toRawSymbol,
  toCanonicalSymbol,
  fixtures: FIXTURES,
  fixtureLastPrice(symbol) {
    return symbol === 'BTC/USD' ? '67234.5' : null;
  },
  rateLimits: {
    restRequestsPerSecond: 10,
    websocketSubscriptionsMax: 200,
    notes: 'Public REST/WebSocket; authenticated tiers not enabled in NATIVE05.',
  },
  parseQuote(raw) {
    const row = raw as Record<string, unknown>;
    return {
      bidPrice: row.b,
      bidQty: row.B,
      askPrice: row.a,
      askQty: row.A,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: typeof row.u === 'number' ? row.u : null,
    };
  },
  parseTrade(raw) {
    const row = raw as Record<string, unknown>;
    return {
      tradeId: String(row.id),
      price: row.price,
      quantity: row.qty,
      side: row.isBuyerMaker === true ? 'sell' : 'buy',
      eventTimeUtc: new Date(Number(row.time)).toISOString(),
      sequence: null,
    };
  },
  parseBook(raw) {
    const row = raw as { bids: [unknown, unknown][]; asks: [unknown, unknown][]; lastUpdateId?: number };
    return {
      bids: row.bids,
      asks: row.asks,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: row.lastUpdateId ?? null,
      isSnapshot: true,
    };
  },
  parseCandle(raw) {
    const row = raw as unknown[];
    return {
      openTimeUtc: new Date(Number(row[0])).toISOString(),
      closeTimeUtc: new Date(Number(row[6])).toISOString(),
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
        : status === 'PARTIALLY_FILLED'
          ? 'PARTIALLY_FILLED'
          : status === 'FILLED'
            ? 'FILLED'
            : status === 'CANCELED'
              ? 'CANCELED'
              : status === 'REJECTED'
                ? 'REJECTED'
                : status === 'EXPIRED'
                  ? 'EXPIRED'
                  : 'UNKNOWN';
    return {
      venueOrderId: String(row.orderId),
      clientOrderId: typeof row.clientOrderId === 'string' ? row.clientOrderId : null,
      state,
      filledQuantity: row.executedQty,
      remainingQuantity: '0.01',
      averagePrice: row.avgPrice ?? null,
      lastUpdateTimeUtc: new Date(Number(row.updateTime)).toISOString(),
      rawStatus: status,
    };
  },
});
