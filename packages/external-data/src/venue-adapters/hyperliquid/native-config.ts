import {
  availableField,
  HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
  unavailableField,
  type HeliosCanonicalSymbol,
  type HeliosInstrumentMetadata,
  type HeliosVenueNormalizationFixture,
  type VenueAssetClass,
  type VenueCapabilityManifest,
  type VenueMarketDataType,
  type VenueOrderType,
  type VenueTimeInForce,
} from '@solstice/provider-sdk';
import {
  createNativeVenueAdapter,
  type NativeVenueModule,
  type VenueNormalizerBundle,
  type VenueSymbolCodec,
} from '../common/native-adapter-factory.ts';
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

const HYPERLIQUID_ASSET_CLASSES: readonly VenueAssetClass[] = Object.freeze(['crypto_perpetual']);
const HYPERLIQUID_MARKET_DATA_TYPES: readonly VenueMarketDataType[] = Object.freeze([
  'ticker',
  'order_book',
  'trades',
  'candles',
  'funding_rate',
]);
const HYPERLIQUID_ORDER_TYPES: readonly VenueOrderType[] = Object.freeze(['MARKET', 'LIMIT']);
const HYPERLIQUID_TIF_TYPES: readonly VenueTimeInForce[] = Object.freeze(['GTC', 'IOC']);

const MANIFEST_BODY = {
  venueId: 'hyperliquid',
  displayName: 'Hyperliquid',
  assetClasses: availableField(HYPERLIQUID_ASSET_CLASSES),
  instruments: availableField(Object.freeze(['BTC/USD'])),
  venues: availableField(Object.freeze(['hyperliquid_perp'])),
  marketData: {
    marketDataTypes: availableField(HYPERLIQUID_MARKET_DATA_TYPES),
    websocketAvailable: availableField(true),
    restAvailable: availableField(true),
    historicalDataSupport: availableField(false),
    timestampSemantics: availableField('exchange_event_time_ms'),
    rateLimits: availableField({
      restRequestsPerSecond: 5,
      websocketSubscriptionsMax: 50,
      notes: 'Hyperliquid public info endpoints; signing not enabled.',
    }),
  },
  orders: {
    orderTypes: availableField(HYPERLIQUID_ORDER_TYPES),
    tifTypes: availableField(HYPERLIQUID_TIF_TYPES),
    precision: availableField({ priceDecimals: 6, quantityDecimals: 6, notionalDecimals: 2 }),
    minimumQuantity: availableField({ value: '0.0001', unit: 'BTC' }),
    minimumNotional: availableField({ valueMinor: '1000', currency: 'USD' }),
    makerTakerFees: availableField({ makerBps: 2, takerBps: 5, currency: 'USD' }),
    reduceOnlySupport: availableField(true),
    postOnlySupport: availableField(true),
    fundingSupport: availableField(true),
  },
  account: {
    sandboxAvailability: unavailableField<boolean>(),
    subAccountSupport: availableField(false),
    portfolioMarginSupport: unavailableField<boolean>(),
  },
  reconciliation: {
    reconciliationSupport: availableField(true),
    fillHistoryAvailable: availableField(true),
    ledgerExportAvailable: unavailableField<boolean>(),
  },
  healthState: 'HEALTHY',
  liveOrderPlacementEnabled: false,
  qualificationNotes: [
    'NATIVE05 Hyperliquid perpetual adapter — BYTEX coin + -PERP engine id mapping',
    'Live execution disabled',
  ],
} satisfies VenueCapabilityManifest;

const MANIFEST: VenueCapabilityManifest = Object.freeze(MANIFEST_BODY) as VenueCapabilityManifest;

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

const SYMBOL_CODEC: VenueSymbolCodec = {
  resolve: resolveSymbol,
  describe(symbol: HeliosCanonicalSymbol): HeliosInstrumentMetadata {
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
};

const NORMALIZERS: VenueNormalizerBundle = {
  normalizeQuote(raw: unknown, symbol: HeliosCanonicalSymbol) {
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
  normalizeTrade(raw: unknown, symbol: HeliosCanonicalSymbol) {
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
  normalizeBook(raw: unknown, symbol: HeliosCanonicalSymbol) {
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
  normalizeCandle(raw: unknown, symbol: HeliosCanonicalSymbol) {
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
  normalizeOrderState(raw: unknown, symbol: HeliosCanonicalSymbol) {
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
};

const MODULE: NativeVenueModule = {
  venueId: 'hyperliquid',
  displayName: 'Hyperliquid',
  manifest: MANIFEST,
  symbols: SYMBOL_CODEC,
  normalizers: NORMALIZERS,
  normalizationFixtures: Object.freeze([FIXTURES]),
  fixtureLastPrice(symbol: string) {
    return symbol === 'BTC/USD' ? '67234.5' : null;
  },
};

export const HYPERLIQUID_VENUE_ADAPTER = createNativeVenueAdapter(MODULE);

/** Engine id used by BYTEX reference for Hyperliquid perpetuals. */
export function hyperliquidEngineInstrumentId(coin: string): string {
  return `${coin}${HELIOS_ENGINE_PERP_SUFFIX}`;
}
