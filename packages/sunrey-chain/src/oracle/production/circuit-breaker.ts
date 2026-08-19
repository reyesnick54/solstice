/**
 * Connector circuit breaker. Operational state only.
 *
 * CLOSED / OPEN / HALF_OPEN never change consensus, issuance, or
 * verified economic facts.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { ProductionOracleRejection } from './types.ts';
import type { ConnectorClock } from './runtime-types.ts';

export const CIRCUIT_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

export type CircuitBreakerPolicy = {
  readonly consecutiveFailureThreshold: number;
  readonly failureRatioNumerator: number;
  readonly failureRatioDenominator: number;
  readonly sampleWindow: number;
  readonly cooldownMs: number;
};

export const DEFAULT_CIRCUIT_BREAKER_POLICY: CircuitBreakerPolicy = Object.freeze({
  consecutiveFailureThreshold: 3,
  failureRatioNumerator: 1,
  failureRatioDenominator: 1,
  sampleWindow: 4,
  cooldownMs: 1_000,
});

export type CircuitSnapshot = {
  readonly key: string;
  readonly state: CircuitState;
  readonly consecutiveFailures: number;
  readonly successes: number;
  readonly failures: number;
  readonly openedAtMs: bigint | null;
};

type CircuitRecord = CircuitSnapshot & {
  readonly outcomes: boolean[];
};

export class ConnectorCircuitBreaker {
  private readonly records = new Map<string, CircuitRecord>();
  private readonly policy: CircuitBreakerPolicy;
  private readonly clock: ConnectorClock;

  constructor(policy: CircuitBreakerPolicy, clock: ConnectorClock) {
    this.policy = policy;
    this.clock = clock;
  }

  snapshot(providerId: string, sourceId: string): CircuitSnapshot {
    return this.record(`${providerId}:${sourceId}`);
  }

  guard(providerId: string, sourceId: string): Result<true, ProductionOracleRejection> {
    const key = `${providerId}:${sourceId}`;
    const current = this.record(key);
    if (current.state === 'CLOSED') {
      return ok(true);
    }
    if (current.state === 'OPEN') {
      const now = this.clock.nowMs();
      if (current.openedAtMs !== null && now - current.openedAtMs >= BigInt(this.policy.cooldownMs)) {
        this.records.set(key, { ...current, state: 'HALF_OPEN' });
        return ok(true);
      }
      return err({ code: 'CIRCUIT_OPEN', detail: `circuit open for ${sourceId}` });
    }
    return ok(true);
  }

  recordSuccess(providerId: string, sourceId: string): CircuitSnapshot {
    const key = `${providerId}:${sourceId}`;
    const current = this.record(key);
    const outcomes = [...current.outcomes, true].slice(-this.policy.sampleWindow);
    const next: CircuitRecord = {
      ...current,
      state: 'CLOSED',
      consecutiveFailures: 0,
      successes: current.successes + 1,
      outcomes,
      openedAtMs: null,
    };
    this.records.set(key, next);
    return next;
  }

  recordFailure(providerId: string, sourceId: string): CircuitSnapshot {
    const key = `${providerId}:${sourceId}`;
    const current = this.record(key);
    const consecutive = current.consecutiveFailures + 1;
    const outcomes = [...current.outcomes, false].slice(-this.policy.sampleWindow);
    const failures = current.failures + 1;
    const ratioTrip =
      outcomes.length >= this.policy.sampleWindow &&
      outcomes.filter((okOutcome) => !okOutcome).length * this.policy.failureRatioDenominator >=
        outcomes.length * this.policy.failureRatioNumerator;
    const open = consecutive >= this.policy.consecutiveFailureThreshold || ratioTrip || current.state === 'HALF_OPEN';
    const next: CircuitRecord = {
      ...current,
      state: open ? 'OPEN' : current.state,
      consecutiveFailures: consecutive,
      failures,
      outcomes,
      openedAtMs: open ? this.clock.nowMs() : current.openedAtMs,
    };
    this.records.set(key, next);
    return next;
  }

  private record(key: string): CircuitRecord {
    return (
      this.records.get(key) ?? {
        key,
        state: 'CLOSED',
        consecutiveFailures: 0,
        successes: 0,
        failures: 0,
        openedAtMs: null,
        outcomes: [],
      }
    );
  }
}
