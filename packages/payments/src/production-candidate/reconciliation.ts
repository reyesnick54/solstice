import type { Journal } from '../../../ledger/src/types.ts';
import type { PaymentOrder } from '../payment.ts';
import { reconcileRail, type RailReconciliationResult } from '../rail-reconciliation.ts';
import type { RailSubmission } from '../rail-submission.ts';
import type { SettlementReport } from '../rail-settlement-report.ts';
import type { CanonicalRailStatus } from '../rail-types.ts';
import type { CandidateReconciliationOutcome } from './types.ts';

export type CandidateReconciliationResult = {
  readonly outcome: CandidateReconciliationOutcome;
  readonly mismatches: readonly string[];
  readonly autoAdjustedLedger: false;
  readonly rail: RailReconciliationResult;
};

/**
 * Reconcile Payments domain, Ledger, provider submission, and provider
 * settlement report. Never auto-adjusts the ledger to make a provider match.
 */
export function reconcileCandidatePayment(input: {
  readonly payment: PaymentOrder | null;
  readonly submission: RailSubmission | null;
  readonly journals: readonly Journal[];
  readonly report: SettlementReport | null;
  readonly providerStatus?: CanonicalRailStatus | null;
  readonly duplicateExternal?: boolean | undefined;
}): CandidateReconciliationResult {
  const rail = reconcileRail(input.payment, input.submission, input.journals, input.report, {
    duplicateExternal: input.duplicateExternal,
  });
  const mismatches = [...rail.mismatches];
  if (input.submission?.status === 'SUBMISSION_UNKNOWN') {
    mismatches.push('submission_unknown');
  }
  if (
    input.payment &&
    input.providerStatus &&
    paymentStatusDrift(input.payment.status, input.providerStatus)
  ) {
    mismatches.push('status_mismatch');
  }
  return Object.freeze({
    outcome: outcomeOf(rail.status, mismatches, input.submission?.status),
    mismatches: Object.freeze(mismatches),
    autoAdjustedLedger: false,
    rail,
  });
}

function paymentStatusDrift(paymentStatus: string, providerStatus: CanonicalRailStatus): boolean {
  if (paymentStatus === 'SETTLED' && providerStatus !== 'SETTLED' && providerStatus !== 'RETURNED') {
    return true;
  }
  if (paymentStatus === 'RETURNED' && providerStatus !== 'RETURNED') {
    return true;
  }
  return false;
}

function outcomeOf(
  railStatus: string,
  mismatches: readonly string[],
  submissionStatus: CanonicalRailStatus | undefined,
): CandidateReconciliationOutcome {
  if (mismatches.includes('submission_unknown') || submissionStatus === 'SUBMISSION_UNKNOWN') {
    return 'SUBMISSION_UNKNOWN';
  }
  if (mismatches.includes('duplicate_external') || railStatus === 'DUPLICATE_EXTERNAL') {
    return 'DUPLICATE_EXTERNAL';
  }
  if (mismatches.includes('missing_internal') || railStatus === 'MISSING_INTERNAL') {
    return 'INTERNAL_MISSING';
  }
  if (mismatches.includes('missing_external') || railStatus === 'MISSING_EXTERNAL') {
    return 'PROVIDER_MISSING';
  }
  if (mismatches.includes('destination_amount_mismatch') || mismatches.includes('source_amount_mismatch')) {
    return 'AMOUNT_MISMATCH';
  }
  if (mismatches.includes('status_mismatch')) {
    return 'STATUS_MISMATCH';
  }
  if (railStatus === 'PENDING') {
    return 'PENDING';
  }
  if (railStatus === 'MATCHED' && mismatches.length === 0) {
    return 'MATCHED';
  }
  return 'REVIEW_REQUIRED';
}
