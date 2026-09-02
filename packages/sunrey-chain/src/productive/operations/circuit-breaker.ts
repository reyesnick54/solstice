/**
 * Wave 5 — Domain-scoped circuit breakers.
 *
 * Fail-closed domain controls pause productive verification for a single
 * domain without disabling unrelated domains or ordinary blockchain transfers.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { ProductiveCategory } from '../types.ts';
import type { DomainCircuitBreaker, DomainCircuitState, ProductiveOperationsRejection } from './types.ts';
import { PRODUCTIVE_OPERATIONS_SCHEMA_VERSION } from './types.ts';

export const DEFAULT_REQUIRED_INDEPENDENT_SOURCES = 2;

export function createDomainCircuitBreaker(
  domain: ProductiveCategory,
  requiredIndependentSources = DEFAULT_REQUIRED_INDEPENDENT_SOURCES,
): DomainCircuitBreaker {
  return Object.freeze({
    schemaVersion: PRODUCTIVE_OPERATIONS_SCHEMA_VERSION,
    domain,
    state: 'CLOSED',
    reason: 'coverage_sufficient',
    independentSourceCoverage: requiredIndependentSources,
    requiredIndependentSources,
    openedAtUtc: null,
    transfersPaused: false,
  });
}

export function evaluateDomainCoverage(input: {
  readonly breaker: DomainCircuitBreaker;
  readonly independentSourceCount: number;
  readonly reason?: string;
  readonly nowUtc?: UtcInstant;
}): DomainCircuitBreaker {
  const sufficient = input.independentSourceCount >= input.breaker.requiredIndependentSources;
  if (sufficient) {
    return Object.freeze({
      ...input.breaker,
      state: input.breaker.state === 'OPEN' ? 'HALF_OPEN' : 'CLOSED',
      reason: input.reason ?? 'coverage_sufficient',
      independentSourceCoverage: input.independentSourceCount,
      openedAtUtc: input.breaker.state === 'OPEN' ? input.breaker.openedAtUtc : null,
    });
  }
  return Object.freeze({
    ...input.breaker,
    state: 'OPEN',
    reason: input.reason ?? 'insufficient_independent_source_coverage',
    independentSourceCoverage: input.independentSourceCount,
    openedAtUtc: input.nowUtc ?? asUtcInstant(new Date().toISOString()),
  });
}

export function domainVerificationPaused(breaker: DomainCircuitBreaker): boolean {
  return breaker.state === 'OPEN';
}

export class DomainCircuitBreakerRegistry {
  private readonly breakers = new Map<ProductiveCategory, DomainCircuitBreaker>();

  ensure(domain: ProductiveCategory, requiredIndependentSources = DEFAULT_REQUIRED_INDEPENDENT_SOURCES): DomainCircuitBreaker {
    const existing = this.breakers.get(domain);
    if (existing) {
      return existing;
    }
    const breaker = createDomainCircuitBreaker(domain, requiredIndependentSources);
    this.breakers.set(domain, breaker);
    return breaker;
  }

  updateCoverage(
    domain: ProductiveCategory,
    independentSourceCount: number,
    reason?: string,
  ): DomainCircuitBreaker {
    const breaker = this.ensure(domain);
    const next = evaluateDomainCoverage({ breaker, independentSourceCount, reason });
    this.breakers.set(domain, next);
    return next;
  }

  get(domain: ProductiveCategory): DomainCircuitBreaker | null {
    return this.breakers.get(domain) ?? null;
  }

  list(): readonly DomainCircuitBreaker[] {
    return [...this.breakers.values()];
  }

  pausedDomains(): readonly ProductiveCategory[] {
    return this.list().filter((row) => row.state === 'OPEN').map((row) => row.domain);
  }

  assertVerificationAllowed(domain: ProductiveCategory): Result<true, ProductiveOperationsRejection> {
    const breaker = this.breakers.get(domain);
    if (breaker && domainVerificationPaused(breaker)) {
      return err({
        code: 'DOMAIN_CIRCUIT_OPEN',
        detail: `${domain} productive verification paused: ${breaker.reason}`,
      });
    }
    return ok(true);
  }
}
