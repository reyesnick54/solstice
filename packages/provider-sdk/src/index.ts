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
