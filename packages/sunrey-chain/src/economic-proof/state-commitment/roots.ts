import { commitCanonical } from '../../hash.ts';
import { merkleRoot } from '../merkle.ts';

export const BLOCK_STATE_COMMITMENT_SCHEMA_VERSION = 1 as const;

export const BLOCK_STATE_ROOT_DOMAINS = Object.freeze({
  TRANSACTION: 'sunrey.block.transaction-root.v1',
  MONETARY_STATE: 'sunrey.block.monetary-state-root.v1',
  EVIDENCE: 'sunrey.block.evidence-root.v1',
  RIGHTS: 'sunrey.block.rights-root.v1',
  POLICY: 'sunrey.block.policy-root.v1',
  APP_HASH: 'sunrey.block.app-hash.v1',
});

export type BlockStateRootsV1 = {
  readonly schemaVersion: typeof BLOCK_STATE_COMMITMENT_SCHEMA_VERSION;
  readonly transactionRoot: string;
  readonly monetaryStateRoot: string;
  readonly evidenceRoot: string;
  readonly rightsRoot: string;
  readonly policyRoot: string | null;
};

export type BlockStateCommitmentInput = {
  readonly transactionLeaves: readonly string[];
  readonly monetaryStateLeaves: readonly string[];
  readonly evidenceLeaves: readonly string[];
  readonly rightsLeaves: readonly string[];
  readonly policyLeaves?: readonly string[];
};

export function transactionRoot(leaves: readonly string[]): string {
  return merkleRoot(BLOCK_STATE_ROOT_DOMAINS.TRANSACTION, [...leaves].sort());
}

export function monetaryStateRoot(leaves: readonly string[]): string {
  return merkleRoot(BLOCK_STATE_ROOT_DOMAINS.MONETARY_STATE, [...leaves].sort());
}

export function evidenceRoot(leaves: readonly string[]): string {
  return merkleRoot(BLOCK_STATE_ROOT_DOMAINS.EVIDENCE, [...leaves].sort());
}

export function policyRoot(leaves: readonly string[]): string | null {
  if (leaves.length === 0) {
    return null;
  }
  return merkleRoot(BLOCK_STATE_ROOT_DOMAINS.POLICY, [...leaves].sort());
}

export function computeBlockStateRoots(input: BlockStateCommitmentInput): BlockStateRootsV1 {
  return Object.freeze({
    schemaVersion: BLOCK_STATE_COMMITMENT_SCHEMA_VERSION,
    transactionRoot: transactionRoot(input.transactionLeaves),
    monetaryStateRoot: monetaryStateRoot(input.monetaryStateLeaves),
    evidenceRoot: evidenceRoot(input.evidenceLeaves),
    rightsRoot: merkleRoot(BLOCK_STATE_ROOT_DOMAINS.RIGHTS, [...input.rightsLeaves].sort()),
    policyRoot: policyRoot(input.policyLeaves ?? []),
  });
}

export function computeAppHash(roots: BlockStateRootsV1): string {
  return commitCanonical({
    domain: BLOCK_STATE_ROOT_DOMAINS.APP_HASH,
    schemaVersion: roots.schemaVersion,
    transactionRoot: roots.transactionRoot,
    monetaryStateRoot: roots.monetaryStateRoot,
    evidenceRoot: roots.evidenceRoot,
    rightsRoot: roots.rightsRoot,
    policyRoot: roots.policyRoot,
  });
}

export function blockStateChangedWhenRightsChange(
  previous: BlockStateRootsV1,
  next: BlockStateRootsV1,
): boolean {
  return (
    previous.rightsRoot !== next.rightsRoot ||
    computeAppHash(previous) !== computeAppHash(next)
  );
}
