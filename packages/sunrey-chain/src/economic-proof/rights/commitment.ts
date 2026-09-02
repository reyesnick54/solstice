/**
 * Wave 3 — Rights commitment and root (economic proof plane).
 *
 * ACCESS-08 compatible rights/access/consent commitment deltas.
 * Distinct from ownership; raw consent documents stay off-chain.
 */

import { createHash } from 'node:crypto';

import { merkleRoot, hashToHex } from '../../blocks/commitments.ts';
import { commitCanonical } from '../../hash.ts';

export const RIGHTS_COMMITMENT_DOMAIN = 'SUNREY_RIGHTS_COMMITMENT_V1' as const;
export const RIGHTS_ROOT_DOMAIN = 'SUNREY_RIGHTS_ROOT_V1' as const;
const DOMAIN_RIGHTS_LEAF = 'sunrey.rights.leaf.v1' as const;
const DOMAIN_RIGHTS_MERKLE = 'sunrey.rights.merkle.v1' as const;

export type RightsCommitment = {
  readonly domain: string;
  readonly rightId: string;
  readonly payloadCommitment: string;
  readonly policyRef: string;
  readonly consentRef: string;
  readonly commitmentHash: string;
};

export type RightsRootInput = {
  readonly height: bigint;
  readonly commitments: readonly RightsCommitment[];
};

export type RightsRoot = {
  readonly height: bigint;
  readonly rootHash: string;
  readonly commitmentCount: number;
};

export function rightsCommitment(input: {
  readonly rightId: string;
  readonly payloadCommitment: string;
  readonly policyRef: string;
  readonly consentRef: string;
}): RightsCommitment {
  const body = Object.freeze({
    domain: RIGHTS_COMMITMENT_DOMAIN,
    rightId: input.rightId,
    payloadCommitment: input.payloadCommitment,
    policyRef: input.policyRef,
    consentRef: input.consentRef,
  });
  const commitmentHash = commitCanonical(body);
  return Object.freeze({ ...body, commitmentHash });
}

export function rightsLeafHash(commitment: RightsCommitment): Uint8Array {
  return createHash('sha256')
    .update(`${DOMAIN_RIGHTS_LEAF}|${commitment.commitmentHash}`)
    .digest();
}

export function rightsRoot(input: RightsRootInput): RightsRoot {
  const sorted = [...input.commitments].sort((left, right) => left.rightId.localeCompare(right.rightId));
  const leaves = sorted.map((commitment) => rightsLeafHash(commitment));
  const merkle =
    leaves.length === 0
      ? createHash('sha256').update(DOMAIN_RIGHTS_MERKLE).digest()
      : merkleRoot(DOMAIN_RIGHTS_MERKLE, leaves);

  const rootHash = commitCanonical({
    domain: RIGHTS_ROOT_DOMAIN,
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

export function verifyRightsCommitment(commitment: RightsCommitment): boolean {
  const recomputed = rightsCommitment({
    rightId: commitment.rightId,
    payloadCommitment: commitment.payloadCommitment,
    policyRef: commitment.policyRef,
    consentRef: commitment.consentRef,
  });
  return recomputed.commitmentHash === commitment.commitmentHash;
}
