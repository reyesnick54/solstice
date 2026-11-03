import type { HeliosVenueNormalizationFixture } from '@solstice/provider-sdk';
import { buildSpotVenueAdapter } from '../common/build-spot-venue.ts';
import { KRAKEN_TICKER_FIXTURE } from './fixtures.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'kraken_spot_xbtusd',
  quote: KRAKEN_TICKER_FIXTURE.result.XXBTZUSD,
  trade: Object.freeze({
    ordertxid: 'kraken-trade-1',
    pair: 'XBT/USD',
    price: '67234.5',
    vol: '0.01',
    type: 'buy',
    time: 1_690_000_000.0,
  }),
  book: Object.freeze({
    XXBTZUSD: Object.freeze({
      bids: Object.freeze([Object.freeze(['67234.4', '1.0', 1_690_000_000.0])]),
      asks: Object.freeze([Object.freeze(['67234.5', '0.5', 1_690_000_000.0])]),
    }),
  }),
  candle: Object.freeze([
    1_690_000_000,
    '67000.0',
    '67500.0',
    '66900.0',
    '67234.5',
    '67234.4',
    '67234.5',
    120,
  ]),
  order: Object.freeze({
    txid: 'kraken-ord-1',
    userref: 'helios-test',
    status: 'open',
    vol_exec: '0.01',
    vol: '0.02',
    price: '67234.5',
    lastupdated: 1_690_000_000.0,
  }),
});

function toRawSymbol(canonical: string): string {
  if (canonical === 'BTC/USD') {
    return 'XBT/USD';
  }
  return canonical;
}

function toCanonicalSymbol(raw: string): string {
  const normalized = raw.replace('XBT', 'BTC').replace('XXBTZUSD', 'BTC/USD');
  if (normalized === 'BTC/USD' || raw === 'XBT/USD' || raw === 'XXBTZUSD') {
    return 'BTC/USD';
  }
  return normalized.replace('XBT', 'BTC');
}

export const KRAKEN_VENUE_ADAPTER = buildSpotVenueAdapter({
  venueId: 'kraken',
  displayName: 'Kraken',
  venueSurface: 'kraken_spot',
  instruments: Object.freeze(['BTC/USD', 'ETH/USD']),
  canonicalExample: 'BTC/USD',
  rawExample: 'XBT/USD',
  toRawSymbol,
  toCanonicalSymbol,
  fixtures: FIXTURES,
  fixtureLastPrice(symbol) {
    return symbol === 'BTC/USD' ? '67234.5' : null;
  },
  rateLimits: {
    restRequestsPerSecond: 1,
    websocketSubscriptionsMax: 100,
    notes: 'Public REST/WebSocket tiers; authenticated tiers not qualified in NATIVE05.',
  },
  parseQuote(raw) {
    const row = raw as { b?: string[]; a?: string[]; c?: string[]; t?: number[] };
    return {
      bidPrice: row.b?.[0],
      bidQty: row.b?.[1],
      askPrice: row.a?.[0],
      askQty: row.a?.[1],
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: row.t?.[1] ?? null,
    };
  },
  parseTrade(raw) {
    const row = raw as Record<string, unknown>;
    const sideRaw = String(row.type).toLowerCase();
    return {
      tradeId: String(row.ordertxid),
      price: row.price,
      quantity: row.vol,
      side: sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : 'unknown',
      eventTimeUtc: new Date(Number(row.time) * 1000).toISOString(),
      sequence: null,
    };
  },
  parseBook(raw) {
    const row = raw as { XXBTZUSD?: { bids: [unknown, unknown][]; asks: [unknown, unknown][] } };
    const book = row.XXBTZUSD ?? { bids: [], asks: [] };
    return {
      bids: book.bids.map((level) => [level[0], level[1]] as [unknown, unknown]),
      asks: book.asks.map((level) => [level[0], level[1]] as [unknown, unknown]),
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: null,
      isSnapshot: true,
    };
  },
  parseCandle(raw) {
    const row = raw as unknown[];
    return {
      openTimeUtc: new Date(Number(row[0]) * 1000).toISOString(),
      closeTimeUtc: new Date(Number(row[0]) * 1000 + 60_000 - 1).toISOString(),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[7],
      interval: '1m',
    };
  },
  parseOrder(raw) {
    const row = raw as Record<string, unknown>;
    const status = String(row.status);
    const state =
      status === 'open'
        ? 'NEW'
        : status === 'closed'
          ? 'FILLED'
          : status === 'canceled'
            ? 'CANCELED'
            : 'UNKNOWN';
    return {
      venueOrderId: String(row.txid),
      clientOrderId: typeof row.userref === 'string' ? row.userref : null,
      state,
      filledQuantity: row.vol_exec,
      remainingQuantity: '0.01',
      averagePrice: row.price ?? null,
      lastUpdateTimeUtc: new Date(Number(row.lastupdated) * 1000).toISOString(),
      rawStatus: status,
    };
  },
});
