/**
 * Health, timeout, retry, and circuit-breaker controls.
 * Financial mutations are not blindly retried.
 */

import { decideProviderRetry } from '../core.ts';
import {
  CIRCUIT_STATES,
  DEFAULT_CIRCUIT_COOLDOWN_MS,
  DEFAULT_CIRCUIT_FAILURES,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  universalErr,
  universalOk,
  type CircuitState,
  type ProviderHealthRecord,
  type ProviderHealthState,
  type RetryClass,
  type UniversalResult,
} from './types.ts';

export function clampTimeoutMs(requested: number | undefined): number {
  const value = requested ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(value)));
}

export function runWithTimeout<T>(
  operation: (deadlineMs: number) => T,
  timeoutMs: number,
  nowMs: () => number = () => Date.now(),
): UniversalResult<T> {
  const budget = clampTimeoutMs(timeoutMs);
  const started = nowMs();
  const deadline = started + budget;
  try {
    const value = operation(deadline);
    if (nowMs() > deadline) {
      return universalErr('PROVIDER_TIMEOUT', 'provider request exceeded timeout');
    }
    return universalOk(value);
  } catch (error) {
    if (error instanceof ProviderTimeoutError) {
      return universalErr('PROVIDER_TIMEOUT', error.message);
    }
    throw error;
  }
}

export class ProviderTimeoutError extends Error {
  readonly code = 'PROVIDER_TIMEOUT' as const;
  constructor(message = 'provider request exceeded timeout') {
    super(message);
    this.name = 'ProviderTimeoutError';
  }
}

export function throwIfTimedOut(deadlineMs: number, nowMs: () => number = () => Date.now()): void {
  if (nowMs() > deadlineMs) {
    throw new ProviderTimeoutError();
  }
}

export type UniversalRetryDecision = {
  readonly retry: boolean;
  readonly retryClass: RetryClass;
  readonly reason: string;
  readonly attempt: number;
};

export function decideUniversalRetry(input: {
  readonly retryClass: RetryClass;
  readonly attempt: number;
  readonly maxAttempts?: number;
  readonly transient: boolean;
  readonly providerSupportsIdempotency?: boolean;
  readonly sunreyIdempotencyKey?: string;
  readonly operationReference?: string;
  readonly lastState?: 'NOT_SUBMITTED' | 'SUBMITTED' | 'UNKNOWN' | 'CONFIRMED';
}): UniversalRetryDecision {
  const maxAttempts = input.maxAttempts ?? 3;
  if (input.retryClass === 'READ') {
    return Object.freeze({
      retry: input.transient && input.attempt < maxAttempts,
      retryClass: input.retryClass,
      reason: input.transient ? 'safe_read_retry' : 'non_transient',
      attempt: input.attempt,
    });
  }
  if (input.retryClass === 'NON_IDEMPOTENT_MUTATION') {
    return Object.freeze({
      retry: false,
      retryClass: input.retryClass,
      reason: 'non_idempotent_mutation_must_not_retry',
      attempt: input.attempt,
    });
  }
  const financial = decideProviderRetry({
    attempt: input.attempt,
    maxAttempts,
    financial: true,
    lastState:
      input.lastState === 'UNKNOWN'
        ? 'SUBMISSION_UNKNOWN'
        : input.lastState === 'SUBMITTED'
          ? 'SUBMITTED'
          : input.lastState === 'CONFIRMED'
            ? 'CONFIRMED'
            : 'NOT_SUBMITTED',
    transient: input.transient,
  });
  const hasIdempotency =
    input.providerSupportsIdempotency === true &&
    Boolean(input.sunreyIdempotencyKey) &&
    Boolean(input.operationReference);
  return Object.freeze({
    retry: financial.retry && hasIdempotency,
    retryClass: input.retryClass,
    reason: financial.retry
      ? hasIdempotency
        ? 'idempotent_mutation_retry'
        : 'idempotency_key_required'
      : 'financial_retry_blocked',
    attempt: input.attempt,
  });
}

export class UniversalCircuitBreaker {
  #state: CircuitState = 'CLOSED';
  #failures = 0;
  #openedAtMs = 0;
  readonly #openAfter: number;
  readonly #cooldownMs: number;

  constructor(openAfter = DEFAULT_CIRCUIT_FAILURES, cooldownMs = DEFAULT_CIRCUIT_COOLDOWN_MS) {
    this.#openAfter = openAfter;
    this.#cooldownMs = cooldownMs;
  }

  state(nowMs = Date.now()): CircuitState {
    if (this.#state === 'OPEN' && nowMs - this.#openedAtMs >= this.#cooldownMs) {
      this.#state = 'HALF_OPEN';
    }
    return this.#state;
  }

  allowRequest(nowMs = Date.now()): boolean {
    const current = this.state(nowMs);
    return current === 'CLOSED' || current === 'HALF_OPEN';
  }

  recordSuccess(): CircuitState {
    this.#failures = 0;
    this.#state = 'CLOSED';
    return this.#state;
  }

  recordFailure(nowMs = Date.now()): CircuitState {
    if (this.#state === 'HALF_OPEN') {
      this.#state = 'OPEN';
      this.#openedAtMs = nowMs;
      return this.#state;
    }
    this.#failures += 1;
    if (this.#failures >= this.#openAfter) {
      this.#state = 'OPEN';
      this.#openedAtMs = nowMs;
    }
    return this.#state;
  }

  snapshot(nowMs = Date.now()): { readonly state: CircuitState; readonly failures: number } {
    return Object.freeze({ state: this.state(nowMs), failures: this.#failures });
  }

  restore(state: CircuitState, failures: number, openedAtMs = 0): CircuitState {
    this.#state = state;
    this.#failures = failures;
    this.#openedAtMs = openedAtMs;
    return this.#state;
  }
}

export function emptyHealth(providerId: string, nowUtc: string): ProviderHealthRecord {
  return Object.freeze({
    providerId,
    state: 'UNKNOWN',
    lastSuccessAt: null,
    lastFailureAt: null,
    latencyMs: null,
    errorRate: 0,
    consecutiveFailures: 0,
    rateLimited: false,
    circuitState: 'CLOSED',
    updatedAt: nowUtc,
  });
}

export function applyHealthObservation(
  current: ProviderHealthRecord,
  input: {
    readonly success: boolean;
    readonly latencyMs: number | null;
    readonly rateLimited?: boolean;
    readonly maintenance?: boolean;
    readonly circuitState: CircuitState;
    readonly nowUtc: string;
  },
): ProviderHealthRecord {
  const consecutive = input.success ? 0 : current.consecutiveFailures + 1;
  const samples = current.errorRate < 0 ? 0 : 1;
  const errorRate = input.success
    ? current.errorRate * 0.7
    : Math.min(1, current.errorRate * 0.7 + 0.3 * samples + (current.errorRate === 0 ? 0.3 : 0));
  let state: ProviderHealthState = 'HEALTHY';
  if (input.maintenance) {
    state = 'MAINTENANCE';
  } else if (input.rateLimited) {
    state = 'RATE_LIMITED';
  } else if (!input.success && consecutive >= 3) {
    state = 'UNAVAILABLE';
  } else if (!input.success) {
    state = 'DEGRADED';
  } else if (errorRate > 0.2) {
    state = 'DEGRADED';
  }
  return Object.freeze({
    providerId: current.providerId,
    state,
    lastSuccessAt: input.success ? input.nowUtc : current.lastSuccessAt,
    lastFailureAt: input.success ? current.lastFailureAt : input.nowUtc,
    latencyMs: input.latencyMs,
    errorRate,
    consecutiveFailures: consecutive,
    rateLimited: input.rateLimited === true,
    circuitState: input.circuitState,
    updatedAt: input.nowUtc,
  });
}

export function healthBlocksRouting(state: ProviderHealthState): boolean {
  return state === 'UNAVAILABLE' || state === 'MAINTENANCE' || state === 'RATE_LIMITED';
}

export function isCircuitState(value: string): value is CircuitState {
  return (CIRCUIT_STATES as readonly string[]).includes(value);
}
