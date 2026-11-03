import type { HeliosVenueNormalizationFixture } from '@solstice/provider-sdk';
import { buildSpotVenueAdapter } from '../common/build-spot-venue.ts';
import { splitCanonicalSpotPair } from '../common/symbol-suffix.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'gate_spot_btc_usdt',
  quote: Object.freeze({
    currency_pair: 'BTC_USDT',
    highest_bid: '67234.40',
    highest_size: '0.001',
    lowest_ask: '67234.50',
    lowest_size: '0.002',
  }),
  trade: Object.freeze({
    id: 'gate-1',
    currency_pair: 'BTC_USDT',
    price: '67234.5',
    amount: '0.01',
    side: 'buy',
    create_time: '1690000000',
  }),
  book: Object.freeze({
    id: 100,
    current: 1690000000,
    asks: Object.freeze([Object.freeze(['67234.5', '0.5'])]),
    bids: Object.freeze([Object.freeze(['67234.4', '1.0'])]),
  }),
  candle: Object.freeze({
    t: '1690000000',
    o: '67000',
    h: '67500',
    l: '66900',
    c: '67234.5',
    v: '120.5',
  }),
  order: Object.freeze({
    id: 'gate-ord-1',
    text: 'helios-test',
    status: 'open',
    filled_total: '672.345',
    amount: '0.02',
    avg_deal_price: '67234.5',
    update_time: '1690000000',
  }),
});

function toRawSymbol(canonical: string): string {
  const { base, quote } = splitCanonicalSpotPair(canonical);
  const quoteAsset = quote === 'USD' ? 'USDT' : quote;
  return `${base}_${quoteAsset}`;
}

function toCanonicalSymbol(raw: string): string {
  if (raw === 'BTC_USDT') {
    return 'BTC/USD';
  }
  const under = raw.indexOf('_');
  if (under > 0) {
    const base = raw.slice(0, under);
    const quote = raw.slice(under + 1) === 'USDT' ? 'USD' : raw.slice(under + 1);
    return `${base}/${quote}`;
  }
  return raw;
}

export const GATE_VENUE_ADAPTER = buildSpotVenueAdapter({
  venueId: 'gate',
  displayName: 'Gate',
  venueSurface: 'gate_spot',
  instruments: Object.freeze(['BTC/USD', 'ETH/USD']),
  canonicalExample: 'BTC/USD',
  rawExample: 'BTC_USDT',
  toRawSymbol,
  toCanonicalSymbol,
  fixtures: FIXTURES,
  fixtureLastPrice(symbol) {
    return symbol === 'BTC/USD' ? '67234.5' : null;
  },
  rateLimits: {
    restRequestsPerSecond: 8,
    websocketSubscriptionsMax: 80,
    notes: 'Gate.io public spot endpoints; signing not enabled.',
  },
  parseQuote(raw) {
    const row = raw as Record<string, unknown>;
    return {
      bidPrice: row.highest_bid,
      bidQty: row.highest_size,
      askPrice: row.lowest_ask,
      askQty: row.lowest_size,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: null,
    };
  },
  parseTrade(raw) {
    const row = raw as Record<string, unknown>;
    const sideRaw = String(row.side).toLowerCase();
    return {
      tradeId: String(row.id),
      price: row.price,
      quantity: row.amount,
      side: sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : 'unknown',
      eventTimeUtc: new Date(Number(row.create_time) * 1000).toISOString(),
      sequence: null,
    };
  },
  parseBook(raw) {
    const row = raw as { bids: [unknown, unknown][]; asks: [unknown, unknown][]; id?: number };
    return {
      bids: row.bids,
      asks: row.asks,
      eventTimeUtc: '2026-09-21T12:00:00.000Z',
      sequence: row.id ?? null,
      isSnapshot: true,
    };
  },
  parseCandle(raw) {
    const row = raw as Record<string, unknown>;
    const openSec = Number(row.t);
    return {
      openTimeUtc: new Date(openSec * 1000).toISOString(),
      closeTimeUtc: new Date(openSec * 1000 + 60_000 - 1).toISOString(),
      open: row.o,
      high: row.h,
      low: row.l,
      close: row.c,
      volume: row.v,
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
          : status === 'cancelled'
            ? 'CANCELED'
            : 'UNKNOWN';
    return {
      venueOrderId: String(row.id),
      clientOrderId: typeof row.text === 'string' ? row.text : null,
      state,
      filledQuantity: '0.01',
      remainingQuantity: '0.01',
      averagePrice: row.avg_deal_price ?? null,
      lastUpdateTimeUtc: new Date(Number(row.update_time) * 1000).toISOString(),
      rawStatus: status,
    };
  },
});
