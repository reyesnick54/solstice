/**
 * Provider Reliability Control Plane — orchestrates policy, limits, and transport.
 *
 * Flow:
 *   Adapter → Policy → Rate Limiter → Bulkhead → Circuit Breaker → Transport → Retry
 */

import { ProviderBulkheadGuard } from './bulkhead.ts';
import { ProviderCircuitBreaker } from './circuit-breaker.ts';
import { resolveDeadline } from './deadline.ts';
import { evaluateFallback, isFallbackEligible } from './fallback.ts';
import { isRetryableStatus, normalizeTransportError, shouldRetryOperation } from './errors.ts';
import {
  recordCircuitState,
  recordProviderError,
  recordRateLimited,
  recordRequestDuration,
  recordRequestStart,
  recordRetry,
  type ProviderMetricsRecorder,
} from './metrics.ts';
import {
  DEFAULT_GLOBAL_SAFETY_LIMITS,
  DEFAULT_PROVIDER_RELIABILITY_POLICY,
  mergePolicy,
  type GlobalSafetyLimits,
  type ProviderReliabilityPolicy,
} from './policy.ts';
import { ProviderRateLimiter } from './rate-limit.ts';
import { decideRetryDelay, waitForRetry } from './retry.ts';
import { ProviderTimeoutError, withTimeout } from './timeout.ts';
import {
  defaultClock,
  type CircuitState,
  type DeadlineContext,
  type FallbackContext,
  type FallbackDecision,
  type FallbackHook,
  type ProviderError,
  type ReliabilityClock,
  type ReliabilityOutcome,
  type ReliabilityProviderTransport,
  type ReliabilityTransport,
  type ReliabilityTransportRequest,
  type ReliabilityTransportResponse,
} from './reliability-types.ts';

export type ProviderReliabilityOptions = {
  readonly policy?: Partial<ProviderReliabilityPolicy>;
  readonly globalLimits?: Partial<GlobalSafetyLimits>;
  readonly clock?: ReliabilityClock;
  readonly metrics?: ProviderMetricsRecorder;
  readonly fallbackHook?: FallbackHook;
  readonly rateLimiter?: ProviderRateLimiter;
  readonly bulkhead?: ProviderBulkheadGuard;
  readonly circuits?: ProviderCircuitBreaker;
};

export class ProviderReliabilityControlPlane {
  readonly policy: ProviderReliabilityPolicy;
  readonly globalLimits: GlobalSafetyLimits;
  readonly clock: ReliabilityClock;
  readonly metrics: ProviderMetricsRecorder;
  private readonly fallbackHook: FallbackHook | undefined;
  private readonly rateLimiter: ProviderRateLimiter;
  private readonly bulkhead: ProviderBulkheadGuard;
  private readonly circuits: ProviderCircuitBreaker;

  constructor(options: ProviderReliabilityOptions = {}) {
    this.policy = mergePolicy(DEFAULT_PROVIDER_RELIABILITY_POLICY, options.policy);
    this.globalLimits = Object.freeze({
      ...DEFAULT_GLOBAL_SAFETY_LIMITS,
      ...options.globalLimits,
    });
    this.clock = options.clock ?? defaultClock();
    this.metrics = options.metrics ?? { increment() {}, observe() {}, setGauge() {} };
    this.fallbackHook = options.fallbackHook;
    this.rateLimiter = options.rateLimiter ?? new ProviderRateLimiter(this.policy.rateLimit, this.clock);
    this.bulkhead =
      options.bulkhead ??
      new ProviderBulkheadGuard({
        concurrencyLimit: this.policy.concurrencyLimit,
        globalLimits: this.globalLimits,
      });
    this.circuits =
      options.circuits ??
      new ProviderCircuitBreaker(
        {
          circuitBreakerThreshold: this.policy.circuitBreakerThreshold,
          circuitBreakerWindow: this.policy.circuitBreakerWindow,
          circuitBreakerCooldown: this.policy.circuitBreakerCooldown,
        },
        this.clock,
      );
  }

  circuitState(providerId: string) {
    return this.circuits.snapshot(providerId);
  }

  async execute<T = ReliabilityTransportResponse>(
    transport: ReliabilityTransport,
    request: ReliabilityTransportRequest,
    input: {
      readonly deadline?: DeadlineContext;
      readonly mapResponse?: (response: ReliabilityTransportResponse) => T;
    } = {},
  ): Promise<ReliabilityOutcome<T>> {
    const providerId = transport.providerId;
    const startedMs = this.clock.nowMs();
    const mapResponse = input.mapResponse ?? ((response: ReliabilityTransportResponse) => response as T);
    recordRequestStart(this.metrics, providerId, request.method);

    let deadlineMs: number;
    try {
      const resolveInput: {
        deadline?: DeadlineContext;
        defaultBudgetMs: number;
        nowMs: number;
      } = {
        defaultBudgetMs: this.policy.timeoutMs,
        nowMs: startedMs,
      };
      if (input.deadline !== undefined) {
        resolveInput.deadline = input.deadline;
      }
      const resolved = resolveDeadline(resolveInput);
      deadlineMs = resolved.deadlineMs;
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        const timeoutError = normalizeTransportError({ providerId, timeout: true });
        recordProviderError(this.metrics, providerId, timeoutError.classification);
        return this.failureOutcome(timeoutError, 0, startedMs, providerId);
      }
      throw error;
    }

    const rate = this.rateLimiter.acquire(providerId);
    if (!rate.allowed) {
      recordRateLimited(this.metrics, providerId);
      const error = normalizeTransportError({
        providerId,
        response: { status: 429, headers: {}, body: {} },
      });
      recordProviderError(this.metrics, providerId, error.classification);
      return this.failureOutcome(error, 0, startedMs, providerId, rate.cooldownUntilMs);
    }

    const bulkhead = this.bulkhead.tryAcquire(providerId);
    if (!bulkhead.acquired) {
      const concurrencyError = Object.freeze({
        classification: 'provider_unavailable' as const,
        code: 'BULKHEAD_REJECTED',
        message: `concurrency limit reached for ${providerId}`,
        providerId,
      });
      recordProviderError(this.metrics, providerId, concurrencyError.classification);
      return this.failureOutcome(concurrencyError, 0, startedMs, providerId);
    }

    try {
      if (!this.circuits.allowRequest(providerId)) {
        const circuitState = this.circuits.snapshot(providerId).state;
        recordCircuitState(this.metrics, providerId, circuitState);
        const error = Object.freeze({
          classification: 'provider_unavailable' as const,
          code: 'CIRCUIT_OPEN',
          message: `circuit open for ${providerId}`,
          providerId,
        });
        recordProviderError(this.metrics, providerId, error.classification);
        return this.failureOutcome(error, 0, startedMs, providerId);
      }

      let attempt = 0;
      let lastError = normalizeTransportError({ providerId });
      const maxAttempts = Math.min(this.policy.maxRetries, this.globalLimits.maxRetries) + 1;

      while (attempt < maxAttempts) {
        attempt += 1;
        const now = this.clock.nowMs();
        if (now - startedMs >= this.globalLimits.maxTotalTimeMs) {
          lastError = normalizeTransportError({ providerId, timeout: true });
          break;
        }
        const timeoutMs = Math.min(
          this.policy.timeoutMs,
          Math.max(1, deadlineMs - now),
        );

        try {
          const response = await withTimeout(
            (signal) => transport.execute(request, { signal, deadlineMs }),
            timeoutMs,
            this.clock,
          );
          if (response.status >= 200 && response.status < 300) {
            this.circuits.recordSuccess(providerId);
            const circuitState = this.circuits.snapshot(providerId).state;
            recordCircuitState(this.metrics, providerId, circuitState);
            const durationMs = this.clock.nowMs() - startedMs;
            recordRequestDuration(this.metrics, providerId, request.method, durationMs);
            return Object.freeze({
              ok: true,
              value: mapResponse(response),
              attempts: attempt,
              durationMs,
              circuitState,
              fallbackEligible: false,
            });
          }

          lastError = normalizeTransportError({
            providerId,
            response,
            nowMs: this.clock.nowMs(),
          });
          if (response.status === 429) {
            recordRateLimited(this.metrics, providerId);
            if (lastError.retryAfterMs !== undefined) {
              this.rateLimiter.applyCooldown(
                providerId,
                this.clock.nowMs() + lastError.retryAfterMs,
              );
            }
          }
          this.circuits.recordFailure(providerId);
          recordCircuitState(this.metrics, providerId, this.circuits.snapshot(providerId).state);
          recordProviderError(this.metrics, providerId, lastError.classification);

          const canRetry =
            attempt < maxAttempts &&
            shouldRetryOperation({
              method: request.method,
              error: lastError,
              ...(request.idempotent !== undefined ? { idempotent: request.idempotent } : {}),
            }) &&
            (lastError.status === undefined || isRetryableStatus(lastError.status));

          if (!canRetry) {
            break;
          }

          const retryInput: {
            policy: ProviderReliabilityPolicy;
            attempt: number;
            retryAfterMs?: number;
          } = { policy: this.policy, attempt };
          if (lastError.retryAfterMs !== undefined) {
            retryInput.retryAfterMs = lastError.retryAfterMs;
          }
          const retryDecision = decideRetryDelay(retryInput);
          if (!retryDecision.retry) {
            break;
          }
          recordRetry(this.metrics, providerId);
          await waitForRetry(this.clock, retryDecision.delayMs);
          continue;
        } catch (error) {
          const timedOut = error instanceof ProviderTimeoutError;
          const networkError = !timedOut;
          lastError = normalizeTransportError({
            providerId,
            timeout: timedOut,
            networkError,
          });
          this.circuits.recordFailure(providerId);
          recordCircuitState(this.metrics, providerId, this.circuits.snapshot(providerId).state);
          recordProviderError(this.metrics, providerId, lastError.classification);

          const canRetry =
            attempt < maxAttempts &&
            shouldRetryOperation({
              method: request.method,
              error: lastError,
              ...(request.idempotent !== undefined ? { idempotent: request.idempotent } : {}),
            });
          if (!canRetry) {
            break;
          }
          const retryDecision = decideRetryDelay({ policy: this.policy, attempt });
          if (!retryDecision.retry) {
            break;
          }
          recordRetry(this.metrics, providerId);
          await waitForRetry(this.clock, retryDecision.delayMs);
        }
      }

      const circuitState = this.circuits.snapshot(providerId).state;
      return this.failureOutcome(lastError, attempt, startedMs, providerId, undefined, circuitState);
    } finally {
      bulkhead.release();
    }
  }

  private failureOutcome<T>(
    error: ProviderError,
    attempts: number,
    startedMs: number,
    providerId: string,
    cooldownUntilMs?: number,
    circuitState = this.circuits.snapshot(providerId).state,
  ): ReliabilityOutcome<T> {
    const durationMs = this.clock.nowMs() - startedMs;
    recordRequestDuration(this.metrics, providerId, 'unknown', durationMs);
    const fallbackContext = Object.freeze({
      providerId,
      error,
      attempts,
      staleFallbackAllowed: this.policy.staleFallbackAllowed,
      circuitState,
    });
    const fallbackEligible = isFallbackEligible(fallbackContext);
    evaluateFallback(this.fallbackHook, fallbackContext);
    return Object.freeze({
      ok: false,
      error,
      attempts,
      durationMs,
      circuitState,
      fallbackEligible,
      ...(cooldownUntilMs !== undefined ? { cooldownUntilMs } : {}),
    });
  }
}
