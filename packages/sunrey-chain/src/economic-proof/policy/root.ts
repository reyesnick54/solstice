/**
 * Wave 3 — deterministic PolicyRoot over active policy commitments.
 */

import { createHash } from 'node:crypto';

import { merkleRoot, hashFromHex, hashToHex } from '../../blocks/commitments.ts';
import { POLICY_ROOT_DOMAIN } from './taxonomy.ts';
import { verifyPolicyCommitment } from './commitment.ts';
import type { PolicyCommitment, PolicyRoot, PolicyRootInput } from './types.ts';

export type { PolicyCommitment } from './types.ts';

const DOMAIN_POLICY_LEAF = 'sunrey.policy.leaf.v1' as const;
const DOMAIN_POLICY_ROOT = 'sunrey.policy.root.v1' as const;

export function policyLeafHash(commitment: PolicyCommitment): Uint8Array {
  if (!verifyPolicyCommitment(commitment)) {
    throw new Error('invalid policy commitment');
  }
  const payload = Buffer.from(
    stable({
      domain: DOMAIN_POLICY_LEAF,
      commitmentHash: commitment.commitmentHash,
      policyId: commitment.policyId,
      version: commitment.version,
      contentHash: commitment.contentHash,
    }),
    'utf8',
  );
  return createHash('sha256').update(`${DOMAIN_POLICY_LEAF}|`).update(payload).digest();
}

export function policyRoot(input: PolicyRootInput): PolicyRoot {
  const sorted = [...input.activeCommitments].sort((left, right) => {
    const idCmp = left.policyId.localeCompare(right.policyId);
    if (idCmp !== 0) {
      return idCmp;
    }
    return left.version - right.version;
  });

  for (const commitment of sorted) {
    if (!verifyPolicyCommitment(commitment)) {
      throw new Error(`invalid policy commitment: ${commitment.policyId} v${String(commitment.version)}`);
    }
  }

  const leaves = sorted.map((commitment) => policyLeafHash(commitment));
  const merkle = leaves.length === 0 ? createHash('sha256').update(DOMAIN_POLICY_ROOT).digest() : merkleRoot(DOMAIN_POLICY_ROOT, leaves);

  const rootHash = createHash('sha256')
    .update(
      stable({
        domain: POLICY_ROOT_DOMAIN,
        height: input.height.toString(),
        merkleRoot: hashToHex(merkle),
        commitmentCount: sorted.length,
      }),
    )
    .digest('hex');

  return Object.freeze({
    height: input.height,
    rootHash,
    commitmentCount: sorted.length,
  });
}

export function policyRootMerkleHex(input: PolicyRootInput): string {
  const sorted = [...input.activeCommitments].sort((left, right) => {
    const idCmp = left.policyId.localeCompare(right.policyId);
    if (idCmp !== 0) {
      return idCmp;
    }
    return left.version - right.version;
  });
  const leaves = sorted.map((commitment) => policyLeafHash(commitment));
  if (leaves.length === 0) {
    return hashToHex(createHash('sha256').update(DOMAIN_POLICY_ROOT).digest());
  }
  return hashToHex(merkleRoot(DOMAIN_POLICY_ROOT, leaves));
}

export function emptyPolicyRoot(height: bigint): PolicyRoot {
  return policyRoot({ height, activeCommitments: [] });
}

export function verifyPolicyRoot(root: PolicyRoot, input: PolicyRootInput): boolean {
  const recomputed = policyRoot(input);
  return recomputed.rootHash === root.rootHash && recomputed.commitmentCount === root.commitmentCount;
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
