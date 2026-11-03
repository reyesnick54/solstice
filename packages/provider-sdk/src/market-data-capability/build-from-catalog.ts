/**
 * Build MarketDataProviderCapability from catalog + HELIOS overlay entry.
 */

import type { CatalogProviderEntry } from '../catalog/types.ts';
import type { CommercialUseStatus, RedistributionStatus } from '../types.ts';
import {
  MARKET_DATA_CAPABILITY_SCHEMA_VERSION,
  type MarketDataAssetClass,
  type MarketDataCredentialState,
  type MarketDataDataFamily,
  type MarketDataEstimatedCost,
  type MarketDataFeedTiming,
  type MarketDataProviderCapability,
  type MarketDataProviderHealth,
  type MarketDataRateLimitProfile,
  type MarketDataRevisionBehavior,
  type MarketDataRouteClass,
  type MarketDataTimestampSemantics,
} from './types.ts';
import type { MarketDataCertificationState } from './certification-states.ts';

export type HeliosMarketDataCatalogOverlayEntry = {
  readonly provider_id: string;
  readonly route_class: MarketDataRouteClass;
  readonly adapter_binding: string;
  readonly data_families: readonly string[];
  readonly asset_classes: readonly string[];
  readonly instrument_coverage: readonly string[];
  readonly venue_coverage: readonly string[];
  readonly quote_capability: boolean;
  readonly bar_capability: boolean;
  readonly trade_capability: boolean;
  readonly feed_timing: MarketDataFeedTiming;
  readonly timestamp_semantics: MarketDataTimestampSemantics;
  readonly sequence_support: boolean;
  readonly heartbeat_support: boolean;
  readonly historical_availability: boolean;
  readonly revision_behavior: MarketDataRevisionBehavior;
  readonly entitlement_refs: readonly string[];
  readonly qualification_instrument_id: string;
  readonly estimated_cost_notes?: string | null;
};

function mapCommercial(status: string): CommercialUseStatus {
  switch (status) {
    case 'verified_allowed':
      return 'verified_allowed';
    case 'restricted':
      return 'restricted';
    case 'attribution_required':
      return 'attribution_required';
    case 'noncommercial_only':
      return 'noncommercial_only';
    case 'requires_legal_review':
      return 'requires_legal_review';
    default:
      return 'unknown';
  }
}

function mapRedistribution(status: string): RedistributionStatus {
  switch (status) {
    case 'allowed':
      return 'allowed';
    case 'attribution_required':
      return 'attribution_required';
    case 'restricted':
      return 'restricted';
    case 'prohibited':
      return 'prohibited';
    default:
      return 'unknown';
  }
}

function mapFeedTiming(freshness: string | null): MarketDataFeedTiming {
  switch (freshness) {
    case 'realtime':
      return 'realtime';
    case 'delayed':
      return 'delayed';
    case 'daily':
    case 'weekly':
    case 'monthly':
      return 'end_of_day';
    default:
      return 'unknown';
  }
}

function credentialStateFromCatalog(
  entry: CatalogProviderEntry | null,
  credentialConfigured: boolean,
): MarketDataCredentialState {
  if (!entry?.authentication.required) {
    return 'not_required';
  }
  return credentialConfigured ? 'configured' : 'not_configured';
}

function rateLimitsFromCatalog(entry: CatalogProviderEntry | null): MarketDataRateLimitProfile {
  const limits = entry?.rate_limits;
  if (!limits) {
    return Object.freeze({
      documented: false,
      requestsPerSecond: null,
      requestsPerMinute: null,
      requestsPerHour: null,
      requestsPerDay: null,
      concurrencyLimit: null,
      notes: null,
    });
  }
  return Object.freeze({
    documented: limits.documented,
    requestsPerSecond: limits.requests_per_second,
    requestsPerMinute: limits.requests_per_minute,
    requestsPerHour: limits.requests_per_hour,
    requestsPerDay: limits.requests_per_day,
    concurrencyLimit: limits.concurrency_limit,
    notes: limits.notes,
  });
}

const DEFAULT_HEALTH: MarketDataProviderHealth = Object.freeze({
  state: 'UNKNOWN',
  message: null,
  lastHeartbeatAt: null,
  lastSuccessfulFetchAt: null,
  consecutiveFailures: 0,
});

const DEFAULT_COST: MarketDataEstimatedCost = Object.freeze({
  currency: 'USD',
  amountMinorPerRequest: null,
  monthlyCapMinor: null,
  notes: null,
});

export function buildMarketDataProviderCapability(input: {
  readonly overlay: HeliosMarketDataCatalogOverlayEntry;
  readonly catalogEntry: CatalogProviderEntry | null;
  readonly credentialConfigured: boolean;
  readonly providerHealth?: MarketDataProviderHealth;
  readonly certificationState: MarketDataCertificationState;
  readonly evaluatedAtUtc: string;
  readonly estimatedProviderCost?: MarketDataEstimatedCost;
}): MarketDataProviderCapability {
  const entry = input.catalogEntry;
  const feedTiming = input.overlay.feed_timing ?? mapFeedTiming(entry?.data_characteristics.freshness ?? null);

  return Object.freeze({
    schemaVersion: MARKET_DATA_CAPABILITY_SCHEMA_VERSION,
    providerId: input.overlay.provider_id,
    routeClass: input.overlay.route_class,
    dataFamilies: Object.freeze(input.overlay.data_families as MarketDataFamily[]),
    assetClasses: Object.freeze(input.overlay.asset_classes as MarketDataAssetClass[]),
    instrumentCoverage: Object.freeze([...input.overlay.instrument_coverage]),
    venueCoverage: Object.freeze([...input.overlay.venue_coverage]),
    quoteBarTrade: Object.freeze({
      quotes: input.overlay.quote_capability,
      bars: input.overlay.bar_capability,
      trades: input.overlay.trade_capability,
    }),
    feedTiming,
    timestampSemantics: input.overlay.timestamp_semantics,
    sequenceSupport: input.overlay.sequence_support,
    heartbeatSupport: input.overlay.heartbeat_support,
    historicalAvailability: input.overlay.historical_availability,
    revisionBehavior: input.overlay.revision_behavior,
    rateLimits: rateLimitsFromCatalog(entry),
    commercialUseStatus: mapCommercial(entry?.commercial_use.status ?? 'unknown'),
    redistributionStatus: mapRedistribution(entry?.redistribution.status ?? 'unknown'),
    credentialState: credentialStateFromCatalog(entry, input.credentialConfigured),
    providerHealth: input.providerHealth ?? DEFAULT_HEALTH,
    estimatedProviderCost: input.estimatedProviderCost ?? {
      ...DEFAULT_COST,
      notes: input.overlay.estimated_cost_notes ?? entry?.access.notes ?? null,
    },
    entitlementReferences: Object.freeze([...input.overlay.entitlement_refs]),
    certificationState: input.certificationState,
    catalogDocumentationUrl: entry?.endpoints.documentation_url ?? null,
    evaluatedAtUtc: input.evaluatedAtUtc,
  });
}

export function docsVerifiedFromCatalog(entry: CatalogProviderEntry | null): boolean {
  if (!entry) {
    return false;
  }
  const hasDocs =
    typeof entry.endpoints.documentation_url === 'string' && entry.endpoints.documentation_url.length > 0;
  const verified =
    entry.verification.status === 'verified' || entry.verification.status === 'partially_verified';
  return hasDocs && verified;
}
