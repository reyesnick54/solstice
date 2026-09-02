/**
 * Wave 3 — Evidence commitment and root (economic proof plane).
 *
 * Commits to batch hashes of Evidence Vault seals and claim fingerprints.
 * Distinct from validator equivocation evidence in node consensus.
 */

import { createHash } from 'node:crypto';

import { merkleRoot, hashToHex } from '../../blocks/commitments.ts';
import { commitCanonical } from '../../hash.ts';

export const EVIDENCE_COMMITMENT_DOMAIN = 'SUNREY_EVIDENCE_COMMITMENT_V1' as const;
export const EVIDENCE_ROOT_DOMAIN = 'SUNREY_EVIDENCE_ROOT_V1' as const;
const DOMAIN_EVIDENCE_LEAF = 'sunrey.evidence.leaf.v1' as const;
const DOMAIN_EVIDENCE_MERKLE = 'sunrey.evidence.merkle.v1' as const;

export type EvidenceCommitment = {
  readonly domain: string;
  readonly sealHash: string;
  readonly claimFingerprint: string | null;
  readonly sequence: bigint;
  readonly commitmentHash: string;
};

export type EvidenceRootInput = {
  readonly height: bigint;
  readonly commitments: readonly EvidenceCommitment[];
};

export type EvidenceRoot = {
  readonly height: bigint;
  readonly rootHash: string;
  readonly commitmentCount: number;
};

export function evidenceCommitment(input: {
  readonly sealHash: string;
  readonly claimFingerprint?: string | null;
  readonly sequence: bigint;
}): EvidenceCommitment {
  const body = Object.freeze({
    domain: EVIDENCE_COMMITMENT_DOMAIN,
    sealHash: input.sealHash,
    claimFingerprint: input.claimFingerprint ?? null,
    sequence: input.sequence.toString(),
  });
  const commitmentHash = commitCanonical(body);
  return Object.freeze({ ...body, sequence: input.sequence, commitmentHash });
}

export function evidenceLeafHash(commitment: EvidenceCommitment): Uint8Array {
  return createHash('sha256')
    .update(`${DOMAIN_EVIDENCE_LEAF}|${commitment.commitmentHash}`)
    .digest();
}

export function evidenceRoot(input: EvidenceRootInput): EvidenceRoot {
  const sorted = [...input.commitments].sort((left, right) => {
    const seq = left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0;
    if (seq !== 0) {
      return seq;
    }
    return left.commitmentHash.localeCompare(right.commitmentHash);
  });
  const leaves = sorted.map((commitment) => evidenceLeafHash(commitment));
  const merkle =
    leaves.length === 0
      ? createHash('sha256').update(DOMAIN_EVIDENCE_MERKLE).digest()
      : merkleRoot(DOMAIN_EVIDENCE_MERKLE, leaves);

  const rootHash = commitCanonical({
    domain: EVIDENCE_ROOT_DOMAIN,
    height: input.height.toString(),
    merkleRoot: hashToHex(merkle),
    commitmentCount: sorted.length,
  });

  return Object.freeze({
    height: input.height,
    rootHash,
    commitmentCount: sorted.length,
  });
}

export function verifyEvidenceCommitment(commitment: EvidenceCommitment): boolean {
  const recomputed = evidenceCommitment({
    sealHash: commitment.sealHash,
    claimFingerprint: commitment.claimFingerprint,
    sequence: commitment.sequence,
  });
  return recomputed.commitmentHash === commitment.commitmentHash;
}
