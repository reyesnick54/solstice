/**
 * Wave 3 — Root verification before monetary execution.
 *
 * Does not trust client-submitted root strings without membership checks.
 */

import type { CommitmentRootSet } from './roots.ts';
import {
  evidenceMembershipProof,
  policyMembershipProof,
  rightsMembershipProof,
  verifyMerkleMembership,
} from './roots.ts';
import type {
  CanonicalEconomicClaim,
  EconomicProofBundle,
  EvidenceCommitment,
  PolicyCommitment,
  ProofBoundRejection,
  RightsCommitment,
} from './types.ts';

export type ProofVerificationContext = {
  readonly roots: CommitmentRootSet;
  readonly evidence: EvidenceCommitment;
  readonly rights: RightsCommitment;
  readonly policy: PolicyCommitment;
  readonly claim: CanonicalEconomicClaim;
  readonly nowUnixSeconds: bigint;
  readonly expectedPurpose?: string;
};

export type ProofVerificationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ProofBoundRejection };

export function verifyProofBundle(
  bundle: EconomicProofBundle,
  context: ProofVerificationContext,
): ProofVerificationResult {
  if (bundle.schema !== 'sunrey.economic-proof.v1') {
    return { ok: false, code: 'PROOF_BUNDLE_INVALID' };
  }
  if (bundle.economicClaimId !== context.claim.economicClaimId) {
    return { ok: false, code: 'CLAIM_NOT_FOUND' };
  }
  if (bundle.claimCommitment !== context.claim.claimCommitment) {
    return { ok: false, code: 'PROOF_BUNDLE_INVALID' };
  }
  if (bundle.economicDomain !== context.claim.economicDomain) {
    return { ok: false, code: 'CLAIM_DOMAIN_MISMATCH' };
  }
  if (bundle.evidenceCommitmentHash !== context.evidence.commitmentHash) {
    return { ok: false, code: 'EVIDENCE_COMMITMENT_TAMPERED' };
  }
  if (bundle.evidenceRoot !== context.roots.evidenceRoot) {
    return { ok: false, code: 'EVIDENCE_ROOT_MISMATCH' };
  }
  const evidenceProof = evidenceMembershipProof(context.roots, bundle.evidenceCommitmentHash);
  if (!evidenceProof || !verifyMerkleMembership(context.roots.evidenceRoot, evidenceProof)) {
    return { ok: false, code: 'EVIDENCE_NOT_IN_ROOT' };
  }
  if (bundle.rightsCommitmentHash !== context.rights.commitmentHash) {
    return { ok: false, code: 'RIGHTS_COMMITMENT_TAMPERED' };
  }
  if (bundle.rightsRoot !== context.roots.rightsRoot) {
    return { ok: false, code: 'RIGHTS_ROOT_MISMATCH' };
  }
  const rightsProof = rightsMembershipProof(context.roots, bundle.rightsCommitmentHash);
  if (!rightsProof || !verifyMerkleMembership(context.roots.rightsRoot, rightsProof)) {
    return { ok: false, code: 'RIGHTS_NOT_IN_ROOT' };
  }
  if (!context.rights.active) {
    return { ok: false, code: 'RIGHTS_INACTIVE' };
  }
  if (context.nowUnixSeconds > context.rights.expiresAtUnixSeconds) {
    return { ok: false, code: 'RIGHTS_EXPIRED' };
  }
  if (context.expectedPurpose && context.rights.purpose !== context.expectedPurpose) {
    return { ok: false, code: 'RIGHTS_WRONG_PURPOSE' };
  }
  if (bundle.policyCommitmentHash !== context.policy.commitmentHash) {
    return { ok: false, code: 'POLICY_COMMITMENT_TAMPERED' };
  }
  if (bundle.policyRoot !== context.roots.policyRoot) {
    return { ok: false, code: 'POLICY_ROOT_MISMATCH' };
  }
  const policyProof = policyMembershipProof(context.roots, bundle.policyCommitmentHash);
  if (!policyProof || !verifyMerkleMembership(context.roots.policyRoot, policyProof)) {
    return { ok: false, code: 'POLICY_NOT_IN_ROOT' };
  }
  if (!context.policy.active) {
    return { ok: false, code: 'POLICY_INACTIVE' };
  }
  if (bundle.valuation.methodologyVersion !== context.policy.methodologyVersion) {
    return { ok: false, code: 'POLICY_HASH_MISMATCH' };
  }
  if (!bundle.governanceAuthorization.authorizationId) {
    return { ok: false, code: 'GOVERNANCE_AUTHORIZATION_MISSING' };
  }
  if (bundle.governanceAuthorization.aiApproved !== false) {
    return { ok: false, code: 'AI_GOVERNANCE_REJECTED' };
  }
  if (bundle.governanceAuthorization.authorizedBy !== 'HUMAN_GOVERNANCE') {
    return { ok: false, code: 'AI_GOVERNANCE_REJECTED' };
  }
  return { ok: true };
}

export function verifyAssetDomainMatch(
  bundle: EconomicProofBundle,
  assetId: 'SUNREY_COIN' | 'MOONREY_COIN',
): ProofVerificationResult {
  if (assetId === 'SUNREY_COIN' && bundle.economicDomain !== 'HUMAN_ECONOMY') {
    return { ok: false, code: 'MOONREY_PROOF_FOR_SUNREY' };
  }
  if (assetId === 'MOONREY_COIN' && bundle.economicDomain !== 'PRODUCTIVE_ECONOMY') {
    return { ok: false, code: 'SUNREY_PROOF_FOR_MOONREY' };
  }
  return { ok: true };
}
