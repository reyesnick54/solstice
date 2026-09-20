/**
 * HELIOS Multi-Asset M02 — canonical market observation and time-series types.
 *
 * Provider-independent model for equities, ETFs, indices, crypto, commodities,
 * futures, and FX. Extends H08 observation envelope; does not create a parallel
 * market-data platform. Reference/research only — not execution authority.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../../provider-sdk/src/types.ts';
import type {
  EntitlementClass,
  FeedDelayClassification,
  HeliosMarketObservationEnvelope,
  InformationTime,
  QualityState,
} from '../observation/types.ts';

export const HELIOS_MARKET_TIME_SERIES_SCHEMA = 'sunrey.helios.market-time-series.v1' as const;
export const HELIOS_MARKET_TIME_SERIES_AUTHORITY = 'REFERENCE_ONLY' as const;

export const MARKET_OBSERVATION_TYPES = [
  'quote',
  'trade',
  'ohlcv_bar',
  'reference_price',
  'market_status',
  'best_bid_offer',
  'order_book_snapshot',
] as const;
export type MarketObservationType = (typeof MARKET_OBSERVATION_TYPES)[number];

export const BAR_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type BarTimeframe = (typeof BAR_TIMEFRAMES)[number];

export const MARKET_ASSET_CLASSES = [
  'equity',
  'etf',
  'index',
  'crypto',
  'commodity',
  'future',
  'fx',
  'bond',
  'other',
] as const;
export type MarketAssetClass = (typeof MARKET_ASSET_CLASSES)[number];

export const MARKET_SESSION_STATUSES = [
  'OPEN',
  'CLOSED',
  'HALTED',
  'PRE_MARKET',
  'AFTER_HOURS',
  'UNKNOWN',
] as const;
export type MarketSessionStatus = (typeof MARKET_SESSION_STATUSES)[number];

export const STALE_STATES = ['FRESH', 'STALE', 'EXPIRED', 'UNKNOWN'] as const;
export type StaleState = (typeof STALE_STATES)[number];

export const QUARANTINE_REASONS = [
  'IMPOSSIBLE_OHLC',
  'NEGATIVE_VOLUME',
  'TIMESTAMP_INVERSION',
  'DUPLICATE_BAR',
  'STALE_OBSERVATION',
  'UNSUPPORTED_TIMEFRAME',
  'MALFORMED_ORDER_BOOK',
  'CROSSED_MARKET',
  'SEQUENCE_REGRESSION',
  'MISSING_ENTITLEMENT',
  'INVALID_PROVIDER_MAPPING',
  'INVALID_INSTRUMENT',
  'MALFORMED_PAYLOAD',
] as const;
export type QuarantineReason = (typeof QUARANTINE_REASONS)[number];

export type MarketVenue = {
  readonly venueId: string;
  readonly mic: string | null;
  readonly displayName: string;
  readonly exchange: string | null;
};

export type MarketInstrument = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly assetClass: MarketAssetClass;
  readonly venue: MarketVenue;
  readonly currency: string;
  readonly providerNativeId: string;
};

export type MarketEntitlementMetadata = {
  readonly entitlementClass: EntitlementClass;
  readonly feedDelayClassification: FeedDelayClassification;
  readonly delayedMinutes: number | null;
  readonly licensedForRealtime: boolean;
  readonly redistributionRestricted: boolean;
  readonly commercialRestricted: boolean;
  readonly unavailable: boolean;
};

export type MarketProvenance = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string;
  readonly observationId: string;
  readonly capability: string;
  readonly upstreamSourceRef: string | null;
};

export type MarketQualityMetadata = {
  readonly qualityState: QualityState;
  readonly staleState: StaleState;
  readonly quarantined: boolean;
  readonly quarantineReason: QuarantineReason | null;
};

/** Single price level in an order book. */
export type OrderBookLevel = {
  readonly priceMinorUnits: bigint;
  readonly quantityMinorUnits: bigint;
  readonly depth: number;
};

/** Normalized order-book snapshot where provider capability exists. */
export type OrderBookSnapshot = {
  readonly bids: readonly OrderBookLevel[];
  readonly asks: readonly OrderBookLevel[];
  readonly sequence: bigint | null;
  readonly version: string | null;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly providerSupportsOrderBook: true;
};

export type OhlcvBar = {
  readonly schema: typeof HELIOS_MARKET_TIME_SERIES_SCHEMA;
  readonly authority: typeof HELIOS_MARKET_TIME_SERIES_AUTHORITY;
  readonly observationType: 'ohlcv_bar';
  readonly instrumentId: string;
  readonly timeframe: BarTimeframe;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint;
  readonly startTime: UtcInstant;
  readonly endTime: UtcInstant;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly providerId: string;
  readonly venue: string;
  readonly entitlement: MarketEntitlementMetadata;
  readonly provenance: MarketProvenance;
  readonly quality: MarketQualityMetadata;
  readonly sequence: bigint | null;
};

export type MarketQuoteObservation = {
  readonly schema: typeof HELIOS_MARKET_TIME_SERIES_SCHEMA;
  readonly authority: typeof HELIOS_MARKET_TIME_SERIES_AUTHORITY;
  readonly observationType: 'quote' | 'best_bid_offer' | 'reference_price';
  readonly instrumentId: string;
  readonly bidMinorUnits: bigint | null;
  readonly askMinorUnits: bigint | null;
  readonly lastMinorUnits: bigint | null;
  readonly priceScale: number;
  readonly currency: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly providerId: string;
  readonly venue: string;
  readonly entitlement: MarketEntitlementMetadata;
  readonly provenance: MarketProvenance;
  readonly quality: MarketQualityMetadata;
  readonly sequence: bigint | null;
};

export type MarketTradeObservation = {
  readonly schema: typeof HELIOS_MARKET_TIME_SERIES_SCHEMA;
  readonly authority: typeof HELIOS_MARKET_TIME_SERIES_AUTHORITY;
  readonly observationType: 'trade';
  readonly instrumentId: string;
  readonly priceMinorUnits: bigint;
  readonly quantityMinorUnits: bigint;
  readonly priceScale: number;
  readonly currency: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly providerId: string;
  readonly venue: string;
  readonly entitlement: MarketEntitlementMetadata;
  readonly provenance: MarketProvenance;
  readonly quality: MarketQualityMetadata;
  readonly sequence: bigint | null;
};

export type MarketStatusObservation = {
  readonly schema: typeof HELIOS_MARKET_TIME_SERIES_SCHEMA;
  readonly authority: typeof HELIOS_MARKET_TIME_SERIES_AUTHORITY;
  readonly observationType: 'market_status';
  readonly instrumentId: string;
  readonly sessionStatus: MarketSessionStatus;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly providerId: string;
  readonly venue: string;
  readonly entitlement: MarketEntitlementMetadata;
  readonly provenance: MarketProvenance;
  readonly quality: MarketQualityMetadata;
};

export type OrderBookObservation = {
  readonly schema: typeof HELIOS_MARKET_TIME_SERIES_SCHEMA;
  readonly authority: typeof HELIOS_MARKET_TIME_SERIES_AUTHORITY;
  readonly observationType: 'order_book_snapshot';
  readonly instrumentId: string;
  readonly orderBook: OrderBookSnapshot;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly providerId: string;
  readonly venue: string;
  readonly entitlement: MarketEntitlementMetadata;
  readonly provenance: MarketProvenance;
  readonly quality: MarketQualityMetadata;
};

export type CanonicalMarketObservation =
  | OhlcvBar
  | MarketQuoteObservation
  | MarketTradeObservation
  | MarketStatusObservation
  | OrderBookObservation;

/** Sealed market observation bound to H08 envelope for downstream consumers. */
export type SealedMarketObservation = {
  readonly marketObservation: CanonicalMarketObservation;
  readonly envelope: HeliosMarketObservationEnvelope;
  readonly informationTime: InformationTime;
  readonly knowableAt: UtcInstant;
};

export type MarketSnapshot = {
  readonly instrumentId: string;
  readonly asOfKnowableAt: UtcInstant;
  readonly latestQuote: MarketQuoteObservation | null;
  readonly latestTrade: MarketTradeObservation | null;
  readonly marketStatus: MarketStatusObservation | null;
  readonly orderBook: OrderBookObservation | null;
  readonly latestBarByTimeframe: Readonly<Partial<Record<BarTimeframe, OhlcvBar>>>;
};

export type IngestMarketObservationResult =
  | { readonly ok: true; readonly sealed: SealedMarketObservation; readonly duplicate: boolean; readonly quarantined: boolean }
  | { readonly ok: false; readonly code: QuarantineReason | string; readonly message: string };
