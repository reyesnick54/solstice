/**
 * Wave 2 — read-only chain / database reconciliation.
 *
 * Direction of authority:
 *   BLOCKCHAIN CANONICAL STATE → secondary reconciliation
 *
 * Secondary systems are never allowed to rewrite blockchain state.
 */

import { opsErr, opsOk } from '../ops/types.ts';
import type { ReconciliationReport, ReconciliationRow, ReconciliationTarget, SyncResult } from './types.ts';

export type SecondaryBalance = {
  readonly target: ReconciliationTarget;
  readonly accountOrKey: string;
  readonly assetId: string;
  readonly quantity: bigint;
};

export type ChainBalance = {
  readonly accountOrKey: string;
  readonly assetId: string;
  readonly quantity: bigint;
};

export function reconcileSecondaryToChain(input: {
  readonly chainBalances: readonly ChainBalance[];
  readonly secondaryBalances: readonly SecondaryBalance[];
}): SyncResult<ReconciliationReport> {
  const chainIndex = new Map(
    input.chainBalances.map((row) => [`${row.assetId}:${row.accountOrKey}`, row.quantity]),
  );
  const mismatches: ReconciliationRow[] = [];
  const notes: string[] = [
    'Blockchain canonical state is authoritative.',
    'Secondary mismatches require projection rebuild or operator investigation.',
    'Never post ledger journals to match a secondary projection.',
  ];
  for (const secondary of input.secondaryBalances) {
    const key = `${secondary.assetId}:${secondary.accountOrKey}`;
    const chainQuantity = chainIndex.get(key) ?? 0n;
    if (chainQuantity !== secondary.quantity) {
      mismatches.push({
        target: secondary.target,
        accountOrKey: secondary.accountOrKey,
        assetId: secondary.assetId,
        chainQuantity,
        secondaryQuantity: secondary.quantity,
      });
    }
  }
  return opsOk({
    ok: mismatches.length === 0,
    authority: 'BLOCKCHAIN_CANONICAL',
    mismatches: Object.freeze(mismatches),
    notes: Object.freeze(notes),
  });
}

export function rejectDatabaseRewrite(): SyncResult<never> {
  return opsErr('SNAPSHOT_TAMPER', 'database balance cannot rewrite blockchain state');
}
