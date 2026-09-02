import type { EvidenceBundle } from './bundle.ts';
import type { EvidenceCommitment } from './commitment.ts';
import { buildMembershipProof, verifyMembershipProof, type MerkleMembershipProof } from './merkle.ts';
import { blockEvidenceRootEntries, computeEvidenceRoot } from './root.ts';
import { bundleMerkleEntries, evidenceBundleMerkleRoot } from './bundle.ts';

export type EvidenceInclusionProof = {
  readonly commitment: EvidenceCommitment;
  readonly bundleId: string;
  readonly claimId: string;
  readonly bundleRootHex: string;
  readonly bundleMerkleRootHex: string;
  readonly bundleMembership: MerkleMembershipProof;
  readonly blockMembership: MerkleMembershipProof;
  readonly blockHeight: bigint;
  readonly evidenceRootHex: string;
};

export function buildEvidenceInclusionProof(input: {
  readonly commitment: EvidenceCommitment;
  readonly bundle: EvidenceBundle;
  readonly blockBundles: readonly EvidenceBundle[];
  readonly blockHeight: bigint;
}): EvidenceInclusionProof {
  if (!input.bundle.entries.some((entry) => entry.commitment.commitmentHash === input.commitment.commitmentHash)) {
    throw new Error('commitment is not a member of the supplied bundle');
  }
  const bundleMerkleRootHex = evidenceBundleMerkleRoot(input.bundle.entries);
  const bundleMembership = buildMembershipProof(
    bundleMerkleEntries(input.bundle),
    input.commitment.commitmentHash,
  );
  const evidenceRoot = computeEvidenceRoot({
    scopeHeight: input.blockHeight,
    bundles: input.blockBundles,
  });
  const blockMembership = buildMembershipProof(
    blockEvidenceRootEntries(input.blockBundles),
    input.bundle.bundleId,
  );
  return Object.freeze({
    commitment: input.commitment,
    bundleId: input.bundle.bundleId,
    claimId: input.bundle.claim.claimId,
    bundleRootHex: input.bundle.bundleRoot,
    bundleMerkleRootHex,
    bundleMembership,
    blockMembership,
    blockHeight: input.blockHeight,
    evidenceRootHex: evidenceRoot.rootHex,
  });
}

export function verifyEvidenceInclusionProof(proof: EvidenceInclusionProof): boolean {
  if (proof.bundleMembership.leafKey !== proof.commitment.commitmentHash) {
    return false;
  }
  if (proof.bundleMembership.leafValueHex !== proof.commitment.commitmentHash) {
    return false;
  }
  if (!verifyMembershipProof(proof.bundleMerkleRootHex, proof.bundleMembership)) {
    return false;
  }
  if (proof.blockMembership.leafKey !== proof.bundleId) {
    return false;
  }
  if (proof.blockMembership.leafValueHex !== proof.bundleRootHex) {
    return false;
  }
  if (!verifyMembershipProof(proof.evidenceRootHex, proof.blockMembership)) {
    return false;
  }
  return true;
}
