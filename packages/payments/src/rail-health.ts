import type { UtcInstant } from '../../domain/src/time.ts';
import type { ProviderId } from './rail-ids.ts';
import type { RailHealthState } from './rail-types.ts';

export const CIRCUIT_FAILURE_KINDS = ['TIMEOUT', 'SERVER_ERROR', 'AUTHENTICATION_FAILURE'] as const;
export type CircuitFailureKind = (typeof CIRCUIT_FAILURE_KINDS)[number];

export type ProviderHealthRecord = {
  readonly provider: ProviderId;
  readonly health: RailHealthState;
  readonly consecutiveFailures: number;
  readonly lastFailureKind: CircuitFailureKind | null;
  readonly updatedAt: UtcInstant;
};

const OPEN_THRESHOLD = 3;

/**
 * Deterministic connector-level circuit breaker.
 * Marks a provider DEGRADED/UNAVAILABLE. Never mutates financial records.
 */
export class RailCircuitBreaker {
  private readonly records = new Map<string, ProviderHealthRecord>();
  private readonly now: () => UtcInstant;

  constructor(now: () => UtcInstant) {
    this.now = now;
  }

  snapshot(provider: ProviderId): ProviderHealthRecord {
    return (
      this.records.get(provider) ??
      Object.freeze({
        provider,
        health: 'AVAILABLE' as const,
        consecutiveFailures: 0,
        lastFailureKind: null,
        updatedAt: this.now(),
      })
    );
  }

  recordSuccess(provider: ProviderId): ProviderHealthRecord {
    const next = Object.freeze({
      provider,
      health: 'AVAILABLE' as const,
      consecutiveFailures: 0,
      lastFailureKind: null,
      updatedAt: this.now(),
    });
    this.records.set(provider, next);
    return next;
  }

  recordFailure(provider: ProviderId, kind: CircuitFailureKind): ProviderHealthRecord {
    const current = this.snapshot(provider);
    const consecutive = current.consecutiveFailures + 1;
    const health: RailHealthState =
      kind === 'AUTHENTICATION_FAILURE' && consecutive >= 1
        ? consecutive >= OPEN_THRESHOLD
          ? 'UNAVAILABLE'
          : 'DEGRADED'
        : consecutive >= OPEN_THRESHOLD
          ? 'UNAVAILABLE'
          : consecutive >= 2
            ? 'DEGRADED'
            : current.health;
    const next = Object.freeze({
      provider,
      health,
      consecutiveFailures: consecutive,
      lastFailureKind: kind,
      updatedAt: this.now(),
    });
    this.records.set(provider, next);
    return next;
  }

  setHealth(provider: ProviderId, health: RailHealthState): ProviderHealthRecord {
    const next = Object.freeze({
      provider,
      health,
      consecutiveFailures: health === 'AVAILABLE' ? 0 : this.snapshot(provider).consecutiveFailures,
      lastFailureKind: this.snapshot(provider).lastFailureKind,
      updatedAt: this.now(),
    });
    this.records.set(provider, next);
    return next;
  }

  list(): readonly ProviderHealthRecord[] {
    return [...this.records.values()];
  }
}

export function healthBlocksRouting(health: RailHealthState): boolean {
  return health === 'UNAVAILABLE' || health === 'MAINTENANCE';
}
