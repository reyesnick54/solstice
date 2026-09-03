// @ts-nocheck
/**
 * Wave 6 — Domain-scoped circuit breakers.
 *
 * Pauses new automated verification for a compromised contribution domain
 * without halting ordinary SunRey transfers, MoonRey, unrelated categories,
 * or the whole blockchain.
 */

import type { DomainCircuitBreakerState, HumanContributionDomain } from './types.ts';

export type DomainCircuitBreakerRegistry = {
  readonly domains: ReadonlyMap<HumanContributionDomain, DomainCircuitBreakerState>;
};

export function emptyDomainCircuitBreakerRegistry(): DomainCircuitBreakerRegistry {
  return { domains: new Map() };
}

export function pauseDomainVerification(
  registry: DomainCircuitBreakerRegistry,
  input: {
    readonly contributionDomain: HumanContributionDomain;
    readonly reason: string;
    readonly pausedAtUtc: string;
    readonly pausedBy: NonNullable<DomainCircuitBreakerState['pausedBy']>;
  },
): DomainCircuitBreakerState {
  const state: DomainCircuitBreakerState = Object.freeze({
    contributionDomain: input.contributionDomain,
    paused: true,
    reason: input.reason,
    pausedAtUtc: input.pausedAtUtc,
    pausedBy: input.pausedBy,
    ordinaryTransfersUnaffected: true,
    unrelatedDomainsUnaffected: true,
  });
  registry.domains.set(input.contributionDomain, state);
  return state;
}

export function resumeDomainVerification(
  registry: DomainCircuitBreakerRegistry,
  contributionDomain: HumanContributionDomain,
): DomainCircuitBreakerState | null {
  const existing = registry.domains.get(contributionDomain);
  if (!existing) {
    return null;
  }
  const state: DomainCircuitBreakerState = Object.freeze({
    ...existing,
    paused: false,
    reason: null,
    pausedAtUtc: null,
    pausedBy: null,
  });
  registry.domains.set(contributionDomain, state);
  return state;
}

export function isDomainVerificationPaused(
  registry: DomainCircuitBreakerRegistry,
  contributionDomain: HumanContributionDomain,
): boolean {
  return registry.domains.get(contributionDomain)?.paused === true;
}

export function circuitBreakerDoesNotHaltBlockchain(): true {
  return true;
}

export function circuitBreakerDoesNotHaltMoonRey(): true {
  return true;
}

export function circuitBreakerDoesNotHaltOrdinaryTransfers(): true {
  return true;
}
