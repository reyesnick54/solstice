/**
 * Pending-transaction lifecycle using canonical transaction identity.
 */

import type { WalletPendingTransaction, PendingTransactionState } from './types.ts';

const TERMINAL: readonly PendingTransactionState[] = ['FINALIZED', 'REJECTED', 'EXPIRED'];

export class PendingTransactionBook {
  private readonly records = new Map<string, WalletPendingTransaction>();

  upsert(record: WalletPendingTransaction): WalletPendingTransaction {
    const frozen = Object.freeze({ ...record, mempoolAcceptanceIsFinality: false as const });
    this.records.set(record.transactionId, frozen);
    return frozen;
  }

  get(transactionId: string): WalletPendingTransaction | undefined {
    return this.records.get(transactionId);
  }

  list(walletId: string): readonly WalletPendingTransaction[] {
    return [...this.records.values()].filter((record) => record.walletId === walletId);
  }

  transition(transactionId: string, state: PendingTransactionState): WalletPendingTransaction | undefined {
    const current = this.records.get(transactionId);
    if (!current) {
      return undefined;
    }
    if (TERMINAL.includes(current.state) && state !== current.state) {
      return current;
    }
    return this.upsert({
      ...current,
      state,
      uiFinalized: state === 'FINALIZED',
    });
  }

  byClientId(clientTxId: string): WalletPendingTransaction | undefined {
    return [...this.records.values()].find((record) => record.clientTxId === clientTxId);
  }
}
