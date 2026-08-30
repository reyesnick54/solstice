/**
 * Expedia sandbox runtime controls — rate limit, circuit breaker, retry, timeout.
 */

import {
  DEFAULT_PROVIDER_SECURITY_POLICY,
  type ProviderCircuitBreakerPolicy,
  type ProviderRateLimitPolicy,
  type ProviderRetryPolicy,
  type ProviderTimeoutPolicy,
} from '../../security.ts';
import type { ExpediaTransportRequest, ExpediaTransportResponse } from './transport.ts';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type ProviderControlSnapshot = {
  readonly circuitState: CircuitState;
  readonly consecutiveFailures: number;
  readonly rateLimitRemaining: number;
  readonly timeoutEvents: number;
  readonly rateLimitEvents: number;
};

type RateBucket = {
  tokens: number;
  lastRefillMs: number;
};

export class ProviderRuntimeControls {
  private circuitState: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAtMs: number | null = null;
  private timeoutEvents = 0;
  private rateLimitEvents = 0;
  private readonly rateBucket: RateBucket;
  private readonly rateLimit: ProviderRateLimitPolicy;
  private readonly retry: ProviderRetryPolicy;
  private readonly circuitBreaker: ProviderCircuitBreakerPolicy;
  private readonly timeout: ProviderTimeoutPolicy;
  private readonly idempotencyCache = new Map<string, ExpediaTransportResponse>();

  constructor(policy = DEFAULT_PROVIDER_SECURITY_POLICY, nowMs = Date.now()) {
    this.rateLimit = policy.rateLimit;
    this.retry = policy.retry;
    this.circuitBreaker = policy.circuitBreaker;
    this.timeout = policy.timeout;
    this.rateBucket = { tokens: policy.rateLimit.burst, lastRefillMs: nowMs };
  }

  snapshot(): ProviderControlSnapshot {
    return Object.freeze({
      circuitState: this.circuitState,
      consecutiveFailures: this.consecutiveFailures,
      rateLimitRemaining: this.rateBucket.tokens,
      timeoutEvents: this.timeoutEvents,
      rateLimitEvents: this.rateLimitEvents,
    });
  }

  private refill(nowMs: number): void {
    const elapsedMinutes = (nowMs - this.rateBucket.lastRefillMs) / 60_000;
    if (elapsedMinutes >= 1) {
      const refill = Math.floor(elapsedMinutes) * this.rateLimit.maxRequestsPerMinute;
      this.rateBucket.tokens = Math.min(this.rateLimit.burst, this.rateBucket.tokens + refill);
      this.rateBucket.lastRefillMs = nowMs;
    }
  }

  private acquireToken(nowMs: number): boolean {
    this.refill(nowMs);
    if (this.rateBucket.tokens <= 0) {
      this.rateLimitEvents += 1;
      return false;
    }
    this.rateBucket.tokens -= 1;
    return true;
  }

  private guardCircuit(nowMs: number): string | null {
    if (this.circuitState === 'CLOSED') {
      return null;
    }
    if (this.circuitState === 'OPEN') {
      if (this.openedAtMs !== null && nowMs - this.openedAtMs >= this.circuitBreaker.resetAfterMs) {
        this.circuitState = 'HALF_OPEN';
        return null;
      }
      return 'CIRCUIT_OPEN';
    }
    return null;
  }

  private recordOutcome(success: boolean, nowMs: number): void {
    if (success) {
      this.consecutiveFailures = 0;
      if (this.circuitState === 'HALF_OPEN') {
        this.circuitState = 'CLOSED';
        this.openedAtMs = null;
      }
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.circuitBreaker.failureThreshold) {
      this.circuitState = 'OPEN';
      this.openedAtMs = nowMs;
    }
  }

  async execute<T extends ExpediaTransportResponse>(
    request: ExpediaTransportRequest,
    invoke: (request: ExpediaTransportRequest) => T | Promise<T>,
    nowMs = Date.now(),
  ): Promise<{ readonly outcome: 'OK' | 'REJECTED'; readonly response?: T; readonly code?: string }> {
    const circuit = this.guardCircuit(nowMs);
    if (circuit) {
      return Object.freeze({ outcome: 'REJECTED', code: circuit });
    }
    if (!this.acquireToken(nowMs)) {
      return Object.freeze({ outcome: 'REJECTED', code: 'RATE_LIMITED' });
    }

    const cacheKey = request.idempotencyKey ?? null;
    if (cacheKey && this.idempotencyCache.has(cacheKey)) {
      return Object.freeze({ outcome: 'OK', response: this.idempotencyCache.get(cacheKey) as T });
    }

    let attempt = 0;
    let lastCode: string | undefined;
    while (attempt < this.retry.maxAttempts) {
      attempt += 1;
      const started = nowMs;
      const result = await Promise.race([
        Promise.resolve(invoke(request)),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), this.timeout.requestTimeoutMs);
        }),
      ]).catch(() => {
        this.timeoutEvents += 1;
        return null;
      });

      if (!result) {
        lastCode = 'TIMEOUT';
        this.recordOutcome(false, Date.now());
        const delay = Math.min(this.retry.maxDelayMs, this.retry.baseDelayMs * 2 ** (attempt - 1));
        await sleep(delay);
        continue;
      }

      const success = result.ok;
      this.recordOutcome(success, Date.now());
      if (success) {
        if (cacheKey) {
          this.idempotencyCache.set(cacheKey, result);
        }
        return Object.freeze({ outcome: 'OK', response: result });
      }

      if (result.status === 429) {
        lastCode = 'RATE_LIMITED';
        this.rateLimitEvents += 1;
      } else if (result.status >= 500) {
        lastCode = 'PROVIDER_OUTAGE';
      } else {
        return Object.freeze({ outcome: 'OK', response: result });
      }

      const delay = Math.min(this.retry.maxDelayMs, this.retry.baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
      nowMs = Date.now();
      if (Date.now() - started > this.timeout.requestTimeoutMs * this.retry.maxAttempts) {
        break;
      }
    }

    return Object.freeze({ outcome: 'REJECTED', code: lastCode ?? 'RETRY_EXHAUSTED' });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createProviderRuntimeControls(): ProviderRuntimeControls {
  return new ProviderRuntimeControls();
}
