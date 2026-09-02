/**
 * Authority boundary guards — proof objects must never authorize monetary mutation.
 */

import type {
  CanonicalEconomicClaim,
  EconomicEvidence,
  EconomicObservation,
  VerifiedEconomicFact,
} from './types.ts';

export type MonetaryAuthorityViolation = {
  readonly objectKind: 'observation' | 'evidence' | 'verifiedFact' | 'claim';
  readonly objectId: string;
  readonly violation: string;
};

export function observationCannotAuthorizeIssuance(observation: EconomicObservation): MonetaryAuthorityViolation | null {
  if (observation.authority.mintsNativeAsset) {
    return { objectKind: 'observation', objectId: observation.observationId, violation: 'mintsNativeAsset' };
  }
  if (observation.authority.issuesExecutionAuthority) {
    return { objectKind: 'observation', objectId: observation.observationId, violation: 'issuesExecutionAuthority' };
  }
  if (observation.authority.setsExchangePrice) {
    return { objectKind: 'observation', objectId: observation.observationId, violation: 'setsExchangePrice' };
  }
  if (observation.authority.authorizesGovernance) {
    return { objectKind: 'observation', objectId: observation.observationId, violation: 'authorizesGovernance' };
  }
  return null;
}

export function evidenceCannotAuthorizeIssuance(evidence: EconomicEvidence): MonetaryAuthorityViolation | null {
  if (evidence.authority.mintsNativeAsset) {
    return { objectKind: 'evidence', objectId: evidence.evidenceId, violation: 'mintsNativeAsset' };
  }
  if (evidence.authority.issuesExecutionAuthority) {
    return { objectKind: 'evidence', objectId: evidence.evidenceId, violation: 'issuesExecutionAuthority' };
  }
  if (evidence.authority.replacesVaultAuthority) {
    return { objectKind: 'evidence', objectId: evidence.evidenceId, violation: 'replacesVaultAuthority' };
  }
  return null;
}

export function verifiedFactCannotAuthorizeIssuance(fact: VerifiedEconomicFact): MonetaryAuthorityViolation | null {
  if (fact.authority.mintsNativeAsset) {
    return { objectKind: 'verifiedFact', objectId: fact.verifiedFactId, violation: 'mintsNativeAsset' };
  }
  if (fact.authority.issuesExecutionAuthority) {
    return { objectKind: 'verifiedFact', objectId: fact.verifiedFactId, violation: 'issuesExecutionAuthority' };
  }
  if (fact.authority.overridesTaxonomy) {
    return { objectKind: 'verifiedFact', objectId: fact.verifiedFactId, violation: 'overridesTaxonomy' };
  }
  return null;
}

export function claimCannotAuthorizeIssuance(claim: CanonicalEconomicClaim): MonetaryAuthorityViolation | null {
  if (claim.authority.mintsNativeAsset) {
    return { objectKind: 'claim', objectId: claim.economicClaimId, violation: 'mintsNativeAsset' };
  }
  if (claim.authority.issuesExecutionAuthority) {
    return { objectKind: 'claim', objectId: claim.economicClaimId, violation: 'issuesExecutionAuthority' };
  }
  if (claim.authority.isWalletBalance) {
    return { objectKind: 'claim', objectId: claim.economicClaimId, violation: 'isWalletBalance' };
  }
  return null;
}

export function humanAndProductiveClaimsAreDistinguishable(
  human: CanonicalEconomicClaim,
  productive: CanonicalEconomicClaim,
): boolean {
  return human.economicDomain === 'HUMAN_ECONOMIC' && productive.economicDomain === 'PRODUCTIVE_ECONOMIC';
}
