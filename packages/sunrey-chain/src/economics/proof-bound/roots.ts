/**
 * Wave 3 — Evidence, Rights, and Policy roots with membership proofs.
 */

import { commitCanonical } from '../../hash.ts';

export type MerkleProof = {
  readonly leafHash: string;
  readonly siblings: readonly string[];
  readonly leafIndex: number;
};

function hashPair(left: string, right: string): string {
  return commitCanonical({ merkle: 'v1', left, right });
}

export function merkleRoot(leaves: readonly string[]): string {
  if (leaves.length === 0) {
    return commitCanonical({ merkle: 'v1', empty: true });
  }
  let level = [...leaves];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0]!;
}

export function merkleProof(leaves: readonly string[], leafIndex: number): MerkleProof | null {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    return null;
  }
  const siblings: string[] = [];
  let level = [...leaves];
  let index = leafIndex;
  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    siblings.push(level[siblingIndex] ?? level[index]!);
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    level = next;
    index = Math.floor(index / 2);
  }
  return Object.freeze({
    leafHash: leaves[leafIndex]!,
    siblings: Object.freeze(siblings),
    leafIndex,
  });
}

export function verifyMerkleMembership(root: string, proof: MerkleProof): boolean {
  let hash = proof.leafHash;
  let index = proof.leafIndex;
  for (const sibling of proof.siblings) {
    hash = index % 2 === 0 ? hashPair(hash, sibling) : hashPair(sibling, hash);
    index = Math.floor(index / 2);
  }
  return hash === root;
}

export type CommitmentRootSet = {
  readonly evidenceRoot: string;
  readonly rightsRoot: string;
  readonly policyRoot: string;
  readonly evidenceLeaves: readonly string[];
  readonly rightsLeaves: readonly string[];
  readonly policyLeaves: readonly string[];
};

export function computeCommitmentRoots(input: {
  readonly evidenceCommitmentHashes: readonly string[];
  readonly rightsCommitmentHashes: readonly string[];
  readonly policyCommitmentHashes: readonly string[];
}): CommitmentRootSet {
  const evidenceLeaves = Object.freeze([...input.evidenceCommitmentHashes].sort());
  const rightsLeaves = Object.freeze([...input.rightsCommitmentHashes].sort());
  const policyLeaves = Object.freeze([...input.policyCommitmentHashes].sort());
  return Object.freeze({
    evidenceRoot: merkleRoot(evidenceLeaves),
    rightsRoot: merkleRoot(rightsLeaves),
    policyRoot: merkleRoot(policyLeaves),
    evidenceLeaves,
    rightsLeaves,
    policyLeaves,
  });
}

export function evidenceMembershipProof(
  roots: CommitmentRootSet,
  commitmentHash: string,
): MerkleProof | null {
  const index = roots.evidenceLeaves.indexOf(commitmentHash);
  if (index < 0) {
    return null;
  }
  return merkleProof(roots.evidenceLeaves, index);
}

export function rightsMembershipProof(
  roots: CommitmentRootSet,
  commitmentHash: string,
): MerkleProof | null {
  const index = roots.rightsLeaves.indexOf(commitmentHash);
  if (index < 0) {
    return null;
  }
  return merkleProof(roots.rightsLeaves, index);
}

export function policyMembershipProof(
  roots: CommitmentRootSet,
  commitmentHash: string,
): MerkleProof | null {
  const index = roots.policyLeaves.indexOf(commitmentHash);
  if (index < 0) {
    return null;
  }
  return merkleProof(roots.policyLeaves, index);
}

export function monetaryStateCommitment(input: {
  readonly assetId: string;
  readonly supplyTotal: string;
  readonly blockHeight: number;
  readonly transactionId: string;
}): string {
  return commitCanonical({
    domain: 'sunrey.economic-proof.monetary-state.v1',
    assetId: input.assetId,
    supplyTotal: input.supplyTotal,
    blockHeight: input.blockHeight,
    transactionId: input.transactionId,
  });
}
