import type { HeliosVenueNormalizationFixture } from '@solstice/provider-sdk';
import { buildSpotVenueAdapter } from '../common/build-spot-venue.ts';
import { splitCanonicalSpotPair } from '../common/symbol-suffix.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'bitget_spot_btcusdt',
  quote: Object.freeze({
    symbol: 'BTCUSDT',
    bidPr: '67234.40',
    bidSz: '0.001',
    askPr: '67234.50',
    askSz: '0.002',
  }),
  trade: Object.freeze({
    tradeId: 'bg-1',
    symbol: 'BTCUSDT',
    price: '67234.5',
    size: '0.01',
    side: 'buy',
    ts: '1690000000000',
  }),
  book: Object.freeze({
    symbol: 'BTCUSDT',
    bids: Object.freeze([Object.freeze(['67234.4', '1.0'])]),
    asks: Object.freeze([Object.freeze(['67234.5', '0.5'])]),
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
    orderId: 'bg-ord-1',
    clientOid: 'helios-test',
    status: 'partially_filled',
    fillSize: '0.01',
    size: '0.02',
    priceAvg: '67234.5',
    uTime: '1690000000000',
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

export const BITGET_VENUE_ADAPTER = buildSpotVenueAdapter({
  venueId: 'bitget',
  displayName: 'Bitget',
  venueSurface: 'bitget_spot',
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
    notes: 'Bitget public market REST/WS; signing not enabled.',
  },
  parseQuote(raw) {
    const row = raw as Record<string, unknown>;
    return {
      bidPrice: row.bidPr,
      bidQty: row.bidSz,
      askPrice: row.askPr,
      askQty: row.askSz,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: null,
    };
  },
  parseTrade(raw) {
    const row = raw as Record<string, unknown>;
    const sideRaw = String(row.side).toLowerCase();
    return {
      tradeId: String(row.tradeId),
      price: row.price,
      quantity: row.size,
      side: sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : 'unknown',
      eventTimeUtc: new Date(Number(row.ts)).toISOString(),
      sequence: null,
    };
  },
  parseBook(raw) {
    const row = raw as { bids: [unknown, unknown][]; asks: [unknown, unknown][] };
    return {
      bids: row.bids,
      asks: row.asks,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
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
    const status = String(row.status);
    const state =
      status === 'new'
        ? 'NEW'
        : status === 'partially_filled'
          ? 'PARTIALLY_FILLED'
          : status === 'filled'
            ? 'FILLED'
            : status === 'cancelled'
              ? 'CANCELED'
              : 'UNKNOWN';
    return {
      venueOrderId: String(row.orderId),
      clientOrderId: typeof row.clientOid === 'string' ? row.clientOid : null,
      state,
      filledQuantity: row.fillSize,
      remainingQuantity: '0.01',
      averagePrice: row.priceAvg ?? null,
      lastUpdateTimeUtc: new Date(Number(row.uTime)).toISOString(),
      rawStatus: status,
    };
  },
});
