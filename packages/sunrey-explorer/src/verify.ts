import type { FinalizedChainReader } from './chain-reader.ts';
import type { ExplorerIndexStore } from './store.ts';
import { canonicalProjectionHash } from './canonical.ts';

export type VerifyReport = {
  readonly ok: boolean;
  readonly checkedBlocks: number;
  readonly checkedTransactions: number;
  readonly lastFinalizedHeight: number;
  readonly mismatches: readonly string[];
};

export function verifyIndex(store: ExplorerIndexStore, chain: FinalizedChainReader): VerifyReport {
  const projection = store.projection();
  const snapshot = chain.snapshot();
  const mismatches: string[] = [];

  if ((store.checkpoint()?.lastIndexedFinalizedHeight ?? 0) !== snapshot.finalizedHeight) {
    mismatches.push('last finalized height');
  }

  for (const block of snapshot.blocks) {
    const indexed = projection.blocks.find((row) => row.height === block.height);
    if (!indexed) {
      mismatches.push(`missing block ${block.height}`);
      continue;
    }
    if (indexed.blockId !== block.blockId) {
      mismatches.push(`block id ${block.height}`);
    }
    if (indexed.stateRoot !== block.stateRoot) {
      mismatches.push(`state root ${block.height}`);
    }
    if (indexed.transactionCount !== block.transactionCount) {
      mismatches.push(`tx count ${block.height}`);
    }
  }

  for (const asset of snapshot.assets) {
    const indexed = projection.assets.find((row) => row.assetId === asset.assetId);
    if (!indexed || indexed.issued !== asset.issued || indexed.circulating !== asset.circulating) {
      mismatches.push(`asset aggregate ${asset.assetId}`);
    }
  }

  return {
    ok: mismatches.length === 0,
    checkedBlocks: snapshot.blocks.length,
    checkedTransactions: snapshot.transactions.length,
    lastFinalizedHeight: snapshot.finalizedHeight,
    mismatches,
  };
}

export function projectionsEquivalent(left: ExplorerIndexStore, right: ExplorerIndexStore): boolean {
  return canonicalProjectionHash(left.projection()) === canonicalProjectionHash(right.projection());
}
