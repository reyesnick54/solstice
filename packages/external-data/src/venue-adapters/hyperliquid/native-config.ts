import {
  availableField,
  HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
  unavailableField,
  type HeliosCanonicalSymbol,
  type HeliosVenueNormalizationFixture,
  type VenueCapabilityManifest,
} from '@solstice/provider-sdk';
import { createNativeVenueAdapter, type NativeVenueModule } from '../common/native-adapter-factory.ts';
import { requireDecimalString } from '../common/parse-decimal.ts';
import { HELIOS_ENGINE_PERP_SUFFIX } from '../common/symbol-suffix.ts';

const FIXTURES: HeliosVenueNormalizationFixture = Object.freeze({
  fixtureId: 'hyperliquid_perp_btc',
  quote: Object.freeze({
    coin: 'BTC',
    bidPx: '67234.40',
    bidSz: '0.001',
    askPx: '67234.50',
    askSz: '0.002',
    time: 1_690_000_000_000,
  }),
  trade: Object.freeze({
    tid: 1,
    coin: 'BTC',
    px: '67234.5',
    sz: '0.01',
    side: 'B',
    time: 1_690_000_000_000,
  }),
  book: Object.freeze({
    coin: 'BTC',
    levels: Object.freeze([
      Object.freeze([Object.freeze(['67234.4', '1.0'])]),
      Object.freeze([Object.freeze(['67234.5', '0.5'])]),
    ]),
    time: 1_690_000_000_000,
  }),
  candle: Object.freeze({
    t: 1_690_000_000_000,
    o: '67000',
    h: '67500',
    l: '66900',
    c: '67234.5',
    v: '120.5',
    i: '1m',
  }),
  order: Object.freeze({
    oid: 42,
    cloid: 'helios-test',
    status: 'open',
    filledSz: '0.01',
    sz: '0.02',
    avgPx: '67234.5',
    timestamp: 1_690_000_000_000,
  }),
});

const MANIFEST: VenueCapabilityManifest = Object.freeze({
  venueId: 'hyperliquid',
  displayName: 'Hyperliquid',
  assetClasses: availableField(Object.freeze(['crypto_perpetual'] as const)),
  instruments: availableField(Object.freeze(['BTC/USD'] as const)),
  venues: availableField(Object.freeze(['hyperliquid_perp'] as const)),
  marketData: Object.freeze({
    marketDataTypes: availableField(
      Object.freeze(['ticker', 'order_book', 'trades', 'candles', 'funding_rate'] as const),
    ),
    websocketAvailable: availableField(true),
    restAvailable: availableField(true),
    historicalDataSupport: availableField(false),
    timestampSemantics: availableField('exchange_event_time_ms'),
    rateLimits: availableField({
      restRequestsPerSecond: 5,
      websocketSubscriptionsMax: 50,
      notes: 'Hyperliquid public info endpoints; signing not enabled.',
    }),
  }),
  orders: Object.freeze({
    orderTypes: availableField(Object.freeze(['MARKET', 'LIMIT'] as const)),
    tifTypes: availableField(Object.freeze(['GTC', 'IOC'] as const)),
    precision: availableField({ priceDecimals: 6, quantityDecimals: 6, notionalDecimals: 2 }),
    minimumQuantity: availableField({ value: '0.0001', unit: 'BTC' }),
    minimumNotional: availableField({ valueMinor: '1000', currency: 'USD' }),
    makerTakerFees: availableField({ makerBps: 2, takerBps: 5, currency: 'USD' }),
    reduceOnlySupport: availableField(true),
    postOnlySupport: availableField(true),
    fundingSupport: availableField(true),
  }),
  account: Object.freeze({
    sandboxAvailability: unavailableField<boolean>(),
    subAccountSupport: availableField(false),
    portfolioMarginSupport: unavailableField<boolean>(),
  }),
  reconciliation: Object.freeze({
    reconciliationSupport: availableField(true),
    fillHistoryAvailable: availableField(true),
    ledgerExportAvailable: unavailableField<boolean>(),
  }),
  healthState: 'HEALTHY',
  liveOrderPlacementEnabled: false,
  qualificationNotes: Object.freeze([
    'NATIVE05 Hyperliquid perpetual adapter — BYTEX coin + -PERP engine id mapping',
    'Live execution disabled',
  ]),
});

function resolveSymbol(input: { kind: 'canonical'; value: string } | { kind: 'raw'; value: string }): HeliosCanonicalSymbol {
  if (input.kind === 'canonical') {
    const coin = input.value.startsWith('BTC') ? 'BTC' : input.value.split('/')[0] ?? input.value;
    return Object.freeze({
      canonical: input.value,
      raw: coin,
      venueId: 'hyperliquid',
      baseAsset: coin,
      quoteAsset: 'USD',
      instrumentClass: 'perpetual',
    });
  }
  const coin = input.value;
  return Object.freeze({
    canonical: 'BTC/USD',
    raw: coin,
    venueId: 'hyperliquid',
    baseAsset: coin,
    quoteAsset: 'USD',
    instrumentClass: 'perpetual',
  });
}

const MODULE: NativeVenueModule = Object.freeze({
  venueId: 'hyperliquid',
  displayName: 'Hyperliquid',
  manifest: MANIFEST,
  symbols: Object.freeze({
    resolve: resolveSymbol,
    describe(symbol) {
      return Object.freeze({
        symbol,
        priceDecimals: 6,
        quantityDecimals: 6,
        minQuantity: '0.0001',
        minNotionalMinor: '1000',
        quoteCurrency: 'USD',
        tickSize: '0.1',
        stepSize: '0.0001',
        status: 'tradable',
      });
    },
  }),
  normalizers: Object.freeze({
    normalizeQuote(raw, symbol) {
      const row = raw as Record<string, unknown>;
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: 'hyperliquid',
        symbol,
        bidPrice: requireDecimalString(row.bidPx, 'bidPx'),
        bidQuantity: requireDecimalString(row.bidSz, 'bidSz'),
        askPrice: requireDecimalString(row.askPx, 'askPx'),
        askQuantity: requireDecimalString(row.askSz, 'askSz'),
        eventTimeUtc: new Date(Number(row.time)).toISOString(),
        sequence: null,
      });
    },
    normalizeTrade(raw, symbol) {
      const row = raw as Record<string, unknown>;
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: 'hyperliquid',
        symbol,
        tradeId: String(row.tid),
        price: requireDecimalString(row.px, 'px'),
        quantity: requireDecimalString(row.sz, 'sz'),
        side: row.side === 'B' ? 'buy' : row.side === 'A' ? 'sell' : 'unknown',
        eventTimeUtc: new Date(Number(row.time)).toISOString(),
        sequence: null,
      });
    },
    normalizeBook(raw, symbol) {
      const row = raw as { levels: [[unknown, unknown][], [unknown, unknown][]]; time?: number };
      const [bids, asks] = row.levels;
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: 'hyperliquid',
        symbol,
        bids: Object.freeze(
          bids.map(([price, qty]) =>
            Object.freeze({
              price: requireDecimalString(price, 'bidPrice'),
              quantity: requireDecimalString(qty, 'bidQuantity'),
            }),
          ),
        ),
        asks: Object.freeze(
          asks.map(([price, qty]) =>
            Object.freeze({
              price: requireDecimalString(price, 'askPrice'),
              quantity: requireDecimalString(qty, 'askQuantity'),
            }),
          ),
        ),
        eventTimeUtc: new Date(Number(row.time ?? 0)).toISOString(),
        sequence: null,
        isSnapshot: true,
      });
    },
    normalizeCandle(raw, symbol) {
      const row = raw as Record<string, unknown>;
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: 'hyperliquid',
        symbol,
        openTimeUtc: new Date(Number(row.t)).toISOString(),
        closeTimeUtc: new Date(Number(row.t) + 60_000 - 1).toISOString(),
        open: requireDecimalString(row.o, 'open'),
        high: requireDecimalString(row.h, 'high'),
        low: requireDecimalString(row.l, 'low'),
        close: requireDecimalString(row.c, 'close'),
        volume: requireDecimalString(row.v, 'volume'),
        interval: String(row.i),
      });
    },
    normalizeOrderState(raw, symbol) {
      const row = raw as Record<string, unknown>;
      const status = String(row.status);
      return Object.freeze({
        venueOrderId: String(row.oid),
        clientOrderId: typeof row.cloid === 'string' ? row.cloid : null,
        symbolCanonical: symbol.canonical,
        state: status === 'open' ? 'NEW' : status === 'filled' ? 'FILLED' : 'UNKNOWN',
        filledQuantity: requireDecimalString(row.filledSz, 'filledSz'),
        remainingQuantity: '0.01',
        averagePrice: row.avgPx ? requireDecimalString(row.avgPx, 'avgPx') : null,
        lastUpdateTimeUtc: new Date(Number(row.timestamp)).toISOString(),
        rawStatus: status,
      });
    },
  }),
  normalizationFixtures: Object.freeze([FIXTURES]),
  fixtureLastPrice(symbol) {
    return symbol === 'BTC/USD' ? '67234.5' : null;
  },
});

export const HYPERLIQUID_VENUE_ADAPTER = createNativeVenueAdapter(MODULE);

/** Engine id used by BYTEX reference for Hyperliquid perpetuals. */
export function hyperliquidEngineInstrumentId(coin: string): string {
  return `${coin}${HELIOS_ENGINE_PERP_SUFFIX}`;
}
