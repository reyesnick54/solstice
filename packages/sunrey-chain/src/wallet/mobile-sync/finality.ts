/**
 * Mobile finality tracker.
 *
 * SunRey uses deterministic BFT finality. Mempool acceptance is never
 * presented as blockchain finality. There is no confirmation-count UI.
 */

import type { FinalityState } from '../../public-data-plane/types.ts';
import { reject, type MobileSyncRejection, type PendingTransactionState } from './types.ts';

export type WalletUiFinality = {
  readonly transactionId: string;
  readonly chainState: FinalityState;
  readonly pendingState: PendingTransactionState;
  readonly finalized: boolean;
  readonly displayState: 'PENDING' | 'FINALIZED' | 'REJECTED' | 'UNKNOWN';
  readonly mempoolAcceptanceIsFinality: false;
  readonly confirmationCountUi: false;
  readonly source: 'CANONICAL_CHAIN';
};

export class WalletFinalityTracker {
  project(input: {
    readonly transactionId: string;
    readonly chainState: FinalityState;
    readonly pendingState: PendingTransactionState;
  }): WalletUiFinality {
    const finalized = input.chainState === 'FINALIZED' && input.pendingState === 'FINALIZED';
    let displayState: WalletUiFinality['displayState'] = 'PENDING';
    if (finalized) {
      displayState = 'FINALIZED';
    } else if (input.chainState === 'REJECTED' || input.pendingState === 'REJECTED') {
      displayState = 'REJECTED';
    } else if (input.chainState === 'UNKNOWN' && input.pendingState === 'SUBMISSION_UNKNOWN') {
      displayState = 'UNKNOWN';
    }
    return Object.freeze({
      transactionId: input.transactionId,
      chainState: input.chainState,
      pendingState: input.pendingState,
      finalized,
      displayState,
      mempoolAcceptanceIsFinality: false,
      confirmationCountUi: false,
      source: 'CANONICAL_CHAIN',
    });
  }

  refuseMempoolAsFinality(pendingState: PendingTransactionState): MobileSyncRejection | null {
    if (pendingState === 'MEMPOOL_ACCEPTED' || pendingState === 'SUBMITTED') {
      return reject('MEMPOOL_IS_NOT_FINALITY', 'mempool acceptance is not blockchain finality');
    }
    return null;
  }
}
