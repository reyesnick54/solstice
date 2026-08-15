import type { UtcInstant } from '../../domain/src/time.ts';
import type { ReconciliationId } from './ids.ts';
import type { TreasuryReconciliationStatus } from './types.ts';

export type TreasuryReconciliation = {
  readonly reconciliationId: ReconciliationId;
  readonly subjectId: string;
  readonly status: TreasuryReconciliationStatus;
  readonly mismatches: readonly string[];
  readonly ledgerJournalIds: readonly string[];
  readonly paymentId: string | null;
  readonly reservationId: string | null;
  readonly createdAt: UtcInstant;
};

export function reconcileTreasury(input: {
  readonly reconciliationId: ReconciliationId;
  readonly subjectId: string;
  readonly paymentId: string | null;
  readonly reservationId: string | null;
  readonly reservationState: string | null;
  readonly paymentStatus: string | null;
  readonly ledgerJournalIds: readonly string[];
  readonly providerBalanceMinor: bigint | null;
  readonly internalAvailableMinor: bigint | null;
  readonly railReportPresent: boolean;
  readonly now: UtcInstant;
}): TreasuryReconciliation {
  const mismatches: string[] = [];
  if (input.paymentStatus === 'SETTLED' && input.reservationState === 'ACTIVE') {
    mismatches.push('settled_payment_has_active_reservation');
  }
  if (input.paymentStatus === 'FAILED' && input.reservationState === 'ACTIVE') {
    mismatches.push('failed_payment_still_reserves_liquidity');
  }
  if (input.paymentStatus === 'SUBMISSION_UNKNOWN' && input.reservationState === 'RELEASED') {
    mismatches.push('unknown_submission_released_liquidity');
  }
  if (input.providerBalanceMinor !== null && input.internalAvailableMinor !== null) {
    if (input.providerBalanceMinor !== input.internalAvailableMinor) {
      mismatches.push('provider_balance_differs_from_internal');
    }
  }
  let status: TreasuryReconciliationStatus = 'MATCHED';
  if (!input.railReportPresent && input.paymentStatus === 'SUBMITTED') {
    status = 'PENDING';
  } else if (input.paymentId && !input.reservationId && input.paymentStatus === 'SETTLED') {
    status = 'MISSING_INTERNAL';
  } else if (input.reservationId && !input.paymentId) {
    status = 'MISSING_EXTERNAL';
  } else if (mismatches.length > 0) {
    status = mismatches.includes('provider_balance_differs_from_internal')
      ? 'MISMATCH'
      : 'INVESTIGATION_REQUIRED';
  }
  return Object.freeze({
    reconciliationId: input.reconciliationId,
    subjectId: input.subjectId,
    status,
    mismatches: Object.freeze(mismatches),
    ledgerJournalIds: Object.freeze([...input.ledgerJournalIds]),
    paymentId: input.paymentId,
    reservationId: input.reservationId,
    createdAt: input.now,
  });
}
