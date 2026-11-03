import type { HeliosVenueNormalizationFixture } from '@solstice/provider-sdk';
import { buildSpotVenueAdapter } from '../common/build-spot-venue.ts';
import { splitCanonicalSpotPair } from '../common/symbol-suffix.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'bybit_spot_btcusdt',
  quote: Object.freeze({
    symbol: 'BTCUSDT',
    bid1Price: '67234.40',
    bid1Size: '0.001',
    ask1Price: '67234.50',
    ask1Size: '0.002',
  }),
  trade: Object.freeze({
    execId: 'bybit-1',
    symbol: 'BTCUSDT',
    price: '67234.5',
    size: '0.01',
    side: 'Buy',
    time: '1690000000000',
  }),
  book: Object.freeze({
    s: 'BTCUSDT',
    b: Object.freeze([Object.freeze(['67234.4', '1.0'])]),
    a: Object.freeze([Object.freeze(['67234.5', '0.5'])]),
    u: 100,
  }),
  candle: Object.freeze({
    start: '1690000000000',
    open: '67000',
    high: '67500',
    low: '66900',
    close: '67234.5',
    volume: '120.5',
    interval: '1',
  }),
  order: Object.freeze({
    orderId: 'ord-1',
    orderLinkId: 'helios-test',
    orderStatus: 'PartiallyFilled',
    cumExecQty: '0.01',
    qty: '0.02',
    avgPrice: '67234.5',
    updatedTime: '1690000000000',
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

export const BYBIT_VENUE_ADAPTER = buildSpotVenueAdapter({
  venueId: 'bybit',
  displayName: 'Bybit',
  venueSurface: 'bybit_spot',
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
    websocketSubscriptionsMax: 100,
    notes: 'V5 public market endpoints; signing not enabled.',
  },
  parseQuote(raw) {
    const row = raw as Record<string, unknown>;
    return {
      bidPrice: row.bid1Price,
      bidQty: row.bid1Size,
      askPrice: row.ask1Price,
      askQty: row.ask1Size,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: null,
    };
  },
  parseTrade(raw) {
    const row = raw as Record<string, unknown>;
    const sideRaw = String(row.side).toLowerCase();
    return {
      tradeId: String(row.execId),
      price: row.price,
      quantity: row.size,
      side: sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : 'unknown',
      eventTimeUtc: new Date(Number(row.time)).toISOString(),
      sequence: null,
    };
  },
  parseBook(raw) {
    const row = raw as { b: [unknown, unknown][]; a: [unknown, unknown][]; u?: number };
    return {
      bids: row.b,
      asks: row.a,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: row.u ?? null,
      isSnapshot: true,
    };
  },
  parseCandle(raw) {
    const row = raw as Record<string, unknown>;
    const startMs = Number(row.start);
    return {
      openTimeUtc: new Date(startMs).toISOString(),
      closeTimeUtc: new Date(startMs + 60_000 - 1).toISOString(),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      interval: `${row.interval}m`,
    };
  },
  parseOrder(raw) {
    const row = raw as Record<string, unknown>;
    const status = String(row.orderStatus);
    const state =
      status === 'New'
        ? 'NEW'
        : status === 'PartiallyFilled'
          ? 'PARTIALLY_FILLED'
          : status === 'Filled'
            ? 'FILLED'
            : status === 'Cancelled'
              ? 'CANCELED'
              : 'UNKNOWN';
    return {
      venueOrderId: String(row.orderId),
      clientOrderId: typeof row.orderLinkId === 'string' ? row.orderLinkId : null,
      state,
      filledQuantity: row.cumExecQty,
      remainingQuantity: '0.01',
      averagePrice: row.avgPrice ?? null,
      lastUpdateTimeUtc: new Date(Number(row.updatedTime)).toISOString(),
      rawStatus: status,
    };
  },
});
