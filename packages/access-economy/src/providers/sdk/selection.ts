/**
 * ACCESS Wave 2 — Deterministic provider selection policy.
 *
 * Not a black-box AI process. Stores selection reason.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderId, ProviderCapabilityId } from '../types.ts';
import type { AccessProviderDescriptor } from './descriptor.ts';
import type { AccessProviderHealthSnapshot } from './health.ts';
import type { AccessProviderRiskScore } from './risk.ts';

export type ProviderSelectionCriteria = {
  readonly category: AccessCapacityCategory;
  readonly capability: ProviderCapabilityId;
  readonly geography: string | null;
  readonly preferredProviderId?: AccessProviderId;
};

export type ProviderSelectionCandidate = {
  readonly descriptor: AccessProviderDescriptor;
  readonly health: AccessProviderHealthSnapshot;
  readonly risk: AccessProviderRiskScore;
  readonly commercialPriority: number;
  readonly trustScore: number;
};

export type ProviderSelectionResult = {
  readonly selectedProviderId: AccessProviderId | null;
  readonly reason: string;
  readonly ranked: readonly { readonly providerId: AccessProviderId; readonly score: number; readonly reason: string }[];
  readonly fallbackAvailable: boolean;
};

function healthScore(health: AccessProviderHealthSnapshot): number {
  switch (health.health) {
    case 'HEALTHY':
      return 100;
    case 'DEGRADED':
      return 60;
    case 'UNHEALTHY':
      return 10;
    default:
      return 30;
  }
}

function activationScore(state: AccessProviderDescriptor['activationState']): number {
  switch (state) {
    case 'PRODUCTION_ENABLED':
      return 100;
    case 'SANDBOX_ENABLED':
      return 70;
    case 'PREVIEW':
      return 40;
    default:
      return 0;
  }
}

function contractScore(status: AccessProviderDescriptor['commercialStatus']): number {
  switch (status) {
    case 'SIGNED':
      return 100;
    case 'SANDBOX':
      return 70;
    case 'DISCOVERY_TERMS':
      return 40;
    case 'COMMERCIAL_NEGOTIATION':
      return 30;
    default:
      return 0;
  }
}

function credentialScore(status: AccessProviderDescriptor['credentialStatus']): number {
  switch (status) {
    case 'NOT_REQUIRED':
    case 'CONFIGURED':
      return 100;
    case 'MISSING':
      return 20;
    case 'INVALID':
      return 0;
    default:
      return 30;
  }
}

export function scoreProviderCandidate(
  candidate: ProviderSelectionCandidate,
  criteria: ProviderSelectionCriteria,
): { readonly score: number; readonly reason: string } {
  if (!candidate.descriptor.capabilities.includes(criteria.capability)) {
    return { score: -1, reason: `missing capability ${criteria.capability}` };
  }
  if (!candidate.descriptor.categories.includes(criteria.category)) {
    return { score: -1, reason: `missing category ${criteria.category}` };
  }
  if (
    criteria.geography &&
    candidate.descriptor.geographies.length > 0 &&
    !candidate.descriptor.geographies.includes(criteria.geography) &&
    !candidate.descriptor.geographies.includes('GLOBAL')
  ) {
    return { score: -1, reason: `geography ${criteria.geography} not served` };
  }
  if (candidate.risk.state === 'QUARANTINED') {
    return { score: -1, reason: 'provider quarantined' };
  }
  if (candidate.descriptor.activationState === 'DISABLED') {
    return { score: -1, reason: 'provider disabled' };
  }

  let score = 0;
  const reasons: string[] = [];

  score += activationScore(candidate.descriptor.activationState) * 0.25;
  reasons.push(`activation=${candidate.descriptor.activationState}`);

  score += healthScore(candidate.health) * 0.2;
  reasons.push(`health=${candidate.health.health}`);

  score += contractScore(candidate.descriptor.commercialStatus) * 0.15;
  reasons.push(`contract=${candidate.descriptor.commercialStatus}`);

  score += credentialScore(candidate.descriptor.credentialStatus) * 0.1;
  reasons.push(`credential=${candidate.descriptor.credentialStatus}`);

  score += candidate.commercialPriority * 0.15;
  reasons.push(`commercialPriority=${candidate.commercialPriority}`);

  score += candidate.trustScore * 0.1;
  reasons.push(`trust=${candidate.trustScore}`);

  if (candidate.risk.state === 'SUSPICIOUS') {
    score -= 20;
    reasons.push('suspicious risk penalty');
  }

  if (criteria.preferredProviderId === candidate.descriptor.providerId) {
    score += 15;
    reasons.push('user preference');
  }

  return { score: Math.round(score), reason: reasons.join('; ') };
}

export function selectProvider(
  candidates: readonly ProviderSelectionCandidate[],
  criteria: ProviderSelectionCriteria,
): ProviderSelectionResult {
  const ranked = candidates
    .map((candidate) => {
      const { score, reason } = scoreProviderCandidate(candidate, criteria);
      return Object.freeze({ providerId: candidate.descriptor.providerId, score, reason });
    })
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return Object.freeze({
      selectedProviderId: null,
      reason: 'no eligible provider for criteria',
      ranked: Object.freeze([]),
      fallbackAvailable: false,
    });
  }

  const selected = ranked[0]!;
  return Object.freeze({
    selectedProviderId: selected.providerId,
    reason: `selected ${selected.providerId}: ${selected.reason}`,
    ranked: Object.freeze(ranked),
    fallbackAvailable: ranked.length > 1,
  });
}
