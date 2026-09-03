// @ts-nocheck
/**
 * Wave 3 — five-root sovereign block commitment integration.
 *
 * Transaction Root, Monetary State Root, Evidence Root, Rights Root, Policy Root.
 */

import { hashFromHex, transactionRoot, stateRoot } from '../../blocks/commitments.ts';
import { RESERVED_EXTENSION_COMMITMENT_KEYS } from '../../blocks/types.ts';
import { evidenceRoot, type EvidenceCommitment } from '../evidence/commitment.ts';
import { rightsRoot, type RightsCommitment } from '../rights/commitment.ts';
import { policyRoot, type PolicyCommitment } from '../policy/root.ts';
import { commitCanonical } from '../../hash.ts';

export const FIVE_ROOT_DOMAIN = 'SUNREY_SOVEREIGN_FIVE_ROOT_V1' as const;

export type FiveRootInput = {
  readonly height: bigint;
  readonly transactionIds: readonly Uint8Array[];
  readonly monetaryStateEntries: ReadonlyMap<string, Uint8Array> | readonly [string, Uint8Array][];
  readonly evidenceCommitments: readonly EvidenceCommitment[];
  readonly rightsCommitments: readonly RightsCommitment[];
  readonly policyCommitments: readonly PolicyCommitment[];
};

export type FiveRootCommitment = {
  readonly height: bigint;
  readonly transactionRoot: string;
  readonly monetaryStateRoot: string;
  readonly evidenceRoot: string;
  readonly rightsRoot: string;
  readonly policyRoot: string;
  readonly compositeRoot: string;
};

export function fiveRootCommitment(input: FiveRootInput): FiveRootCommitment {
  const txRoot = transactionRoot(input.transactionIds);
  const monetaryRoot = stateRoot(input.monetaryStateEntries);
  const evidence = evidenceRoot({ height: input.height, commitments: input.evidenceCommitments });
  const rights = rightsRoot({ height: input.height, commitments: input.rightsCommitments });
  const policy = policyRoot({ height: input.height, activeCommitments: input.policyCommitments });

  const compositeRoot = commitCanonical({
    domain: FIVE_ROOT_DOMAIN,
    height: input.height.toString(),
    transactionRoot: Buffer.from(txRoot).toString('hex'),
    monetaryStateRoot: Buffer.from(monetaryRoot).toString('hex'),
    evidenceRoot: evidence.rootHash,
    rightsRoot: rights.rootHash,
    policyRoot: policy.rootHash,
  });

  return Object.freeze({
    height: input.height,
    transactionRoot: Buffer.from(txRoot).toString('hex'),
    monetaryStateRoot: Buffer.from(monetaryRoot).toString('hex'),
    evidenceRoot: evidence.rootHash,
    rightsRoot: rights.rootHash,
    policyRoot: policy.rootHash,
    compositeRoot,
  });
}

/** Map economic-proof root hashes into Wave 2 block extension commitment slots. */
export function extensionCommitmentsFromFiveRoot(
  commitment: FiveRootCommitment,
): Readonly<Record<string, Uint8Array>> {
  return Object.freeze({
    [RESERVED_EXTENSION_COMMITMENT_KEYS[0]]: hashFromHex(commitment.evidenceRoot),
    [RESERVED_EXTENSION_COMMITMENT_KEYS[1]]: hashFromHex(commitment.rightsRoot),
    [RESERVED_EXTENSION_COMMITMENT_KEYS[2]]: hashFromHex(commitment.policyRoot),
  });
}

export function verifyFiveRootDeterminism(input: FiveRootInput, expected: FiveRootCommitment): boolean {
  const recomputed = fiveRootCommitment(input);
  return (
    recomputed.transactionRoot === expected.transactionRoot &&
    recomputed.monetaryStateRoot === expected.monetaryStateRoot &&
    recomputed.evidenceRoot === expected.evidenceRoot &&
    recomputed.rightsRoot === expected.rightsRoot &&
    recomputed.policyRoot === expected.policyRoot &&
    recomputed.compositeRoot === expected.compositeRoot
  );
}
