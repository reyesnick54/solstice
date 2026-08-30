/**
 * Per-provider circuit breaker — CLOSED / OPEN / HALF_OPEN.
 */

import type { CircuitState } from './types.ts';
import type { Clock } from './types.ts';
import type { ProviderReliabilityPolicy } from './policy.ts';

export type CircuitSnapshot = {
  readonly state: CircuitState;
  readonly consecutiveFailures: number;
  readonly failuresInWindow: number;
  readonly openedAtMs: number | null;
};

type CircuitRecord = {
  state: CircuitState;
  consecutiveFailures: number;
  outcomes: boolean[];
  openedAtMs: number | null;
};

export class ProviderCircuitBreaker {
  private readonly records = new Map<string, CircuitRecord>();
  private readonly policy: Pick<
    ProviderReliabilityPolicy,
    'circuitBreakerThreshold' | 'circuitBreakerWindow' | 'circuitBreakerCooldown'
  >;
  private readonly clock: Clock;

  constructor(
    policy: Pick<ProviderReliabilityPolicy, 'circuitBreakerThreshold' | 'circuitBreakerWindow' | 'circuitBreakerCooldown'>,
    clock: Clock,
  ) {
    this.policy = policy;
    this.clock = clock;
  }

  snapshot(providerId: string): CircuitSnapshot {
    const record = this.record(providerId);
    return Object.freeze({
      state: record.state,
      consecutiveFailures: record.consecutiveFailures,
      failuresInWindow: record.outcomes.filter((ok) => !ok).length,
      openedAtMs: record.openedAtMs,
    });
  }

  allowRequest(providerId: string): boolean {
    const record = this.record(providerId);
    if (record.state === 'CLOSED') {
      return true;
    }
    if (record.state === 'OPEN') {
      const now = this.clock.nowMs();
      if (record.openedAtMs !== null && now - record.openedAtMs >= this.policy.circuitBreakerCooldown) {
        record.state = 'HALF_OPEN';
        this.records.set(providerId, record);
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(providerId: string): CircuitState {
    const record = this.record(providerId);
    record.consecutiveFailures = 0;
    record.outcomes = [...record.outcomes, true].slice(-this.policy.circuitBreakerWindow);
    record.state = 'CLOSED';
    record.openedAtMs = null;
    this.records.set(providerId, record);
    return record.state;
  }

  recordFailure(providerId: string): CircuitState {
    const record = this.record(providerId);
    record.consecutiveFailures += 1;
    record.outcomes = [...record.outcomes, false].slice(-this.policy.circuitBreakerWindow);
    const failuresInWindow = record.outcomes.filter((ok) => !ok).length;
    const shouldOpen =
      record.state === 'HALF_OPEN' ||
      record.consecutiveFailures >= this.policy.circuitBreakerThreshold ||
      failuresInWindow >= this.policy.circuitBreakerThreshold;
    if (shouldOpen) {
      record.state = 'OPEN';
      record.openedAtMs = this.clock.nowMs();
    }
    this.records.set(providerId, record);
    return record.state;
  }

  private record(providerId: string): CircuitRecord {
    return (
      this.records.get(providerId) ?? {
        state: 'CLOSED' as CircuitState,
        consecutiveFailures: 0,
        outcomes: [],
        openedAtMs: null,
      }
    );
  }
}
