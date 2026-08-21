/**
 * Payment failure / return / reversal handling.
 * Every path must leave the ledger reconcilable: release unused holds,
 * never double-capture, ignore duplicate/late callbacks after a terminal state.
 */

import type { PaymentLifecycleStatus } from './lifecycle.ts';

export const PAYMENT_FAILURE_CLASSES = [
  'SUBMISSION_FAILURE_BEFORE_FUNDS_LEAVE',
  'PROVIDER_REJECTION',
  'RETURN_AFTER_SUBMISSION',
  'REVERSAL',
  'DUPLICATE_CALLBACK',
  'LATE_CALLBACK',
] as const;
export type PaymentFailureClass = (typeof PAYMENT_FAILURE_CLASSES)[number];

export type FailureDisposition = {
  readonly failureClass: PaymentFailureClass;
  readonly nextStatus: PaymentLifecycleStatus | 'IGNORE';
  readonly ledgerAction: 'RELEASE_HOLD' | 'RETURN_JOURNALS' | 'REVERSE_JOURNALS' | 'NONE';
  readonly reconcilable: true;
};

export function disposePaymentFailure(input: {
  readonly current: PaymentLifecycleStatus;
  readonly failureClass: PaymentFailureClass;
}): FailureDisposition {
  if (input.failureClass === 'DUPLICATE_CALLBACK' || input.failureClass === 'LATE_CALLBACK') {
    if (
      input.current === 'SETTLED' ||
      input.current === 'FAILED' ||
      input.current === 'CANCELLED' ||
      input.current === 'RETURNED' ||
      input.current === 'REVERSED'
    ) {
      return Object.freeze({
        failureClass: input.failureClass,
        nextStatus: 'IGNORE',
        ledgerAction: 'NONE',
        reconcilable: true,
      });
    }
  }
  if (input.failureClass === 'SUBMISSION_FAILURE_BEFORE_FUNDS_LEAVE') {
    return Object.freeze({
      failureClass: input.failureClass,
      nextStatus: 'FAILED',
      ledgerAction: input.current === 'QUEUED' || input.current === 'AUTHORIZED' ? 'RELEASE_HOLD' : 'NONE',
      reconcilable: true,
    });
  }
  if (input.failureClass === 'PROVIDER_REJECTION') {
    return Object.freeze({
      failureClass: input.failureClass,
      nextStatus: 'FAILED',
      ledgerAction: 'RELEASE_HOLD',
      reconcilable: true,
    });
  }
  if (input.failureClass === 'RETURN_AFTER_SUBMISSION') {
    return Object.freeze({
      failureClass: input.failureClass,
      nextStatus: 'RETURNED',
      ledgerAction: 'RETURN_JOURNALS',
      reconcilable: true,
    });
  }
  return Object.freeze({
    failureClass: 'REVERSAL',
    nextStatus: 'REVERSED',
    ledgerAction: 'REVERSE_JOURNALS',
    reconcilable: true,
  });
}
