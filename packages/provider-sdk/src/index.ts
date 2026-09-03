export {
  EXTERNAL_OBSERVATION_SCHEMA,
  NORMALIZATION_SCHEMA_VERSION,
  PROVIDER_CATEGORIES,
  AUTHORITY_CLASSES,
  FRESHNESS_STATUSES,
  VALIDATION_STATUSES,
  COMMERCIAL_USE_STATUSES,
  REDISTRIBUTION_STATUSES,
  CONFIDENCE_BASIS,
  type ProviderCategory,
  type AuthorityClass,
  type FreshnessStatus,
  type ValidationStatus,
  type CommercialUseStatus,
  type RedistributionStatus,
  type ConfidenceBasis,
  type ObservationSource,
  type ObservationTime,
  type ObservationConfidence,
  type ObservationQuality,
  type ObservationProvenance,
  type ObservationLicensing,
  type ExternalObservation,
  type ProviderResult,
} from './types.ts';

export {
  RAW_PAYLOAD_HASH_ALGORITHM,
  canonicalJsonStringify,
  hashRawPayload,
  hashRawJsonPayload,
  type RawPayloadHash,
} from './hash.ts';

export {
  assessFreshness,
  staleAfterFromPolicy,
  expiresAtFromPolicy,
  MARKET_PRICE_FRESHNESS_POLICY,
  MACRO_STATISTIC_FRESHNESS_POLICY,
  type FreshnessPolicy,
  type FreshnessAssessment,
} from './freshness.ts';

export {
  buildConfidence,
  validateConfidenceScore,
  assertValidConfidence,
  type ConfidenceInput,
} from './confidence.ts';

export {
  sanitizeSourceUrl,
  buildObservationSource,
  buildProvenance,
  provenanceDigestMaterial,
} from './provenance.ts';

export {
  requiredString,
  optionalString,
  validateTimestamp,
  validateOptionalTimestamp,
  validateFiniteNumber,
  validateNumericBounds,
  validateCurrencyCode,
  validateCountryCode,
  validateEnumValue,
  rejectUnexpectedNull,
  validateAssetIdentifier,
} from './validation.ts';

export {
  UNTRUSTED_INPUT_LIMITS,
  parseUntrustedJson,
  sanitizeUntrustedText,
  validateSafeUrl,
  type UntrustedPayloadRejectionCode,
  type UntrustedPayloadResult,
} from './untrusted.ts';

export {
  DEFAULT_DEDUPLICATION_POLICIES,
  buildDeduplicationKey,
  createInMemoryDeduplicationRegistry,
  isDuplicate,
  type DeduplicationKeyPart,
  type DeduplicationPolicy,
  type DeduplicationKey,
  type DeduplicationContext,
  type DeduplicationRegistry,
} from './deduplication.ts';

export {
  runNormalizationPipeline,
  type RawProviderResponse,
  type ProviderSchemaValidator,
  type ProviderParser,
  type DomainMapper,
  type ObservationAssembler,
  type NormalizationPipeline,
} from './pipeline.ts';

export {
  buildExternalObservation,
  validateExternalObservation,
  type BuildExternalObservationInput,
} from './observation.ts';

export {
  PROVIDER_DATA_QUALITY_EVENT_TYPES,
  createProviderDataQualityEvent,
  type ProviderDataQualityEventType,
  type ProviderDataQualityPayload,
  type ProviderDataQualityEvent,
  type ProviderDataInvalidV1,
  type ProviderDataStaleV1,
  type ProviderSchemaChangedV1,
  type ProviderDataOutlierV1,
  type ProviderPayloadDuplicateV1,
} from './events.ts';

export {
  ECONOMIC_PROVENANCE_EVENT_TYPES,
  createEconomicProvenanceEvent,
  type EconomicProvenanceEventType,
  type EconomicProvenanceRefs,
  type EconomicProvenanceEvent,
  type ProviderRecordReceivedV1,
  type ObservationNormalizedV1,
  type ObservationRejectedV1,
  type ObservationDeduplicatedV1,
  type ObservationLinkedV1,
  type EntityResolvedV1,
  type EvidenceCreatedV1,
  type FactVerifiedV1,
  type ClaimCreatedV1,
  type ClaimChallengedV1,
  type ClaimResolvedV1,
} from './economic-events.ts';

export {
  EXTERNAL_OBSERVATION_EVIDENCE_KIND,
  toAgentEvidenceRef,
  bundleObservationEvidence,
  type ExternalObservationEvidenceRef,
  type AgentEvidenceBundle,
} from './agent-evidence.ts';

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
} from './reliability-types.ts';

export {
  DEFAULT_PROVIDER_RELIABILITY_POLICY,
  DEFAULT_GLOBAL_SAFETY_LIMITS,
  DEFAULT_RATE_LIMIT,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  clampTimeoutMs,
  mergePolicy,
  type ProviderReliabilityPolicy,
  type ProviderRateLimitPolicy,
  type GlobalSafetyLimits,
} from './policy.ts';

export {
  classifyHttpStatus,
  isRetryableStatus,
  isNonRetryableStatus,
  parseRetryAfterMs,
  normalizeTransportError,
  shouldRetryOperation,
} from './errors.ts';

export { computeBackoffDelayMs, decideRetryDelay, waitForRetry, type RetryDecision } from './retry.ts';

export { ProviderRateLimiter, type RateLimitResult } from './rate-limit.ts';

export { ProviderBulkheadGuard, type BulkheadAcquireResult } from './bulkhead.ts';

export { ProviderCircuitBreaker, type CircuitSnapshot } from './circuit-breaker.ts';

export {
  ProviderTimeoutError,
  withTimeout,
  effectiveTimeoutMs,
  remainingBudgetMs,
  assertDeadlineRemaining,
} from './timeout.ts';

export { resolveDeadline, budgetExceeded } from './deadline.ts';

export {
  noFallback,
  staleCacheFallback,
  chainFallbackHooks,
  evaluateFallback,
  isFallbackEligible,
} from './fallback.ts';

export {
  PROVIDER_METRIC_NAMES,
  InMemoryProviderMetrics,
  noopProviderMetrics,
  circuitStateGaugeValue,
  recordRequestStart,
  recordRequestDuration,
  recordProviderError,
  recordRetry,
  recordRateLimited,
  recordCircuitState,
  type ProviderMetricName,
  type ProviderMetricLabels,
  type ProviderMetricsRecorder,
} from './metrics.ts';

export { ProviderReliabilityControlPlane, type ProviderReliabilityOptions } from './reliability.ts';

export {
  SimulatedProviderTransport,
  successResponse,
  errorResponse,
  type SimulatedResponse,
} from './simulate.ts';

/**
 * Wave 1 Prompt 3 — universal provider HTTP transport and authentication layer.
 */

export {
  PROVIDER_HTTP_METHODS,
  PROVIDER_CONTENT_TYPES,
  type ProviderHttpMethod,
  type ProviderContentType,
  type ProviderHttpRequestContext,
  type ProviderHttpResponseMetadata,
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
  type ProviderTransportResponse,
  type ProviderTransportResult,
  type ProviderTransportSuccess,
  type ProviderTransportFailure,
  type ProviderTransport,
} from './http-transport-types.ts';

export {
  PROVIDER_TRANSPORT_ERROR_KINDS,
  ProviderTransportError,
  type ProviderTransportErrorKind,
  type ProviderTransportErrorFields,
  networkError,
  timeoutError,
  authenticationError,
  rateLimitError,
  clientError,
  serverError,
  invalidResponseError,
  securityError,
  mapHttpStatusToError,
} from './errors.ts';

export {
  DEFAULT_SENSITIVE_HEADERS,
  DEFAULT_SENSITIVE_QUERY_PARAMS,
  REDACTED,
  createRedactionCatalog,
  redactHeaderRecord,
  redactUrlForLog,
  redactErrorMessage,
  headersAreSafeToLog,
  type RedactionCatalog,
} from './redaction.ts';

export {
  type ProviderAuthStrategy,
  type ProviderAuthInjection,
  type ProviderAuthResolver,
  SecretBackedProviderAuthResolver,
  NO_AUTH_PROVIDER_RESOLVER,
  basicAuthHeader,
  bearerAuthHeader,
  unresolvedSecretMessage,
  type SecretBackedAuthResolverOptions,
} from './auth.ts';

export {
  PROVIDER_TRANSPORT_ENVIRONMENTS,
  DEFAULT_PROVIDER_TRANSPORT_LIMITS,
  createProviderTransportConfig,
  parseApprovedEndpoint,
  type ProviderTransportEnvironment,
  type ProviderEndpointConfig,
  type ProviderTransportConfig,
} from './config.ts';

export {
  parseDestination,
  enforceSsrfPolicy,
  resolveRedirectLocation,
  buildAbsoluteUrl,
  isLoopbackHostname,
  isLinkLocalOrMetadata,
  isPrivateIpv4,
  isPrivateIpv6,
  type ResolvedDestination,
  type SsrfDecision,
} from './ssrf.ts';

export {
  FetchProviderTransport,
  createFetchProviderTransport,
  systemClock,
  type FetchProviderTransportOptions,
  type FetchLike,
  type TransportClock,
} from './transport.ts';

export {
  PROVIDER_ID_PATTERN,
  PROVIDER_CAPABILITIES,
  PROVIDER_STATUSES,
  PROVIDER_AUTHORITY_CLASSES,
  PROVIDER_LAUNCH_TIERS,
  PROVIDER_PRIORITIES,
  PROVIDER_ACTIVATION_MODES,
  SUNREY_CONSUMER_DOMAINS,
  PROVIDER_HEALTH_STATES,
  isProviderId,
  isProviderCategory,
  isKnownProviderCapability,
  isSunReyConsumerDomain,
  type ProviderId,
  type ProviderCapability,
  type ProviderStatus,
  type ProviderAuthorityClass,
  type ProviderLaunchTier,
  type ProviderPriority,
  type ProviderActivationMode,
  type SunReyConsumerDomain,
  type ProviderHealthState,
  type SecretReferenceName,
  type ProviderConfiguration,
  type ProviderDescriptor,
  type ProviderRuntimeContext,
  type ProviderRequestContext,
  type ProviderResponseMetadata,
  type ProviderHealthStatus,
  type ProviderRegistration,
} from './registry-types.ts';

export * from './contract.ts';
export * from './adapter.ts';
export * from './activation-policy.ts';
export * from './registry.ts';
export { createProviderRegistry } from './registry.ts';
export * from './factory.ts';
export * from './catalog/types.ts';
export * from './catalog/loader.ts';
export * from './mocks/index.ts';
export * from './trust/index.ts';
export * from './certification/index.ts';
export * from './connector/index.ts';
