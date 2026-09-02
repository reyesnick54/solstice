/**
 * Wave 3 — EconomicProofBundle construction.
 */

import {
  bundleIdOf,
  governanceDigest,
  monetizationKeyOf,
  valuationDigest,
} from './commitments.ts';
import type {
  CommitmentRootContext,
  EconomicDomain,
  EconomicProofBundle,
  EconomicValuationRef,
  EvidenceCommitment,
  GovernanceAuthorizationRef,
  PolicyCommitment,
  RightsCommitment,
} from './types.ts';
import { ECONOMIC_PROOF_SCHEMA } from './types.ts';

export function createEconomicProofBundle(input: {
  readonly economicClaimId: string;
  readonly claimCommitment: string;
  readonly economicDomain: EconomicDomain;
  readonly evidence: EvidenceCommitment;
  readonly rights: RightsCommitment;
  readonly policy: PolicyCommitment;
  readonly roots: CommitmentRootContext;
  readonly valuation: {
    readonly valuationId: string;
    readonly methodologyId: string;
    readonly methodologyVersion: string;
    readonly referenceValue: string;
    readonly denomination: string;
  };
  readonly governance: {
    readonly authorizationId: string;
    readonly authorizedQuantity: string;
    readonly governancePolicyVersion: string;
  };
  readonly protocolVersion?: string;
}): EconomicProofBundle {
  const valuation: EconomicValuationRef = Object.freeze({
    valuationId: input.valuation.valuationId,
    methodologyId: input.valuation.methodologyId,
    methodologyVersion: input.valuation.methodologyVersion,
    valuationDigest: valuationDigest(
      input.valuation.valuationId,
      input.valuation.methodologyId,
      input.valuation.methodologyVersion,
      input.valuation.referenceValue,
    ),
    referenceValue: input.valuation.referenceValue,
    denomination: input.valuation.denomination,
    isExchangeMarketPrice: false,
  });
  const governanceAuthorization: GovernanceAuthorizationRef = Object.freeze({
    authorizationId: input.governance.authorizationId,
    authorizedQuantity: input.governance.authorizedQuantity,
    governancePolicyVersion: input.governance.governancePolicyVersion,
    governanceDigest: governanceDigest(
      input.governance.authorizationId,
      input.governance.authorizedQuantity,
      input.governance.governancePolicyVersion,
    ),
    authorizedBy: 'HUMAN_GOVERNANCE',
    aiApproved: false,
  });
  const monetizationKey = monetizationKeyOf(
    input.economicClaimId,
    input.governance.authorizationId,
    input.valuation.valuationId,
  );
  const protocolVersion = input.protocolVersion ?? 'sunrey.economic-proof.v1';
  const bundleId = bundleIdOf({ economicClaimId: input.economicClaimId, monetizationKey, protocolVersion });
  return Object.freeze({
    schema: ECONOMIC_PROOF_SCHEMA,
    bundleId,
    economicClaimId: input.economicClaimId,
    claimCommitment: input.claimCommitment,
    economicDomain: input.economicDomain,
    evidenceCommitmentId: input.evidence.commitmentId,
    evidenceCommitmentHash: input.evidence.commitmentHash,
    evidenceRoot: input.roots.evidenceRoot,
    rightsCommitmentId: input.rights.commitmentId,
    rightsCommitmentHash: input.rights.commitmentHash,
    rightsRoot: input.roots.rightsRoot,
    policyCommitmentId: input.policy.commitmentId,
    policyCommitmentHash: input.policy.commitmentHash,
    policyRoot: input.roots.policyRoot,
    valuation,
    governanceAuthorization,
    monetizationKey,
    protocolVersion,
  });
}

export function tamperEvidenceHash(bundle: EconomicProofBundle, fakeHash: string): EconomicProofBundle {
  return Object.freeze({ ...bundle, evidenceCommitmentHash: fakeHash });
}

export function tamperPolicyHash(bundle: EconomicProofBundle, fakeHash: string): EconomicProofBundle {
  return Object.freeze({ ...bundle, policyCommitmentHash: fakeHash });
}

export function swapDomain(bundle: EconomicProofBundle, domain: EconomicDomain): EconomicProofBundle {
  return Object.freeze({ ...bundle, economicDomain: domain });
}
