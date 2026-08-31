/**
 * Access Wave 4 transaction state machine — product-facing lifecycle.
 * Orchestration only; financial authority remains in canonical owners.
 */

import type { AccessCategory } from '../taxonomy.ts';
import type { AccessProductTransactionStatus, AccessUserActionType } from './taxonomy.ts';

export const ACCESS_TRANSACTION_TRANSITIONS: Readonly<
  Record<AccessProductTransactionStatus, readonly AccessProductTransactionStatus[]>
> = Object.freeze({
  DRAFT: Object.freeze(['QUOTED', 'FAILED']),
  QUOTED: Object.freeze(['QUOTE_EXPIRED', 'PRICE_CHANGED', 'CHECKOUT_STARTED', 'FAILED']),
  QUOTE_EXPIRED: Object.freeze(['QUOTED']),
  PRICE_CHANGED: Object.freeze(['CHECKOUT_STARTED', 'QUOTED', 'FAILED']),
  CHECKOUT_STARTED: Object.freeze(['PROCESSING_CONFIRMATION', 'BOOKING_CONFIRMED', 'FAILED']),
  PROCESSING_CONFIRMATION: Object.freeze(['BOOKING_CONFIRMED', 'RECONCILIATION_REQUIRED', 'FAILED']),
  RECONCILIATION_REQUIRED: Object.freeze(['BOOKING_CONFIRMED', 'FAILED']),
  BOOKING_CONFIRMED: Object.freeze(['BOOKED', 'CANCELLED']),
  BOOKED: Object.freeze(['FULFILLED', 'CANCELLED', 'REFUND_PENDING']),
  FULFILLED: Object.freeze(['SETTLED', 'REFUND_PENDING']),
  SETTLED: Object.freeze(['REFUND_PENDING']),
  CANCELLED: Object.freeze(['REFUND_PENDING', 'REFUNDED']),
  REFUND_PENDING: Object.freeze(['PARTIAL_REFUND', 'REFUNDED']),
  PARTIAL_REFUND: Object.freeze(['REFUNDED']),
  REFUNDED: Object.freeze([]),
  FAILED: Object.freeze([]),
});

export type AccessProductTransaction = {
  readonly transactionId: string;
  readonly userId: string;
  readonly category: AccessCategory;
  readonly status: AccessProductTransactionStatus;
  readonly productStatusLabel: string;
  readonly quoteId: string | null;
  readonly reservationId: string | null;
  readonly redemptionId: string | null;
  readonly providerId: string | null;
  readonly providerDisplayName: string | null;
  readonly serviceName: string;
  readonly location: string | null;
  readonly currency: string;
  readonly providerTotalMinorUnits: string;
  readonly accessCoverageMinorUnits: string;
  readonly userContributionMinorUnits: string;
  readonly depositMinorUnits: string | null;
  readonly unitsUsed: string;
  readonly unitLabel: string;
  readonly entitlementBefore: string | null;
  readonly entitlementAfter: string | null;
  readonly confirmationReference: string | null;
  readonly quoteExpiresAt: string | null;
  readonly serviceDate: string | null;
  readonly cancellationDeadline: string | null;
  readonly requiredActions: readonly AccessUserActionType[];
  readonly dataState: 'SIMULATED' | 'LIVE';
  readonly fundingAvailable: boolean;
  readonly purchaseBlocked: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly stateTransitionId: string;
};

export type AccessPriceChangeView = {
  readonly schema: 'sunrey.consumer.access.price-changed.v1';
  readonly transactionId: string;
  readonly previousProviderTotal: string;
  readonly newProviderTotal: string;
  readonly previousAccessCoverage: string;
  readonly newAccessCoverage: string;
  readonly previousUserContribution: string;
  readonly newUserContribution: string;
  readonly currency: string;
  readonly requiresConfirmation: boolean;
  readonly requiredAction: 'CONFIRM_PRICE_CHANGE';
};

export type AccessQuoteExpiredView = {
  readonly schema: 'sunrey.consumer.access.quote-expired.v1';
  readonly transactionId: string;
  readonly quoteId: string;
  readonly expiredAt: string;
  readonly requiredAction: 'REQUOTE';
};

export class AccessTransactionStateMachine {
  canTransition(from: AccessProductTransactionStatus, to: AccessProductTransactionStatus): boolean {
    return ACCESS_TRANSACTION_TRANSITIONS[from].includes(to);
  }

  transition(
    transaction: AccessProductTransaction,
    to: AccessProductTransactionStatus,
    updatedAt: string,
  ): AccessProductTransaction | null {
    if (!this.canTransition(transaction.status, to)) {
      return null;
    }
    return Object.freeze({
      ...transaction,
      status: to,
      productStatusLabel: productStatusLabelFor(to),
      updatedAt,
      stateTransitionId: `st_${transaction.transactionId}_${to}_${updatedAt}`,
      purchaseBlocked: ['PROCESSING_CONFIRMATION', 'RECONCILIATION_REQUIRED'].includes(to),
      requiredActions: requiredActionsFor(to, transaction),
    });
  }
}

function productStatusLabelFor(status: AccessProductTransactionStatus): string {
  const labels: Record<AccessProductTransactionStatus, string> = {
    DRAFT: 'Draft',
    QUOTED: 'Quoted',
    QUOTE_EXPIRED: 'Quote expired',
    PRICE_CHANGED: 'Price changed',
    CHECKOUT_STARTED: 'Checkout started',
    PROCESSING_CONFIRMATION: 'Confirming booking',
    BOOKING_CONFIRMED: 'Booking confirmed',
    BOOKED: 'Booked',
    FULFILLED: 'Completed',
    SETTLED: 'Settled',
    CANCELLED: 'Cancelled',
    REFUND_PENDING: 'Refund pending',
    PARTIAL_REFUND: 'Partial refund',
    REFUNDED: 'Refunded',
    FAILED: 'Transaction failed',
    RECONCILIATION_REQUIRED: 'Confirming booking',
  };
  return labels[status];
}

function requiredActionsFor(
  status: AccessProductTransactionStatus,
  transaction: AccessProductTransaction,
): readonly AccessUserActionType[] {
  switch (status) {
    case 'PRICE_CHANGED':
      return Object.freeze(['CONFIRM_PRICE_CHANGE']);
    case 'QUOTE_EXPIRED':
      return Object.freeze(['REQUOTE']);
    case 'FAILED':
      return Object.freeze(['CONTACT_SUPPORT']);
    default:
      return transaction.requiredActions;
  }
}

export function newStateTransitionId(transactionId: string, status: string, at: string): string {
  return `st_${transactionId}_${status}_${at}`;
}
