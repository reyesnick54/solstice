/**
 * Explainable trust factor assessment.
 */

import type { AuthorityClass, FreshnessStatus } from '../types.ts';
import { authorityRank } from './policies.ts';
import type { TrustObservationContext, ProviderHealthTrust, SchemaValidityTrust, AuthoritySummary } from './types.ts';

const AUTHORITY_WEIGHT: Readonly<Record<AuthorityClass, number>> = Object.freeze({
  authoritative_official: 1.0,
  regulated_provider: 0.85,
  reference_data: 0.75,
  derived_data: 0.5,
  research_data: 0.55,
  community_data: 0.35,
});

export function mapProviderRiskToHealth(
  riskState: TrustObservationContext['providerRiskState'],
  quarantined?: boolean,
): ProviderHealthTrust {
  if (quarantined) {
    return 'quarantined';
  }
  switch (riskState) {
    case 'DEGRADED':
      return 'degraded';
    case 'SUSPICIOUS':
    case 'COMPROMISED_SUSPECTED':
      return 'suspicious';
    case 'DISABLED':
      return 'quarantined';
    default:
      return 'healthy';
  }
}

export function mapValidationToSchema(validity: string): SchemaValidityTrust {
  if (validity === 'valid') return 'valid';
  if (validity === 'partial') return 'partially_valid';
  return 'invalid';
}

export function authorityWeight(class_: AuthorityClass): number {
  return AUTHORITY_WEIGHT[class_] ?? 0.3;
}

export function freshnessWeight(status: FreshnessStatus): number {
  switch (status) {
    case 'fresh':
      return 1.0;
    case 'aging':
      return 0.8;
    case 'stale':
      return 0.5;
    case 'expired':
      return 0;
    default:
      return 0.4;
  }
}

export function providerHealthWeight(health: ProviderHealthTrust): number {
  switch (health) {
    case 'healthy':
      return 1.0;
    case 'degraded':
      return 0.6;
    case 'suspicious':
      return 0.3;
    case 'quarantined':
      return 0;
  }
}

export function computeObservationWeight(ctx: TrustObservationContext, authorityPrecedence: readonly AuthorityClass[]): number {
  const health = mapProviderRiskToHealth(ctx.providerRiskState, ctx.quarantined);
  if (health === 'quarantined') {
    return 0;
  }
  const authority = authorityWeight(ctx.observation.authority.authorityClass);
  const freshness = freshnessWeight(ctx.observation.quality.freshnessStatus);
  const healthW = providerHealthWeight(health);
  const precedenceBonus = 1 - authorityRank(ctx.observation.authority.authorityClass, authorityPrecedence) * 0.05;
  return authority * freshness * healthW * precedenceBonus;
}

export function buildAuthoritySummary(contexts: readonly TrustObservationContext[]): AuthoritySummary {
  const classes = [...new Set(contexts.map((c) => c.observation.authority.authorityClass))];
  const sorted = [...classes].sort(
    (a, b) => authorityWeight(b) - authorityWeight(a),
  );
  const officialCount = contexts.filter(
    (c) => c.observation.authority.authorityClass === 'authoritative_official',
  ).length;
  return Object.freeze({
    dominantClass: sorted[0] ?? null,
    classesPresent: Object.freeze(sorted),
    officialSourceCount: officialCount,
  });
}

export function countIndependentSources(contexts: readonly TrustObservationContext[]): number {
  const seen = new Set<string>();
  for (const ctx of contexts) {
    const lineageKey =
      ctx.lineage?.upstreamSource ??
      ctx.lineage?.sourceFamily ??
      ctx.lineage?.datasetOrigin ??
      ctx.observation.providerId;
    seen.add(lineageKey);
  }
  return seen.size;
}

export function scoreToConfidenceBand(score: number | null): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score === null) return 'LOW';
  if (score >= 0.75) return 'HIGH';
  if (score >= 0.45) return 'MEDIUM';
  return 'LOW';
}

export function roundConfidenceScore(score: number): number {
  return Math.round(score * 100) / 100;
}

export function aggregateFreshness(contexts: readonly TrustObservationContext[]): FreshnessStatus {
  const order: FreshnessStatus[] = ['expired', 'stale', 'aging', 'unknown', 'fresh'];
  let worst: FreshnessStatus = 'fresh';
  for (const ctx of contexts) {
    const status = ctx.observation.quality.freshnessStatus;
    if (order.indexOf(status) < order.indexOf(worst)) {
      worst = status;
    }
  }
  return worst;
}

export function bandMeetsMinimum(band: 'HIGH' | 'MEDIUM' | 'LOW', minimum: 'HIGH' | 'MEDIUM' | 'LOW'): boolean {
  const ranks = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  return ranks[band] >= ranks[minimum];
}
