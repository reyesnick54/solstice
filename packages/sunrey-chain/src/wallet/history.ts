/**
 * Rebuildable wallet transaction projection.
 *
 * Canonical truth remains blockchain history. This projection is derived
 * and can be reconstructed from finalized chain records.
 */

import type { TxProjectionState, WalletTransactionRecord } from './types.ts';

export class WalletHistory {
  private readonly records = new Map<string, WalletTransactionRecord>();

  upsert(record: WalletTransactionRecord): void {
    this.records.set(record.txId, Object.freeze({ ...record }));
  }

  mark(txId: string, state: TxProjectionState, extras: Partial<WalletTransactionRecord> = {}): void {
    const current = this.records.get(txId);
    if (!current) {
      return;
    }
    this.records.set(txId, Object.freeze({ ...current, ...extras, state }));
  }

  list(accountId?: string): readonly WalletTransactionRecord[] {
    const rows = [...this.records.values()].sort((left, right) => left.clientTxId.localeCompare(right.clientTxId));
    return accountId ? rows.filter((row) => row.accountId === accountId) : rows;
  }

  rebuildFromChain(finalized: readonly WalletTransactionRecord[]): readonly WalletTransactionRecord[] {
    for (const record of finalized) {
      this.upsert({ ...record, state: 'FINALIZED' });
    }
    return this.list();
  }

  get(txId: string): WalletTransactionRecord | null {
    return this.records.get(txId) ?? null;
  }
}
