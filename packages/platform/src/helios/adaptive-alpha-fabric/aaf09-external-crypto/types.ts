/**
 * AAF09 — real crypto multi-venue market observation plane (market data only).
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const HELIOS_AAF09_SCHEMA = 'sunrey.helios.aaf09.external-crypto-observation.v1' as const;
export const HELIOS_AAF09_AUTHORITY = 'MARKET_DATA_OBSERVATION_ONLY' as const;

export const CRYPTO_OBSERVATION_KINDS = [
  'trade',
  'best_bid_offer',
  'ohlcv_bar',
  'reference_quote',
] as const;
export type CryptoObservationKind = (typeof CRYPTO_OBSERVATION_KINDS)[number];

export const CRYPTO_SOURCE_CLASSES = [
  'VENUE_MARKET_DATA',
  'REFERENCE_AGGREGATE',
  'VENUE_REPUBLISH_AGGREGATE',
] as const;
export type CryptoSourceClass = (typeof CRYPTO_SOURCE_CLASSES)[number];

export const SOURCE_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED_STALE',
  'DEGRADED_SEQUENCE_GAP',
  'DEGRADED_CROSSED_MARKET',
  'DEGRADED_PROVIDER',
  'OUTAGE',
] as const;
export type SourceHealthState = (typeof SOURCE_HEALTH_STATES)[number];

export type CryptoVenueRef = {
  readonly venueId: string;
  readonly displayName: string;
  readonly mic: string | null;
};

export type NormalizedCryptoMarketObservation = {
  readonly schemaVersion: typeof HELIOS_AAF09_SCHEMA;
  readonly observationId: string;
  readonly observationKind: CryptoObservationKind;
  readonly instrumentId: string;
  readonly baseAsset: 'BTC' | 'ETH';
  readonly quoteCurrency: 'USD' | 'USDT';
  readonly pairLabel: string;
  readonly venue: CryptoVenueRef | null;
  readonly providerId: string;
  readonly sourceClass: CryptoSourceClass;
  readonly sourceFamily: string;
  readonly upstreamSourceRef: string | null;
  readonly priceScale: number;
  readonly lastMinorUnits: bigint | null;
  readonly bidMinorUnits: bigint | null;
  readonly askMinorUnits: bigint | null;
  readonly spreadMinorUnits: bigint | null;
  readonly tradePriceMinorUnits: bigint | null;
  readonly tradeQuantityMinorUnits: bigint | null;
  readonly volumeMinorUnits: bigint | null;
  readonly ohlcOpenMinorUnits: bigint | null;
  readonly ohlcHighMinorUnits: bigint | null;
  readonly ohlcLowMinorUnits: bigint | null;
  readonly ohlcCloseMinorUnits: bigint | null;
  readonly barTimeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | null;
  readonly sequenceId: string | null;
  readonly providerEventTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly sourceHealth: SourceHealthState;
  readonly rawPayloadHash: string;
  readonly grantsExecutionAuthority: false;
};

export type IngestCryptoObservationResult =
  | { readonly ok: true; readonly observation: NormalizedCryptoMarketObservation }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type MultiSourceDisagreementReport = {
  readonly instrumentId: string;
  readonly evaluationTime: UtcInstant;
  readonly independentWitnessCount: number;
  readonly aggregateWitnessCount: number;
  readonly dispersionBps: number | null;
  readonly largeDisagreement: boolean;
  readonly lineageNotes: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export const AAF09_FEATURE_IDS = Object.freeze({
  RETURN_1: 'helios.aaf09.crypto.return_1',
  REALIZED_VOL: 'helios.aaf09.crypto.realized_vol',
  VOLUME: 'helios.aaf09.crypto.volume',
  SPREAD: 'helios.aaf09.crypto.spread',
  PRICE_DISPERSION: 'helios.aaf09.crypto.price_dispersion_bps',
  VENUE_DISLOCATION: 'helios.aaf09.crypto.venue_dislocation_bps',
  SOURCE_QUALITY: 'helios.aaf09.crypto.source_quality_state',
} as const);
