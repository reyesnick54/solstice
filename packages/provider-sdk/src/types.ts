/**
 * Unified provider-sdk type surface — re-exports split modules without duplication.
 */

export * from './observation-types.ts';
export * from './registry-types.ts';
export {
  PROVIDER_HTTP_METHODS,
  PROVIDER_CONTENT_TYPES,
  type ProviderHttpMethod,
  type ProviderContentType,
  type ProviderHttpRequestContext,
  type ProviderHttpResponseMetadata,
  type ProviderParsedBody,
  type ProviderHttpTransportResponse,
  type ProviderHttpTransportSuccess,
  type ProviderHttpTransportFailure,
  type ProviderHttpTransportResult,
  type ProviderHttpTransport,
  type HttpProviderRequestContext,
  type HttpProviderResponseMetadata,
  type HttpProviderTransportResponse,
  type HttpProviderTransportSuccess,
  type HttpProviderTransportFailure,
  type HttpProviderTransportResult,
  type HttpProviderTransport,
} from './http-transport-types.ts';
export {
  HTTP_METHODS,
  CIRCUIT_STATES,
  FAILURE_CLASSIFICATIONS,
  defaultClock,
  isSafeReadMethod,
  type HttpMethod,
  type CircuitState,
  type FailureClassification,
  type ReliabilityProviderTransport,
  type ReliabilityTransport,
  type ReliabilityTransportRequest,
  type ReliabilityTransportResponse,
  type ProviderError,
  type ReliabilityOutcome,
  type DeadlineContext,
  type FallbackContext,
  type FallbackDecision,
  type FallbackHook,
  type ReliabilityClock,
  type ProviderTransportRequest,
  type ProviderTransportResponse,
  type ProviderTransport,
  type Clock,
} from './reliability-types.ts';

import { PROVIDER_AUTHORITY_CLASSES } from './registry-types.ts';

export const AUTHORITY_CLASSES = PROVIDER_AUTHORITY_CLASSES;
export type AuthorityClass = (typeof PROVIDER_AUTHORITY_CLASSES)[number];

export {
  FRESHNESS_STATUSES,
  VALIDATION_STATUSES,
  COMMERCIAL_USE_STATUSES,
  REDISTRIBUTION_STATUSES,
  CONFIDENCE_BASIS,
} from './observation-types.ts';
export type {
  ValidationStatus,
  CommercialUseStatus,
  RedistributionStatus,
  ConfidenceBasis,
  FreshnessStatus,
} from './observation-types.ts';

/**
 * Canonical SunRey external-data provider types.
 *
 * Provider IDs map to `provider_id` in config/providers/free-api-catalog.yaml.
 * This package is the data-plane SDK for free/public API providers. Regulated
 * financial provider runtime remains at packages/sunrey-chain/src/provider-runtime.
 */

export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

export type ProviderId = string;

export const PROVIDER_CATEGORIES = [
  'macroeconomics',
  'foreign_exchange',
  'markets',
  'securities',
  'commodities',
  'corporate_filings',
  'cryptocurrency',
  'blockchain',
  'compliance',
  'kyb_identity',
  'fraud_risk',
  'cybersecurity',
  'energy',
  'natural_resources',
  'environmental',
  'weather',
  'water',
  'transportation',
  'aviation',
  'maritime',
  'travel',
  'geospatial',
  'logistics',
  'health',
  'food_nutrition',
  'jobs_skills',
  'research',
  'patents',
  'government_open_data',
  'artificial_intelligence',
  'other',
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const PROVIDER_CAPABILITIES = [
  'macroeconomic_indicators',
  'interest_rates',
  'inflation',
  'employment',
  'fx_rates',
  'crypto_prices',
  'market_prices',
  'company_filings',
  'sanctions',
  'pep_screening',
  'weather',
  'water_data',
  'aviation_positions',
  'geocoding',
  'nutrition',
  'job_search',
  'research_papers',
  'economic_indicators',
  'commodity_prices',
  'blockchain_intelligence',
  'cyber_threat_intel',
  'travel_availability',
  'logistics_tracking',
  'government_statistics',
  'ai_inference',
] as const;
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number] | string;

export type ProviderAuthorityClass = (typeof AUTHORITY_CLASSES)[number];

export const PROVIDER_STATUSES = [
  'registered',
  'initializing',
  'ready',
  'degraded',
  'unhealthy',
  'shutting_down',
  'shutdown',
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const PROVIDER_LAUNCH_TIERS = [
  'production_candidate',
  'secondary_source',
  'fallback_source',
  'research_only',
  'blocked_pending_review',
] as const;
export type ProviderLaunchTier = (typeof PROVIDER_LAUNCH_TIERS)[number];

export const PROVIDER_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type ProviderPriority = (typeof PROVIDER_PRIORITIES)[number];

export const PROVIDER_ACTIVATION_MODES = [
  'enabled',
  'disabled',
  'preview_only',
  'production_enabled',
  'blocked',
] as const;
export type ProviderActivationMode = (typeof PROVIDER_ACTIVATION_MODES)[number];

export const SUNREY_CONSUMER_DOMAINS = [
  'world',
  'grow',
  'financial_agent',
  'exchange',
  'blockchain_intelligence',
  'moonrey',
  'hin',
  'vault',
  'travel',
  'compliance',
  'cybersecurity',
  'economic_graph',
  'action_center',
  'research',
  'infrastructure',
] as const;
export type SunReyConsumerDomain = (typeof SUNREY_CONSUMER_DOMAINS)[number];

export const PROVIDER_HEALTH_STATES = [
  'healthy',
  'degraded',
  'unhealthy',
  'unknown',
] as const;
export type ProviderHealthState = (typeof PROVIDER_HEALTH_STATES)[number];

export type ProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type SecretReferenceName = {
  readonly environmentVariable: string;
  readonly resolved: false;
};

export type ProviderConfiguration = {
  readonly providerId: ProviderId;
  readonly secretReference: SecretReferenceName | null;
  readonly featureFlag: string | null;
  readonly timeoutMs: number | null;
  readonly notes: string | null;
};

export type ProviderDescriptor = {
  readonly id: ProviderId;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly primaryCategory: ProviderCategory;
  readonly capabilities: readonly ProviderCapability[];
  readonly domains: readonly SunReyConsumerDomain[];
  readonly authorityClass: ProviderAuthorityClass;
  readonly priority: ProviderPriority;
  readonly launchTier: ProviderLaunchTier;
  readonly activationMode: ProviderActivationMode;
  readonly catalogOnly: boolean;
  readonly secretReference: SecretReferenceName | null;
};

export type ProviderRuntimeContext = {
  readonly environment: 'simulation' | 'sandbox' | 'preproduction' | 'production';
  readonly nowUtc: string;
  readonly correlationId: string;
  readonly catalogId: string;
};

export type ProviderAdapterRequestContext = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly consumerDomain: SunReyConsumerDomain;
  readonly nowUtc: string;
};

export type ProviderAdapterResponseMetadata = {
  readonly providerId: ProviderId;
  readonly requestId: string;
  readonly correlationId: string;
  readonly observedAt: string;
  readonly cacheHit: false;
  readonly simulationOnly: boolean;
};

export type ProviderHealthStatus = {
  readonly providerId: ProviderId;
  readonly state: ProviderHealthState;
  readonly status: ProviderStatus;
  readonly checkedAt: string;
  readonly message: string;
  readonly latencyMs: number | null;
};

export type ProviderRegistration = {
  readonly provider: import('./contract.ts').SunReyProvider;
  readonly descriptor: ProviderDescriptor;
  readonly registeredAt: string;
  readonly activationMode: ProviderActivationMode;
};

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_ID_PATTERN.test(value);
}

export function isProviderCategory(value: string): value is ProviderCategory {
  return (PROVIDER_CATEGORIES as readonly string[]).includes(value);
}

export function isKnownProviderCapability(value: string): value is ProviderCapability {
  return (PROVIDER_CAPABILITIES as readonly string[]).includes(value);
}

export function isSunReyConsumerDomain(value: string): value is SunReyConsumerDomain {
  return (SUNREY_CONSUMER_DOMAINS as readonly string[]).includes(value);
}
