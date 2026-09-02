export {
  EVIDENCE_COMMITMENT_SCHEMA_VERSION,
  EVIDENCE_COMMITMENT_DOMAIN,
  EVIDENCE_BUNDLE_DOMAIN,
  EVIDENCE_STATUS_DOMAIN,
  EVIDENCE_BUNDLE_ROLES,
  ECONOMIC_CLAIM_ECONOMIES,
  RESERVED_ROOT_BYTES,
  ZERO_ROOT_HEX,
} from './constants.ts';

export {
  createEvidenceCommitment,
  evidenceCommitmentMaterial,
  assertEvidenceCommitment,
} from './commitment.ts';
export type {
  EvidenceCommitment,
  EvidenceCommitmentInput,
  EvidenceVerificationMetadata,
} from './commitment.ts';

export {
  createEvidenceBundle,
  evidenceBundleMaterial,
  evidenceBundleRoot,
  evidenceBundleMerkleRoot,
  assertEvidenceBundle,
  bundleMerkleEntries,
} from './bundle.ts';
export type {
  EconomicClaimRef,
  EconomicClaimEconomy,
  EvidenceBundle,
  EvidenceBundleEntry,
  EvidenceBundleRole,
} from './bundle.ts';

export {
  computeEvidenceRoot,
  evidenceRootMaterial,
  blockEvidenceRootEntries,
  assertEvidenceRoot,
} from './root.ts';
export type { EvidenceRoot } from './root.ts';

export {
  domainHash,
  leafHash,
  merkleRootFromEntries,
  merkleRootFromLeafHashes,
  emptyMerkleRoot,
  buildMembershipProof,
  verifyMembershipProof,
  hexToBytes,
  bytesToHex,
  isZeroRootHex,
} from './merkle.ts';
export type { MerkleMembershipProof } from './merkle.ts';

export {
  buildEvidenceInclusionProof,
  verifyEvidenceInclusionProof,
} from './proof.ts';
export type { EvidenceInclusionProof } from './proof.ts';

export {
  BLOCK_COMMITMENT_SCHEMA_VERSION,
  commitmentRootsForBlock,
  rootsFromHex,
  rootsToHex,
  zeroRootBytes,
  assertReservedRootsUnset,
} from './block.ts';
export type { BlockCommitmentRoots } from './block.ts';

export {
  EVIDENCE_STATUS_KINDS,
  createEvidenceStatusRecord,
  latestStatusForCommitment,
} from './status.ts';
export type { EvidenceStatusKind, EvidenceStatusRecord } from './status.ts';

export {
  evidenceCommitmentFromVaultRecord,
  vaultChainTipHash,
} from './vault-bridge.ts';

export {
  scanForForbiddenBlockPayload,
  assertBlockPayloadPrivacySafe,
  isCommitmentOnlyPayload,
} from './privacy.ts';
