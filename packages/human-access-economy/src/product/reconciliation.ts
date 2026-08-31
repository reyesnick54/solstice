/**
 * Access Wave 4 reconciliation service — provider uncertainty handling.
 */

import type { AccessProductTransaction } from './transactions.ts';
import { AccessTransactionStateMachine } from './transactions.ts';

export type ReconciliationOutcome =
  | { readonly kind: 'CONFIRMED'; readonly confirmationReference: string }
  | { readonly kind: 'NOT_FOUND'; readonly message: string }
  | { readonly kind: 'STILL_PENDING' };

export class AccessReconciliationService {
  private readonly stateMachine = new AccessTransactionStateMachine();
  private readonly pending = new Map<string, { readonly startedAt: string; readonly attempts: number }>();

  markPending(transactionId: string, at: string): void {
    const existing = this.pending.get(transactionId);
    this.pending.set(
      transactionId,
      Object.freeze({
        startedAt: existing?.startedAt ?? at,
        attempts: (existing?.attempts ?? 0) + 1,
      }),
    );
  }

  reconcile(
    transaction: AccessProductTransaction,
    outcome: ReconciliationOutcome,
    at: string,
  ): AccessProductTransaction | null {
    if (
      transaction.status !== 'PROCESSING_CONFIRMATION' &&
      transaction.status !== 'RECONCILIATION_REQUIRED'
    ) {
      return null;
    }
    if (outcome.kind === 'STILL_PENDING') {
      return this.stateMachine.transition(transaction, 'RECONCILIATION_REQUIRED', at);
    }
    if (outcome.kind === 'NOT_FOUND') {
      this.pending.delete(transaction.transactionId);
      return this.stateMachine.transition(transaction, 'FAILED', at);
    }
    this.pending.delete(transaction.transactionId);
    const confirmed = this.stateMachine.transition(transaction, 'BOOKING_CONFIRMED', at);
    if (!confirmed) {
      return null;
    }
    return Object.freeze({
      ...confirmed,
      confirmationReference: outcome.confirmationReference,
    });
  }

  isPending(transactionId: string): boolean {
    return this.pending.has(transactionId);
  }

  getAttempts(transactionId: string): number {
    return this.pending.get(transactionId)?.attempts ?? 0;
  }
}
