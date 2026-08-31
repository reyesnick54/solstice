/**
 * ACCESS Wave 3 / Prompt 37 — authoritative Access transaction state machine.
 */

import type { AccessDomainTransactionStatus } from '../domain/taxonomy.ts';

export const ACCESS_TRANSACTION_TRANSITIONS: Readonly<
  Record<AccessDomainTransactionStatus, readonly AccessDomainTransactionStatus[]>
> = Object.freeze({
  CREATED: Object.freeze(['DISCOVERED', 'QUOTED', 'FAILED'] as const),
  DISCOVERED: Object.freeze(['QUOTED', 'FAILED'] as const),
  QUOTED: Object.freeze(['REQUOTE_REQUIRED', 'ELIGIBLE', 'ELIGIBILITY_APPROVED', 'FAILED', 'CANCELLED'] as const),
  REQUOTE_REQUIRED: Object.freeze(['QUOTED', 'FAILED', 'CANCELLED'] as const),
  ELIGIBLE: Object.freeze(['ELIGIBILITY_APPROVED', 'ENTITLEMENT_RESERVED', 'FAILED', 'CANCELLED'] as const),
  ELIGIBILITY_APPROVED: Object.freeze([
    'ENTITLEMENT_RESERVED',
    'FUNDING_RESERVED',
    'RESERVED',
    'PROVIDER_RESERVED',
    'FAILED',
    'CANCELLED',
  ] as const),
  ENTITLEMENT_RESERVED: Object.freeze(['FUNDING_RESERVED', 'RESERVED', 'PROVIDER_RESERVED', 'FAILED', 'CANCELLED'] as const),
  FUNDING_RESERVED: Object.freeze([
    'RESERVED',
    'USER_PAYMENT_AUTHORIZED',
    'PROVIDER_RESERVED',
    'FAILED',
    'CANCELLED',
  ] as const),
  RESERVED: Object.freeze([
    'USER_PAYMENT_AUTHORIZED',
    'PROVIDER_RESERVED',
    'PROVIDER_PAYMENT_AUTHORIZED',
    'BOOKING_PENDING',
    'FAILED',
    'CANCEL_PENDING',
    'CANCELLED',
    'RECONCILIATION_REQUIRED',
  ] as const),
  USER_PAYMENT_AUTHORIZED: Object.freeze([
    'PROVIDER_RESERVED',
    'PROVIDER_PAYMENT_AUTHORIZED',
    'BOOKING_PENDING',
    'FAILED',
    'CANCEL_PENDING',
    'RECONCILIATION_REQUIRED',
  ] as const),
  PROVIDER_RESERVED: Object.freeze([
    'PROVIDER_PAYMENT_AUTHORIZED',
    'BOOKING_PENDING',
    'BOOKED',
    'FAILED',
    'CANCEL_PENDING',
    'RECONCILIATION_REQUIRED',
  ] as const),
  PROVIDER_PAYMENT_AUTHORIZED: Object.freeze([
    'BOOKING_PENDING',
    'BOOKED',
    'FAILED',
    'CANCEL_PENDING',
    'RECONCILIATION_REQUIRED',
  ] as const),
  BOOKING_PENDING: Object.freeze([
    'BOOKED',
    'FAILED',
    'RECONCILIATION_REQUIRED',
    'CANCEL_PENDING',
  ] as const),
  BOOKED: Object.freeze([
    'FULFILLMENT_PENDING',
    'FULFILLED',
    'SETTLEMENT_PENDING',
    'SETTLED',
    'CANCEL_PENDING',
    'CANCELLED',
    'RECONCILIATION_REQUIRED',
    'DISPUTED',
  ] as const),
  FULFILLMENT_PENDING: Object.freeze(['FULFILLED', 'SETTLEMENT_PENDING', 'RECONCILIATION_REQUIRED', 'DISPUTED'] as const),
  FULFILLED: Object.freeze(['SETTLEMENT_PENDING', 'SETTLED', 'REFUND_PENDING', 'DISPUTED'] as const),
  SETTLEMENT_PENDING: Object.freeze(['SETTLED', 'REFUND_PENDING', 'RECONCILIATION_REQUIRED', 'DISPUTED'] as const),
  SETTLED: Object.freeze(['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED'] as const),
  CANCEL_PENDING: Object.freeze(['CANCELLED', 'REFUND_PENDING', 'FAILED', 'RECONCILIATION_REQUIRED'] as const),
  CANCELLED: Object.freeze(['REFUND_PENDING', 'REFUNDED'] as const),
  REFUND_PENDING: Object.freeze(['PARTIALLY_REFUNDED', 'REFUNDED', 'RECONCILIATION_REQUIRED'] as const),
  PARTIALLY_REFUNDED: Object.freeze(['REFUND_PENDING', 'REFUNDED', 'DISPUTED'] as const),
  REFUNDED: Object.freeze([] as const),
  RECONCILIATION_REQUIRED: Object.freeze([
    'BOOKED',
    'FULFILLED',
    'SETTLED',
    'FAILED',
    'CANCELLED',
    'REFUNDED',
    'REVIEW_REQUIRED',
    'BOOKING_PENDING',
    'SETTLEMENT_PENDING',
  ] as const),
  REVIEW_REQUIRED: Object.freeze([
    'RECONCILIATION_REQUIRED',
    'SETTLED',
    'CANCELLED',
    'REFUNDED',
    'FAILED',
    'DISPUTED',
  ] as const),
  FAILED: Object.freeze(['RECONCILIATION_REQUIRED', 'REVIEW_REQUIRED'] as const),
  DISPUTED: Object.freeze(['SETTLED', 'REFUNDED', 'REVIEW_REQUIRED', 'RECONCILIATION_REQUIRED'] as const),
});

export const TERMINAL_ACCESS_TRANSACTION_STATUSES: ReadonlySet<AccessDomainTransactionStatus> = new Set([
  'REFUNDED',
  'CANCELLED',
]);

export function canTransitionAccessTransaction(
  from: AccessDomainTransactionStatus,
  to: AccessDomainTransactionStatus,
): boolean {
  if (from === to) {
    return true;
  }
  const allowed = ACCESS_TRANSACTION_TRANSITIONS[from];
  return allowed.includes(to);
}

export function assertAccessTransactionTransition(
  from: AccessDomainTransactionStatus,
  to: AccessDomainTransactionStatus,
): void {
  if (!canTransitionAccessTransaction(from, to)) {
    throw new Error(`illegal Access transaction transition: ${from} -> ${to}`);
  }
}

export function isTerminalAccessTransactionStatus(status: AccessDomainTransactionStatus): boolean {
  return TERMINAL_ACCESS_TRANSACTION_STATUSES.has(status);
}

export class AccessTransactionStateMachine {
  readonly current: AccessDomainTransactionStatus;

  constructor(initial: AccessDomainTransactionStatus = 'CREATED') {
    this.current = initial;
  }

  canTransitionTo(next: AccessDomainTransactionStatus): boolean {
    return canTransitionAccessTransaction(this.current, next);
  }

  transition(next: AccessDomainTransactionStatus): AccessDomainTransactionStatus {
    assertAccessTransactionTransition(this.current, next);
    return next;
  }
}
