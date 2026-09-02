/**
 * Wave 5 — Read-only operational audit views.
 *
 * Internal operational surfaces for incident response and governance review.
 * No mutating authority.
 */

import type { ProductiveCategory } from '../types.ts';
import type { ProductiveAssetAnomaly, ProductiveClaimChallenge, ProviderIncident } from './types.ts';
import type { DomainCircuitBreaker } from './types.ts';
import type { ProductiveSourceReputation } from './source-reputation.ts';

export type BlockedMoonReyProposalView = {
  readonly proposalId: string;
  readonly claimId: string;
  readonly blockedReason: string;
  readonly challengeId: string | null;
  readonly anomalyId: string | null;
  readonly domainCircuitOpen: ProductiveCategory | null;
};

export type ProductiveOperationsAuditView = {
  readonly energyVerificationProviders: readonly string[];
  readonly degradedSourceClasses: readonly string[];
  readonly challengedClaims: readonly ProductiveClaimChallenge[];
  readonly blockedProposals: readonly BlockedMoonReyProposalView[];
  readonly anomalyFlags: readonly ProductiveAssetAnomaly[];
  readonly openIncidents: readonly ProviderIncident[];
  readonly domainCircuits: readonly DomainCircuitBreaker[];
  readonly sourceReputations: readonly ProductiveSourceReputation[];
};

export function buildAuditView(input: {
  readonly providersByDomain: Readonly<Partial<Record<ProductiveCategory, readonly string[]>>>;
  readonly reputations: readonly ProductiveSourceReputation[];
  readonly challengedClaims: readonly ProductiveClaimChallenge[];
  readonly blockedProposals: readonly BlockedMoonReyProposalView[];
  readonly anomalyFlags: readonly ProductiveAssetAnomaly[];
  readonly openIncidents: readonly ProviderIncident[];
  readonly domainCircuits: readonly DomainCircuitBreaker[];
  readonly reputationDegradedThreshold?: number;
}): ProductiveOperationsAuditView {
  const threshold = input.reputationDegradedThreshold ?? 50;
  return Object.freeze({
    energyVerificationProviders: Object.freeze([...(input.providersByDomain.ENERGY ?? [])]),
    degradedSourceClasses: Object.freeze(
      input.reputations.filter((row) => row.compositeScore < threshold).map((row) => row.sourceClass),
    ),
    challengedClaims: Object.freeze([...input.challengedClaims]),
    blockedProposals: Object.freeze([...input.blockedProposals]),
    anomalyFlags: Object.freeze([...input.anomalyFlags]),
    openIncidents: Object.freeze([...input.openIncidents]),
    domainCircuits: Object.freeze([...input.domainCircuits]),
    sourceReputations: Object.freeze([...input.reputations]),
  });
}
