import { commitCanonical } from '../hash.ts';

import type { EvidenceBundle } from './bundle.ts';
import { EVIDENCE_BLOCK_SCOPE_DOMAIN } from './constants.ts';
import { emptyMerkleRoot, leafHash, merkleRootFromEntries } from './merkle.ts';

export type EvidenceRoot = {
  readonly rootHex: string;
  readonly bundleCount: number;
  readonly scopeHeight: bigint;
};

export function evidenceRootMaterial(input: {
  readonly scopeHeight: bigint;
  readonly bundles: readonly EvidenceBundle[];
}): string {
  const bundleRoots = [...input.bundles]
    .map((bundle) => bundle.bundleRoot)
    .sort((left, right) => left.localeCompare(right));
  return commitCanonical({
    domain: EVIDENCE_BLOCK_SCOPE_DOMAIN,
    scopeHeight: input.scopeHeight.toString(),
    bundleRoots,
  });
}

export function blockEvidenceRootEntries(
  bundles: readonly EvidenceBundle[],
): ReadonlyArray<{ readonly key: string; readonly valueHex: string }> {
  return [...bundles]
    .sort((left, right) => left.bundleRoot.localeCompare(right.bundleRoot))
    .map((bundle) => ({
      key: bundle.bundleId,
      valueHex: bundle.bundleRoot,
    }));
}

export function computeEvidenceRoot(input: {
  readonly scopeHeight: bigint;
  readonly bundles: readonly EvidenceBundle[];
}): EvidenceRoot {
  const entries = blockEvidenceRootEntries(input.bundles);
  const rootHex =
    entries.length === 0
      ? emptyMerkleRoot()
      : merkleRootFromEntries(entries);
  return Object.freeze({
    rootHex,
    bundleCount: entries.length,
    scopeHeight: input.scopeHeight,
  });
}

export function assertEvidenceRoot(root: EvidenceRoot, bundles: readonly EvidenceBundle[]): boolean {
  return computeEvidenceRoot({ scopeHeight: root.scopeHeight, bundles }).rootHex === root.rootHex;
}
