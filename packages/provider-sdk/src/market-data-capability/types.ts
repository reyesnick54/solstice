/**
 * AAF07 — external market-data provider capability contract.
 *
 * Describes what a market-data provider can supply and under which constraints.
 * Not execution authority, not a live trading activation flag.
 */

import type { CommercialUseStatus, ProviderId, RedistributionStatus } from '../types.ts';
import type { MarketDataCertificationState } from './certification-states.ts';

export const MARKET_DATA_CAPABILITY_SCHEMA_VERSION = 'sunrey.market-data-capability.v1' as const;

export const MARKET_DATA_DATA_FAMILIES = [
  'equity_quotes',
  'equity_ohlcv',
  'equity_trades',
  'crypto_spot_quotes',
  'crypto_spot_ohlcv',
  'fx_rates',
  'index_levels',
  'reference_metadata',
  'market_news',
] as const;
export type MarketDataFamily = (typeof MARKET_DATA_DATA_FAMILIES)[number];

export const MARKET_DATA_ASSET_CLASSES = [
  'equity',
  'etf',
  'index',
  'crypto',
  'commodity',
  'fx',
  'bond',
  'future',
  'other',
] as const;
export type MarketDataAssetClass = (typeof MARKET_DATA_ASSET_CLASSES)[number];

export const MARKET_DATA_FEED_TIMING = ['realtime', 'delayed', 'end_of_day', 'mixed', 'unknown'] as const;
export type MarketDataFeedTiming = (typeof MARKET_DATA_FEED_TIMING)[number];

export const MARKET_DATA_TIMESTAMP_SEMANTICS = [
  'vendor_epoch_seconds_utc',
  'vendor_iso_utc',
  'exchange_local_with_offset',
  'ingestion_wall_clock',
  'unknown',
] as const;
export type MarketDataTimestampSemantics = (typeof MARKET_DATA_TIMESTAMP_SEMANTICS)[number];

export const MARKET_DATA_REVISION_BEHAVIOR = [
  'append_only',
  'revisable',
  'correction_events',
  'unknown',
] as const;
export type MarketDataRevisionBehavior = (typeof MARKET_DATA_REVISION_BEHAVIOR)[number];

export const MARKET_DATA_ROUTE_CLASSES = ['external_live', 'explicit_simulation', 'sandbox'] as const;
export type MarketDataRouteClass = (typeof MARKET_DATA_ROUTE_CLASSES)[number];

export const MARKET_DATA_CREDENTIAL_STATES = [
  'not_required',
  'not_configured',
  'configured',
  'invalid',
  'expired',
  'unknown',
] as const;
export type MarketDataCredentialState = (typeof MARKET_DATA_CREDENTIAL_STATES)[number];

export const MARKET_DATA_PROVIDER_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'STALE',
  'UNAVAILABLE',
  'MAINTENANCE',
  'UNKNOWN',
] as const;
export type MarketDataProviderHealthState = (typeof MARKET_DATA_PROVIDER_HEALTH_STATES)[number];

export type MarketDataRateLimitProfile = {
  readonly documented: boolean;
  readonly requestsPerSecond: number | null;
  readonly requestsPerMinute: number | null;
  readonly requestsPerHour: number | null;
  readonly requestsPerDay: number | null;
  readonly concurrencyLimit: number | null;
  readonly notes: string | null;
};

export type MarketDataProviderHealth = {
  readonly state: MarketDataProviderHealthState;
  readonly message: string | null;
  readonly lastHeartbeatAt: string | null;
  readonly lastSuccessfulFetchAt: string | null;
  readonly consecutiveFailures: number;
};

export type MarketDataEstimatedCost = {
  readonly currency: string;
  readonly amountMinorPerRequest: bigint | null;
  readonly monthlyCapMinor: bigint | null;
  readonly notes: string | null;
};

export type MarketDataQuoteBarTradeCapability = {
  readonly quotes: boolean;
  readonly bars: boolean;
  readonly trades: boolean;
};

export type MarketDataProviderCapability = {
  readonly schemaVersion: typeof MARKET_DATA_CAPABILITY_SCHEMA_VERSION;
  readonly providerId: ProviderId;
  readonly routeClass: MarketDataRouteClass;
  readonly dataFamilies: readonly MarketDataFamily[];
  readonly assetClasses: readonly MarketDataAssetClass[];
  readonly instrumentCoverage: readonly string[];
  readonly venueCoverage: readonly string[];
  readonly quoteBarTrade: MarketDataQuoteBarTradeCapability;
  readonly feedTiming: MarketDataFeedTiming;
  readonly timestampSemantics: MarketDataTimestampSemantics;
  readonly sequenceSupport: boolean;
  readonly heartbeatSupport: boolean;
  readonly historicalAvailability: boolean;
  readonly revisionBehavior: MarketDataRevisionBehavior;
  readonly rateLimits: MarketDataRateLimitProfile;
  readonly commercialUseStatus: CommercialUseStatus;
  readonly redistributionStatus: RedistributionStatus;
  readonly credentialState: MarketDataCredentialState;
  readonly providerHealth: MarketDataProviderHealth;
  readonly estimatedProviderCost: MarketDataEstimatedCost;
  readonly entitlementReferences: readonly string[];
  readonly certificationState: MarketDataCertificationState;
  readonly catalogDocumentationUrl: string | null;
  readonly evaluatedAtUtc: string;
};

export { MARKET_DATA_CERTIFICATION_STATES, type MarketDataCertificationState } from './certification-states.ts';
