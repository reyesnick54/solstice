/**
 * AAF08 — real equities / ETF external market observation plane (reference only).
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { BarTimeframe, MarketSessionStatus } from '../../market-observation/types.ts';

export const HELIOS_AAF08_SCHEMA = 'sunrey.helios.aaf08.external-equities-observation.v1' as const;
export const HELIOS_AAF08_AUTHORITY = 'MARKET_DATA_OBSERVATION_ONLY' as const;

export const EQUITIES_PROVIDER_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED_RATE_LIMITED',
  'DEGRADED_STALE',
  'DEGRADED_MISLABELED_FEED',
  'OUTAGE',
  'NOT_CONFIGURED',
] as const;
export type EquitiesProviderHealthState = (typeof EQUITIES_PROVIDER_HEALTH_STATES)[number];

export const EQUITIES_FEED_CLASSIFICATIONS = ['realtime', 'delayed', 'end_of_day', 'sandbox', 'unknown'] as const;
export type EquitiesFeedClassification = (typeof EQUITIES_FEED_CLASSIFICATIONS)[number];

/** Provider-neutral quote payload — no vendor JSON crosses strategy boundaries. */
export type ExternalEquitiesQuotePayload = {
  readonly schemaVersion: typeof HELIOS_AAF08_SCHEMA;
  readonly observationId: string;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly venueId: string;
  readonly currency: string;
  readonly priceScale: number;
  readonly bidMinorUnits: bigint | null;
  readonly askMinorUnits: bigint | null;
  readonly lastMinorUnits: bigint | null;
  readonly sessionStatus: MarketSessionStatus;
  readonly providerId: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly feedClassification: EquitiesFeedClassification;
  readonly delayedMinutes: number | null;
  readonly licensedForRealtime: boolean;
  readonly redistributionRestricted: boolean;
  readonly commercialRestricted: boolean;
  readonly rawPayloadHash: string;
  readonly sourceUrl: string | null;
  readonly capability: string;
  readonly upstreamSourceRef: string;
  readonly sequence: bigint | null;
  readonly grantsExecutionAuthority: false;
};

export type ExternalEquitiesBarPayload = {
  readonly schemaVersion: typeof HELIOS_AAF08_SCHEMA;
  readonly observationId: string;
  readonly instrumentId: string;
  readonly timeframe: BarTimeframe;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint;
  readonly startTime: UtcInstant;
  readonly endTime: UtcInstant;
  readonly providerId: string;
  readonly venueId: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly feedClassification: EquitiesFeedClassification;
  readonly delayedMinutes: number | null;
  readonly rawPayloadHash: string;
  readonly sourceUrl: string | null;
  readonly capability: string;
  readonly sequence: bigint | null;
  readonly grantsExecutionAuthority: false;
};

export type ExternalEquitiesSessionPayload = {
  readonly schemaVersion: typeof HELIOS_AAF08_SCHEMA;
  readonly observationId: string;
  readonly exchange: string;
  readonly sessionStatus: MarketSessionStatus;
  readonly isOpen: boolean;
  readonly providerId: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly rawPayloadHash: string;
  readonly grantsExecutionAuthority: false;
};

export type ExternalEquitiesInstrumentMetadata = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly assetClass: 'equity' | 'etf' | 'index';
  readonly venueId: string;
  readonly currency: string;
  readonly isin: string | null;
  readonly figi: string | null;
  readonly providerNativeId: string;
  readonly grantsExecutionAuthority: false;
};

export type ExternalEquitiesProviderHealth = {
  readonly providerId: string;
  readonly state: EquitiesProviderHealthState;
  readonly credentialConfigured: boolean;
  readonly rateLimited: boolean;
  readonly lastSuccessAt: UtcInstant | null;
  readonly message: string | null;
  readonly grantsExecutionAuthority: false;
};

export type ExternalEquitiesIngestOutcome =
  | {
      readonly ok: true;
      readonly instrumentId: string;
      readonly observationType: 'quote' | 'ohlcv_bar' | 'market_status';
      readonly evidenceRef: string | null;
      readonly quarantined: boolean;
      readonly duplicate: boolean;
    }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly evidenceRef: string | null };

export const AAF08_FEATURE_IDS = Object.freeze({
  LAST_PRICE: 'helios.aaf08.equities.last_price',
  SESSION_STATE: 'helios.aaf08.equities.session_state',
} as const);
