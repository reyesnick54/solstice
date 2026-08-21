/**
 * Product payment lifecycle. Complements the rail PaymentOrder machine
 * in payment.ts; it does not replace PAYMENT_STATUSES.
 *
 * Canonical rail states stay the settlement authority. This machine is
 * the customer-facing journey, including quote / step-up / approval.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { PaymentStatus } from '../payment.ts';

export const PAYMENT_LIFECYCLE_STATUSES = [
  'DRAFT',
  'QUOTED',
  'AWAITING_APPROVAL',
  'AWAITING_STEP_UP_AUTH',
  'AWAITING_COMPLIANCE',
  'AUTHORIZED',
  'QUEUED',
  'SUBMITTED',
  'PROCESSING',
  'SETTLED',
  'FAILED',
  'CANCELLED',
  'RETURNED',
  'REVERSED',
] as const;
export type PaymentLifecycleStatus = (typeof PAYMENT_LIFECYCLE_STATUSES)[number];

export const ALLOWED_LIFECYCLE_TRANSITIONS: {
  readonly [S in PaymentLifecycleStatus]: readonly PaymentLifecycleStatus[];
} = {
  DRAFT: ['QUOTED', 'AWAITING_STEP_UP_AUTH', 'AWAITING_APPROVAL', 'AWAITING_COMPLIANCE', 'AUTHORIZED', 'SETTLED', 'CANCELLED', 'FAILED'],
  QUOTED: [
    'AWAITING_STEP_UP_AUTH',
    'AWAITING_APPROVAL',
    'AWAITING_COMPLIANCE',
    'AUTHORIZED',
    'SETTLED',
    'RETURNED',
    'CANCELLED',
    'FAILED',
  ],
  AWAITING_STEP_UP_AUTH: [
    'QUOTED',
    'AWAITING_APPROVAL',
    'AWAITING_COMPLIANCE',
    'AUTHORIZED',
    'CANCELLED',
    'FAILED',
  ],
  AWAITING_APPROVAL: ['AWAITING_COMPLIANCE', 'AUTHORIZED', 'CANCELLED', 'FAILED'],
  AWAITING_COMPLIANCE: ['AUTHORIZED', 'CANCELLED', 'FAILED'],
  AUTHORIZED: ['QUEUED', 'SUBMITTED', 'SETTLED', 'FAILED', 'CANCELLED', 'RETURNED'],
  QUEUED: ['SUBMITTED', 'PROCESSING', 'FAILED', 'CANCELLED'],
  SUBMITTED: ['PROCESSING', 'SETTLED', 'FAILED', 'RETURNED', 'CANCELLED'],
  PROCESSING: ['SETTLED', 'FAILED', 'RETURNED', 'CANCELLED'],
  SETTLED: ['RETURNED', 'REVERSED'],
  FAILED: [],
  CANCELLED: [],
  RETURNED: ['REVERSED'],
  REVERSED: [],
};

export type IllegalLifecycleTransition = {
  readonly code: 'ILLEGAL_PAYMENT_LIFECYCLE_TRANSITION';
  readonly paymentId: string;
  readonly from: PaymentLifecycleStatus;
  readonly to: PaymentLifecycleStatus;
};

export function canTransitionLifecycle(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): boolean {
  return ALLOWED_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function assertLifecycleTransition(
  paymentId: string,
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): Result<true, IllegalLifecycleTransition> {
  if (!canTransitionLifecycle(from, to)) {
    return err(
      Object.freeze({
        code: 'ILLEGAL_PAYMENT_LIFECYCLE_TRANSITION' as const,
        paymentId,
        from,
        to,
      }),
    );
  }
  return ok(true);
}

/**
 * Map the rail PaymentOrder status onto the product lifecycle.
 * Existing rail states remain the settlement machine of record.
 */
export function lifecycleFromRailStatus(status: PaymentStatus): PaymentLifecycleStatus {
  switch (status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'PENDING_COMPLIANCE':
    case 'HELD':
      return 'AWAITING_COMPLIANCE';
    case 'READY':
      return 'AUTHORIZED';
    case 'FUNDS_RESERVED':
      return 'QUEUED';
    case 'SUBMITTED':
    case 'SUBMISSION_UNKNOWN':
      return 'SUBMITTED';
    case 'PROCESSING':
      return 'PROCESSING';
    case 'SETTLED':
      return 'SETTLED';
    case 'FAILED':
      return 'FAILED';
    case 'RETURNED':
      return 'RETURNED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'DRAFT';
  }
}

export function isTerminalLifecycle(status: PaymentLifecycleStatus): boolean {
  return (
    status === 'SETTLED' ||
    status === 'FAILED' ||
    status === 'CANCELLED' ||
    status === 'RETURNED' ||
    status === 'REVERSED'
  );
}
