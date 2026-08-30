/**
 * @solstice/provider-sdk — shared provider reliability control plane.
 *
 * Wave 1 Prompt 4. Simulation only. No live provider integration.
 */

export {
  HTTP_METHODS,
  CIRCUIT_STATES,
  FAILURE_CLASSIFICATIONS,
  defaultClock,
  isSafeReadMethod,
  type HttpMethod,
  type CircuitState,
  type FailureClassification,
  type ProviderTransport,
  type ProviderTransportRequest,
  type ProviderTransportResponse,
  type ProviderError,
  type ReliabilityOutcome,
  type DeadlineContext,
  type FallbackContext,
  type FallbackDecision,
  type FallbackHook,
  type Clock,
} from './types.ts';

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
 * Wave 1 Prompt 3 — universal provider HTTP transport and authentication layer.
 */

export {
  PROVIDER_HTTP_METHODS,
  PROVIDER_CONTENT_TYPES,
  type ProviderHttpMethod,
  type ProviderContentType,
  type ProviderRequestContext,
  type ProviderResponseMetadata,
  type ProviderParsedBody,
  type ProviderTransportResponse,
  type ProviderTransportResult,
  type ProviderTransportSuccess,
  type ProviderTransportFailure,
  type ProviderTransport,
} from './types.ts';

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
  type Clock,
} from './transport.ts';
export * from './types.ts';
export * from './contract.ts';
export * from './adapter.ts';
export * from './errors.ts';
export * from './activation-policy.ts';
export * from './registry.ts';
export * from './factory.ts';
export * from './catalog/types.ts';
export * from './catalog/loader.ts';
export * from './mocks/index.ts';
