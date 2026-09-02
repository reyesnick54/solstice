import type { EvidenceBundle } from './bundle.ts';
import { RESERVED_ROOT_BYTES, ZERO_ROOT_HEX } from './constants.ts';
import { hexToBytes } from './merkle.ts';
import { computeEvidenceRoot } from './root.ts';

export const BLOCK_COMMITMENT_SCHEMA_VERSION = 2 as const;

export type BlockCommitmentRoots = {
  readonly evidenceRoot: Uint8Array;
  readonly rightsRoot: Uint8Array;
  readonly policyRoot: Uint8Array;
};

export function zeroRootBytes(): Uint8Array {
  return new Uint8Array(RESERVED_ROOT_BYTES);
}

export function rootsFromHex(input: {
  readonly evidenceRootHex: string;
  readonly rightsRootHex?: string;
  readonly policyRootHex?: string;
}): BlockCommitmentRoots {
  return Object.freeze({
    evidenceRoot: new Uint8Array(hexToBytes(input.evidenceRootHex)),
    rightsRoot: new Uint8Array(hexToBytes(input.rightsRootHex ?? ZERO_ROOT_HEX)),
    policyRoot: new Uint8Array(hexToBytes(input.policyRootHex ?? ZERO_ROOT_HEX)),
  });
}

export function commitmentRootsForBlock(input: {
  readonly height: bigint;
  readonly bundles: readonly EvidenceBundle[];
}): BlockCommitmentRoots {
  const evidence = computeEvidenceRoot({
    scopeHeight: input.height,
    bundles: input.bundles,
  });
  return rootsFromHex({
    evidenceRootHex: evidence.rootHex,
    rightsRootHex: ZERO_ROOT_HEX,
    policyRootHex: ZERO_ROOT_HEX,
  });
}

export function rootsToHex(roots: BlockCommitmentRoots): {
  readonly evidenceRootHex: string;
  readonly rightsRootHex: string;
  readonly policyRootHex: string;
} {
  return Object.freeze({
    evidenceRootHex: Buffer.from(roots.evidenceRoot).toString('hex'),
    rightsRootHex: Buffer.from(roots.rightsRoot).toString('hex'),
    policyRootHex: Buffer.from(roots.policyRoot).toString('hex'),
  });
}

export function assertReservedRootsUnset(roots: BlockCommitmentRoots): boolean {
  const zero = zeroRootBytes();
  return (
    Buffer.from(roots.rightsRoot).equals(zero) &&
    Buffer.from(roots.policyRoot).equals(zero)
  );
}
