/**
 * Post-finalization native asset supply reconciliation.
 *
 * Fail closed when a finalized candidate violates supply invariants.
 */

import { reconcileNativeSupply, type MonetaryStateStore } from './monetary-state.ts';
import type { FinalizedBlock } from './types.ts';

export type ReconciliationReport = {
  readonly blockHash: string;
  readonly height: bigint;
  readonly ok: boolean;
  readonly assets: readonly {
    readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
    readonly ok: boolean;
    readonly detail: string;
  }[];
};

export function reconcileFinalizedBlock(input: {
  readonly block: FinalizedBlock;
  readonly state: MonetaryStateStore;
}): ReconciliationReport {
  const result = reconcileNativeSupply(input.state);
  return {
    blockHash: input.block.blockHash,
    height: input.block.header.height,
    ok: result.ok,
    assets: result.assets,
  };
}

export function assertFinalizedReconciliation(report: ReconciliationReport): void {
  if (!report.ok) {
    const detail = report.assets
      .filter((row) => !row.ok)
      .map((row) => `${row.assetId}:${row.detail}`)
      .join('; ');
    throw new Error(`finalized block ${report.blockHash} failed supply reconciliation: ${detail}`);
  }
}
