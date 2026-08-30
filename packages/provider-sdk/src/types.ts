/**
 * Canonical SunRey external-data provider and observation types.
 *
 * Provider IDs map to `provider_id` in config/providers/free-api-catalog.yaml.
 */

import type { UtcInstant } from '../../domain/src/time.ts';

export const EXTERNAL_OBSERVATION_SCHEMA = 'sunrey.external-observation.v1' as const;
export const NORMALIZATION_SCHEMA_VERSION = 1 as const;

export const PROVIDER_CATEGORIES = [
  'banking',
  'payments',
  'fx',
  'cards',
  'identity',
  'kyc',
  'kyb',
  'aml',
  'sanctions',
  'fraud',
  'travel_rule',
  'custody',
  'blockchain_analytics',
  'market_data',
  'oracle',
  'economic_data',
  'regulatory',
] as const;

/**
 * Wave 1 — shared provider SDK types.
 *
 * Simulation only. No live provider connectivity.
 */

export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const CIRCUIT_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

export const FAILURE_CLASSIFICATIONS = [
  'retryable',
  'non_retryable',
  'rate_limited',
  'authentication_failure',
  'provider_unavailable',
  'invalid_payload',
  'security_failure',
] as const;
export type FailureClassification = (typeof FAILURE_CLASSIFICATIONS)[number];

export type ProviderTransportRequest = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /** When true, mutation retries are permitted under policy. */
  readonly idempotent?: boolean;
};

export type ProviderTransportResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
};

/**
 * Injectable transport from Prompt 3. Reliability middleware wraps this.
 */
export type ProviderTransport = {
  readonly providerId: string;
  execute(
    request: ProviderTransportRequest,
    options?: { readonly signal?: AbortSignal; readonly deadlineMs?: number },
  ): Promise<ProviderTransportResponse>;
};

export type ProviderError = {
  readonly classification: FailureClassification;
  readonly code: string;
  readonly message: string;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly providerId: string;
};

export type ReliabilityOutcome<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly attempts: number;
      readonly durationMs: number;
      readonly circuitState: CircuitState;
      readonly fallbackEligible: boolean;
    }
  | {
      readonly ok: false;
      readonly error: ProviderError;
      readonly attempts: number;
      readonly durationMs: number;
      readonly circuitState: CircuitState;
      readonly fallbackEligible: boolean;
      readonly cooldownUntilMs?: number;
    };

export type DeadlineContext = {
  readonly deadlineMs: number;
  readonly nowMs?: () => number;
};

export type FallbackContext = {
  readonly providerId: string;
  readonly error: ProviderError;
  readonly attempts: number;
  readonly staleFallbackAllowed: boolean;
  readonly circuitState: CircuitState;
};

export type FallbackDecision =
  | { readonly action: 'none' }
  | { readonly action: 'try_alternate'; readonly reason: string }
  | { readonly action: 'use_stale_cache'; readonly reason: string };

export type FallbackHook = (context: FallbackContext) => FallbackDecision;

export type Clock = {
  readonly nowMs: () => number;
  readonly sleep: (ms: number) => Promise<void>;
};

export const defaultClock = (): Clock => ({
  nowMs: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

export function isSafeReadMethod(method: HttpMethod): boolean {
  return method === 'GET' || method === 'HEAD';
}

/**
 * Wave 1 Prompt 3 — universal provider HTTP transport contract.
 *
 * Vendor-neutral outbound transport for external provider adapters.
 * Not a second provider runtime, ledger, Kernel, or Execution Authority.
 */

import type { ProviderTransportError } from './errors.ts';

export const PROVIDER_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type ProviderHttpMethod = (typeof PROVIDER_HTTP_METHODS)[number];

export const PROVIDER_CONTENT_TYPES = [
  'application/json',
  'text/json',
  'text/plain',
  'text/csv',
  'application/xml',
  'text/xml',
  'application/x-www-form-urlencoded',
] as const;
export type ProviderContentType = (typeof PROVIDER_CONTENT_TYPES)[number] | '*';

export type ProviderRequestContext = {
  readonly providerId: string;
  readonly requestId: string;
  readonly traceId?: string | undefined;
  readonly method: ProviderHttpMethod;
  /** Path relative to the configured provider base URL. Must start with /. */
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean>> | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly body?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly expectedContentType?: ProviderContentType | undefined;
  readonly maximumResponseBytes?: number | undefined;
};

export type ProviderResponseMetadata = {
  readonly providerId: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly httpStatus: number;
  readonly durationMs: number;
  readonly contentType: string | null;
  readonly providerRequestId: string | null;
  readonly startedAtUtc: string;
  readonly finalUrl: string;
};

export type ProviderParsedBody =
  | { readonly format: 'json'; readonly value: unknown }
  | { readonly format: 'text'; readonly value: string }
  | { readonly format: 'raw'; readonly value: string };

export type ProviderTransportResponse<T = unknown> = {
  readonly metadata: ProviderResponseMetadata;
  readonly body: ProviderParsedBody;
  readonly parsed: T | undefined;
};

export type ProviderTransportSuccess<T> = {
  readonly ok: true;
  readonly value: ProviderTransportResponse<T>;
};

export type ProviderTransportFailure = {
  readonly ok: false;
  readonly error: ProviderTransportError;
};

export type ProviderTransportResult<T = unknown> = ProviderTransportSuccess<T> | ProviderTransportFailure;

/**
 * Shared outbound HTTP transport used by all SunRey provider adapters.
 */
export type ProviderTransport = {
  readonly transportId: string;
  request<T = unknown>(context: ProviderRequestContext): Promise<ProviderTransportResult<T>>;
};

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

export const AUTHORITY_CLASSES = [
  'authoritative_official',
  'regulated_provider',
  'reference_data',
  'research_data',
  'community_data',
  'derived_data',
] as const;

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

export const PROVIDER_AUTHORITY_CLASSES = [
  'authoritative_official',
  'regulated_provider',
  'reference_data',
  'research_data',
  'community_data',
  'derived_data',
] as const;
export type ProviderAuthorityClass = (typeof PROVIDER_AUTHORITY_CLASSES)[number];

/** Alias for observation envelope authority classes. */
export const AUTHORITY_CLASSES = PROVIDER_AUTHORITY_CLASSES;
export type AuthorityClass = ProviderAuthorityClass;

export const FRESHNESS_STATUSES = ['fresh', 'aging', 'stale', 'expired', 'unknown'] as const;
export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];

export const VALIDATION_STATUSES = [
  'valid',
  'schema_invalid',
  'bounds_invalid',
  'timestamp_invalid',
  'rejected_untrusted',
  'unknown',
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const COMMERCIAL_USE_STATUSES = [
  'permitted',
  'restricted',
  'prohibited',
  'unknown',
] as const;
export type CommercialUseStatus = (typeof COMMERCIAL_USE_STATUSES)[number];

export const REDISTRIBUTION_STATUSES = [
  'permitted',
  'restricted',
  'prohibited',
  'unknown',
] as const;
export type RedistributionStatus = (typeof REDISTRIBUTION_STATUSES)[number];

export const CONFIDENCE_BASIS = [
  'authoritative_source',
  'regulated_provider',
  'schema_valid',
  'fresh',
  'corroborated',
  'provider_trust',
  'reference_data',
  'derived_only',
  'unknown',
] as const;
export type ConfidenceBasis = (typeof CONFIDENCE_BASIS)[number];

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

export type ObservationSource = {
  readonly provider: string;
  readonly dataset: string;
  readonly sourceUrl: string | null;
};

export type ObservationTime = {
  readonly retrievedAt: UtcInstant;
  readonly sourceTimestamp: UtcInstant | null;
  readonly effectiveAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly staleAfter: UtcInstant | null;
};

export type ObservationConfidence = {
  readonly score: number | null;
  readonly basis: readonly ConfidenceBasis[];
};

export type ObservationQuality = {
  readonly confidence: ObservationConfidence;
  readonly freshnessStatus: FreshnessStatus;
  readonly validationStatus: ValidationStatus;
};

export type ObservationProvenance = {
  readonly requestId: string | null;
  readonly rawPayloadHash: string;
  readonly providerSchemaVersion: string;
  readonly normalizationVersion: string;
  readonly canonicalModelVersion: string | null;
};

export type ObservationLicensing = {
  readonly commercialUseStatus: CommercialUseStatus;
  readonly redistributionStatus: RedistributionStatus;
};

export type ExternalObservation<T> = {
  readonly observationId: string;
  readonly providerId: string;
  readonly providerCategory: ProviderCategory;
  readonly capability: string;
  readonly data: T;
  readonly source: ObservationSource;
  readonly time: ObservationTime;
  readonly quality: ObservationQuality;
  readonly authority: {
    readonly authorityClass: AuthorityClass;
  };
  readonly provenance: ObservationProvenance;
  readonly licensing: ObservationLicensing;
  readonly schemaVersion: typeof EXTERNAL_OBSERVATION_SCHEMA;
};

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

export type ProviderRequestContext = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly consumerDomain: SunReyConsumerDomain;
  readonly nowUtc: string;
};

export type ProviderResponseMetadata = {
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
