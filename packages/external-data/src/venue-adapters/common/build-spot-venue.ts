import {
  HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
  type HeliosCanonicalSymbol,
  type HeliosInstrumentMetadata,
  type HeliosNormalizedBook,
  type HeliosNormalizedCandle,
  type HeliosNormalizedOrder,
  type HeliosNormalizedOrderState,
  type HeliosNormalizedQuote,
  type HeliosNormalizedTrade,
  type HeliosOs04VenueId,
  type HeliosVenueNormalizationFixture,
} from '@solstice/provider-sdk';
import { createNativeCryptoSpotManifest } from './create-spot-manifest.ts';
import { createNativeVenueAdapter, type NativeVenueModule } from './native-adapter-factory.ts';
import { requireDecimalString } from './parse-decimal.ts';
import { splitCanonicalSpotPair } from './symbol-suffix.ts';

export type SpotVenueBuildConfig = Readonly<{
  readonly venueId: HeliosOs04VenueId;
  readonly displayName: string;
  readonly venueSurface: string;
  readonly instruments: readonly string[];
  readonly canonicalExample: string;
  readonly rawExample: string;
  readonly toRawSymbol: (canonical: string) => string;
  readonly toCanonicalSymbol: (raw: string) => string;
  readonly fixtures: HeliosVenueNormalizationFixture;
  readonly fixtureLastPrice: (symbol: string) => string | null;
  readonly parseQuote: (raw: unknown) => {
    bidPrice: unknown;
    bidQty: unknown;
    askPrice: unknown;
    askQty: unknown;
    eventTimeUtc: string;
    sequence?: number | null;
  };
  readonly parseTrade: (raw: unknown) => {
    tradeId: string;
    price: unknown;
    quantity: unknown;
    side: 'buy' | 'sell' | 'unknown';
    eventTimeUtc: string;
    sequence?: number | null;
  };
  readonly parseBook: (raw: unknown) => {
    bids: readonly [unknown, unknown][];
    asks: readonly [unknown, unknown][];
    eventTimeUtc: string;
    sequence?: number | null;
    isSnapshot: boolean;
  };
  readonly parseCandle: (raw: unknown) => {
    openTimeUtc: string;
    closeTimeUtc: string;
    open: unknown;
    high: unknown;
    low: unknown;
    close: unknown;
    volume: unknown;
    interval: string;
  };
  readonly parseOrder: (raw: unknown) => {
    venueOrderId: string;
    clientOrderId: string | null;
    state: HeliosNormalizedOrderState;
    filledQuantity: unknown;
    remainingQuantity: unknown;
    averagePrice: unknown | null;
    lastUpdateTimeUtc: string;
    rawStatus: string;
  };
  readonly rateLimits: { restRequestsPerSecond: number; websocketSubscriptionsMax: number; notes: string };
}>;

function buildSymbolCodec(config: SpotVenueBuildConfig) {
  return {
    resolve(input: { kind: 'canonical'; value: string } | { kind: 'raw'; value: string }): HeliosCanonicalSymbol {
      if (input.kind === 'canonical') {
        const { base, quote } = splitCanonicalSpotPair(input.value);
        return Object.freeze({
          canonical: input.value,
          raw: config.toRawSymbol(input.value),
          venueId: config.venueId,
          baseAsset: base,
          quoteAsset: quote,
          instrumentClass: 'spot',
        });
      }
      const canonical = config.toCanonicalSymbol(input.value);
      const { base, quote } = splitCanonicalSpotPair(canonical);
      return Object.freeze({
        canonical,
        raw: input.value,
        venueId: config.venueId,
        baseAsset: base,
        quoteAsset: quote,
        instrumentClass: 'spot',
      });
    },
    describe(symbol: HeliosCanonicalSymbol): HeliosInstrumentMetadata {
      return Object.freeze({
        symbol,
        priceDecimals: 8,
        quantityDecimals: 8,
        minQuantity: '0.00001',
        minNotionalMinor: '1000',
        quoteCurrency: symbol.quoteAsset,
        tickSize: '0.01',
        stepSize: '0.00001',
        status: 'tradable',
      });
    },
  };
}

function buildNormalizers(config: SpotVenueBuildConfig) {
  return {
    normalizeQuote(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedQuote {
      const parsed = config.parseQuote(raw);
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: config.venueId,
        symbol,
        bidPrice: requireDecimalString(parsed.bidPrice, 'bidPrice'),
        bidQuantity: requireDecimalString(parsed.bidQty, 'bidQuantity'),
        askPrice: requireDecimalString(parsed.askPrice, 'askPrice'),
        askQuantity: requireDecimalString(parsed.askQty, 'askQuantity'),
        eventTimeUtc: parsed.eventTimeUtc,
        sequence: parsed.sequence ?? null,
      });
    },
    normalizeTrade(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedTrade {
      const parsed = config.parseTrade(raw);
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: config.venueId,
        symbol,
        tradeId: parsed.tradeId,
        price: requireDecimalString(parsed.price, 'price'),
        quantity: requireDecimalString(parsed.quantity, 'quantity'),
        side: parsed.side,
        eventTimeUtc: parsed.eventTimeUtc,
        sequence: parsed.sequence ?? null,
      });
    },
    normalizeBook(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedBook {
      const parsed = config.parseBook(raw);
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: config.venueId,
        symbol,
        bids: Object.freeze(
          parsed.bids.map(([price, qty]) =>
            Object.freeze({
              price: requireDecimalString(price, 'bidPrice'),
              quantity: requireDecimalString(qty, 'bidQuantity'),
            }),
          ),
        ),
        asks: Object.freeze(
          parsed.asks.map(([price, qty]) =>
            Object.freeze({
              price: requireDecimalString(price, 'askPrice'),
              quantity: requireDecimalString(qty, 'askQuantity'),
            }),
          ),
        ),
        eventTimeUtc: parsed.eventTimeUtc,
        sequence: parsed.sequence ?? null,
        isSnapshot: parsed.isSnapshot,
      });
    },
    normalizeCandle(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedCandle {
      const parsed = config.parseCandle(raw);
      return Object.freeze({
        schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
        venueId: config.venueId,
        symbol,
        openTimeUtc: parsed.openTimeUtc,
        closeTimeUtc: parsed.closeTimeUtc,
        open: requireDecimalString(parsed.open, 'open'),
        high: requireDecimalString(parsed.high, 'high'),
        low: requireDecimalString(parsed.low, 'low'),
        close: requireDecimalString(parsed.close, 'close'),
        volume: requireDecimalString(parsed.volume, 'volume'),
        interval: parsed.interval,
      });
    },
    normalizeOrderState(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedOrder {
      const parsed = config.parseOrder(raw);
      return Object.freeze({
        venueOrderId: parsed.venueOrderId,
        clientOrderId: parsed.clientOrderId,
        symbolCanonical: symbol.canonical,
        state: parsed.state,
        filledQuantity: requireDecimalString(parsed.filledQuantity, 'filledQuantity'),
        remainingQuantity: requireDecimalString(parsed.remainingQuantity, 'remainingQuantity'),
        averagePrice:
          parsed.averagePrice === null
            ? null
            : requireDecimalString(parsed.averagePrice, 'averagePrice'),
        lastUpdateTimeUtc: parsed.lastUpdateTimeUtc,
        rawStatus: parsed.rawStatus,
      });
    },
  };
}

export function buildSpotVenueNativeModule(config: SpotVenueBuildConfig): NativeVenueModule {
  const manifest = createNativeCryptoSpotManifest({
    venueId: config.venueId,
    displayName: config.displayName,
    instruments: config.instruments,
    venueSurface: config.venueSurface,
    rateLimits: config.rateLimits,
    precision: { priceDecimals: 8, quantityDecimals: 8, notionalDecimals: 2 },
    minQuantity: '0.00001',
    minNotionalMinor: '1000',
    qualificationNotes: Object.freeze([
      `Symbol codec ported from BYTEX ${config.displayName} adapter reference (clean-room)`,
    ]),
  });

  return Object.freeze({
    venueId: config.venueId,
    displayName: config.displayName,
    manifest,
    symbols: buildSymbolCodec(config),
    normalizers: buildNormalizers(config),
    normalizationFixtures: Object.freeze([config.fixtures]),
    fixtureLastPrice: config.fixtureLastPrice,
  });
}

export function buildSpotVenueAdapter(config: SpotVenueBuildConfig) {
  return createNativeVenueAdapter(buildSpotVenueNativeModule(config));
}
