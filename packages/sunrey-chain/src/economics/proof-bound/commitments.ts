/**
 * Wave 3 — domain-separated economic commitments.
 *
 * No raw sensitive evidence. Commitments bind references and digests only.
 */

import { commitCanonical } from '../../hash.ts';
import type { EvidenceCommitment, PolicyCommitment, RightsCommitment } from './types.ts';

export const EVIDENCE_COMMITMENT_DOMAIN = 'sunrey.economic-proof.evidence.v1' as const;
export const RIGHTS_COMMITMENT_DOMAIN = 'sunrey.economic-proof.rights.v1' as const;
export const POLICY_COMMITMENT_DOMAIN = 'sunrey.economic-proof.policy.v1' as const;
export const CLAIM_COMMITMENT_DOMAIN = 'sunrey.economic-proof.claim.v1' as const;

function sortedJoin(values: readonly string[]): string {
  return [...values].sort().join(',');
}

export function economicClaimCommitment(fields: {
  readonly economicClaimId: string;
  readonly economicDomain: string;
  readonly contributionClass: string;
  readonly fingerprint: string;
  readonly subjectCommitment: string;
}): string {
  return commitCanonical({
    domain: CLAIM_COMMITMENT_DOMAIN,
    economicClaimId: fields.economicClaimId,
    economicDomain: fields.economicDomain,
    contributionClass: fields.contributionClass,
    fingerprint: fields.fingerprint,
    subjectCommitment: fields.subjectCommitment,
  });
}

export function evidenceCommitment(fields: {
  readonly commitmentId: string;
  readonly evidenceClass: string;
  readonly subjectCommitment: string;
  readonly provenanceRef: string;
  readonly verificationPolicyVersion: string;
  readonly sealedAtUtc: string;
}): EvidenceCommitment {
  const commitmentHash = commitCanonical({
    domain: EVIDENCE_COMMITMENT_DOMAIN,
    commitmentId: fields.commitmentId,
    evidenceClass: fields.evidenceClass,
    subjectCommitment: fields.subjectCommitment,
    provenanceRef: fields.provenanceRef,
    verificationPolicyVersion: fields.verificationPolicyVersion,
    sealedAtUtc: fields.sealedAtUtc,
  });
  return Object.freeze({
    commitmentId: fields.commitmentId,
    commitmentHash,
    evidenceClass: fields.evidenceClass,
    subjectCommitment: fields.subjectCommitment,
    provenanceRef: fields.provenanceRef,
    verificationPolicyVersion: fields.verificationPolicyVersion,
    sealedAtUtc: fields.sealedAtUtc,
  });
}

export function rightsCommitment(fields: {
  readonly commitmentId: string;
  readonly rightsClass: RightsCommitment['rightsClass'];
  readonly purpose: string;
  readonly scopeCommitment: string;
  readonly holderCommitment: string;
  readonly validFromUnixSeconds: bigint;
  readonly expiresAtUnixSeconds: bigint;
  readonly active: boolean;
}): RightsCommitment {
  const commitmentHash = commitCanonical({
    domain: RIGHTS_COMMITMENT_DOMAIN,
    commitmentId: fields.commitmentId,
    rightsClass: fields.rightsClass,
    purpose: fields.purpose,
    scopeCommitment: fields.scopeCommitment,
    holderCommitment: fields.holderCommitment,
    validFrom: fields.validFromUnixSeconds.toString(10),
    expiresAt: fields.expiresAtUnixSeconds.toString(10),
    active: fields.active,
  });
  return Object.freeze({
    commitmentId: fields.commitmentId,
    commitmentHash,
    rightsClass: fields.rightsClass,
    purpose: fields.purpose,
    scopeCommitment: fields.scopeCommitment,
    holderCommitment: fields.holderCommitment,
    validFromUnixSeconds: fields.validFromUnixSeconds,
    expiresAtUnixSeconds: fields.expiresAtUnixSeconds,
    active: fields.active,
  });
}

export function policyCommitment(fields: {
  readonly commitmentId: string;
  readonly policyPackId: string;
  readonly policyVersion: string;
  readonly methodologyVersion: string;
  readonly active: boolean;
  readonly activatedAtHeight: number;
}): PolicyCommitment {
  const commitmentHash = commitCanonical({
    domain: POLICY_COMMITMENT_DOMAIN,
    commitmentId: fields.commitmentId,
    policyPackId: fields.policyPackId,
    policyVersion: fields.policyVersion,
    methodologyVersion: fields.methodologyVersion,
    active: fields.active,
    activatedAtHeight: fields.activatedAtHeight,
  });
  return Object.freeze({
    commitmentId: fields.commitmentId,
    commitmentHash,
    policyPackId: fields.policyPackId,
    policyVersion: fields.policyVersion,
    methodologyVersion: fields.methodologyVersion,
    active: fields.active,
    activatedAtHeight: fields.activatedAtHeight,
  });
}

export function monetizationKeyOf(
  economicClaimId: string,
  governanceAuthorizationId: string,
  valuationId: string,
): string {
  return commitCanonical({
    domain: 'sunrey.economic-proof.monetization-key.v1',
    economicClaimId,
    governanceAuthorizationId,
    valuationId,
  });
}

export function governanceDigest(
  authorizationId: string,
  authorizedQuantity: string,
  governancePolicyVersion: string,
): string {
  return commitCanonical({
    domain: 'sunrey.economic-proof.governance.v1',
    authorizationId,
    authorizedQuantity,
    governancePolicyVersion,
    authorizedBy: 'HUMAN_GOVERNANCE',
    aiApproved: false,
  });
}

export function valuationDigest(
  valuationId: string,
  methodologyId: string,
  methodologyVersion: string,
  referenceValue: string,
): string {
  return commitCanonical({
    domain: 'sunrey.economic-proof.valuation.v1',
    valuationId,
    methodologyId,
    methodologyVersion,
    referenceValue,
    isExchangeMarketPrice: false,
  });
}

export function bundleIdOf(bundle: {
  readonly economicClaimId: string;
  readonly monetizationKey: string;
  readonly protocolVersion: string;
}): string {
  return commitCanonical({
    domain: 'sunrey.economic-proof.bundle-id.v1',
    economicClaimId: bundle.economicClaimId,
    monetizationKey: bundle.monetizationKey,
    protocolVersion: bundle.protocolVersion,
  });
}
