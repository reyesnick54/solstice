/**
 * Per-provider reliability policy. Conservative defaults.
 */

export type ProviderRateLimitPolicy = {
  readonly requestsPerSecond?: number | null;
  readonly requestsPerMinute?: number | null;
  readonly requestsPerHour?: number | null;
  readonly requestsPerDay?: number | null;
};

export type ProviderReliabilityPolicy = {
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly rateLimit: ProviderRateLimitPolicy;
  readonly concurrencyLimit: number;
  readonly circuitBreakerThreshold: number;
  readonly circuitBreakerWindow: number;
  readonly circuitBreakerCooldown: number;
  readonly respectRetryAfter: boolean;
  readonly staleFallbackAllowed: boolean;
};

export type GlobalSafetyLimits = {
  readonly maxRetries: number;
  readonly maxTotalTimeMs: number;
  readonly maxConcurrencyPerProvider: number;
  readonly globalProviderConcurrencyCeiling: number | null;
};

export const MIN_TIMEOUT_MS = 100;
export const MAX_TIMEOUT_MS = 30_000;
export const DEFAULT_TIMEOUT_MS = 5_000;

export const DEFAULT_RATE_LIMIT: ProviderRateLimitPolicy = Object.freeze({
  requestsPerSecond: 10,
  requestsPerMinute: 300,
  requestsPerHour: 5_000,
  requestsPerDay: 50_000,
});

export const DEFAULT_PROVIDER_RELIABILITY_POLICY: ProviderReliabilityPolicy = Object.freeze({
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxRetries: 3,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 8_000,
  rateLimit: DEFAULT_RATE_LIMIT,
  concurrencyLimit: 10,
  circuitBreakerThreshold: 5,
  circuitBreakerWindow: 10,
  circuitBreakerCooldown: 30_000,
  respectRetryAfter: true,
  staleFallbackAllowed: false,
});

export const DEFAULT_GLOBAL_SAFETY_LIMITS: GlobalSafetyLimits = Object.freeze({
  maxRetries: 5,
  maxTotalTimeMs: 60_000,
  maxConcurrencyPerProvider: 50,
  globalProviderConcurrencyCeiling: 500,
});

export function clampTimeoutMs(requested: number, policyMax = MAX_TIMEOUT_MS): number {
  if (!Number.isFinite(requested)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(policyMax, Math.max(MIN_TIMEOUT_MS, Math.trunc(requested)));
}

export function mergePolicy(
  base: ProviderReliabilityPolicy,
  overrides: Partial<ProviderReliabilityPolicy> = {},
): ProviderReliabilityPolicy {
  return Object.freeze({
    ...base,
    ...overrides,
    rateLimit: Object.freeze({ ...base.rateLimit, ...overrides.rateLimit }),
    timeoutMs: clampTimeoutMs(overrides.timeoutMs ?? base.timeoutMs),
  });
}
