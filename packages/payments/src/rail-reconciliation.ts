import type { Journal } from '../../ledger/src/types.ts';
import { ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import type { PaymentOrder } from './payment.ts';
import type { RailSubmission } from './rail-submission.ts';
import type { SettlementReport } from './rail-settlement-report.ts';
import { RECONCILIATION_STATUSES as BASE_STATUSES, type ProviderSettlementReport } from './reconciliation.ts';

export const RAIL_RECONCILIATION_STATUSES = [
  ...BASE_STATUSES,
  'PENDING',
  'MISMATCH',
  'MISSING_EXTERNAL',
  'MISSING_INTERNAL',
  'DUPLICATE_EXTERNAL',
] as const;
export type RailReconciliationStatus = (typeof RAIL_RECONCILIATION_STATUSES)[number];

export type RailReconciliationResult = {
  readonly paymentId: string;
  readonly status: RailReconciliationStatus;
  readonly mismatches: readonly string[];
  readonly internalJournalIds: readonly string[];
  readonly providerSettlementRef: string | null;
  readonly railSubmissionId: string | null;
};

/**
 * Compare Payment ↔ Rail Submission ↔ Provider Status ↔ Settlement Report ↔ Ledger.
 * Never auto-corrects a financial mismatch.
 */
export function reconcileRail(
  payment: PaymentOrder | null,
  submission: RailSubmission | null,
  journals: readonly Journal[],
  report: ProviderSettlementReport | SettlementReport | null,
  extras: { readonly duplicateExternal?: boolean | undefined } = {},
): RailReconciliationResult {
  const mismatches: string[] = [];
  if (extras.duplicateExternal) {
    mismatches.push('duplicate_external');
  }
  if (!payment && report) {
    mismatches.push('missing_internal');
  }
  if (payment && !report) {
    mismatches.push('missing_external');
  }
  if (payment && !submission) {
    mismatches.push('missing_rail_submission');
  }
  if (payment && submission && submission.paymentId !== payment.paymentId) {
    mismatches.push('submission_payment_mismatch');
  }
  if (payment && submission && payment.settlementRef && submission.references.settlementReference) {
    if (String(payment.settlementRef) !== String(submission.references.settlementReference)) {
      mismatches.push('settlement_ref_mismatch');
    }
  }
  if (payment && isProviderReport(report)) {
    if (report.paymentId !== payment.paymentId) {
      mismatches.push('payment_id_mismatch');
    }
    if (report.settlementRef !== payment.settlementRef) {
      mismatches.push('settlement_ref_mismatch');
    }
    if (report.destinationAmountMinorUnits !== payment.quotedDestinationAmount.minorUnits.toString()) {
      mismatches.push('destination_amount_mismatch');
    }
    if (report.destinationCurrency !== payment.destinationCurrency) {
      mismatches.push('destination_currency_mismatch');
    }
    if (report.sourceAmountMinorUnits !== payment.sourceAmount.minorUnits.toString()) {
      mismatches.push('source_amount_mismatch');
    }
    if (report.sourceCurrency !== payment.sourceCurrency) {
      mismatches.push('source_currency_mismatch');
    }
  }
  if (payment && isSettlementReport(report)) {
    const line = report.payments.find((row) => row.paymentId === payment.paymentId);
    if (!line) {
      mismatches.push('missing_external');
    } else if (line.amount.minorUnits !== payment.quotedDestinationAmount.minorUnits) {
      mismatches.push('destination_amount_mismatch');
    }
  }
  const related = payment ? journals.filter((journal) => payment.journalIds.includes(journal.id)) : [];
  if (payment && related.length !== payment.journalIds.length) {
    mismatches.push('journal_set_mismatch');
  }
  for (const journal of related) {
    let debits = 0n;
    let credits = 0n;
    for (const posting of journal.postings) {
      if (posting.direction === 'DEBIT') {
        debits += ledgerScaledUnits(posting.amount);
      } else {
        credits += ledgerScaledUnits(posting.amount);
      }
    }
    if (debits !== credits) {
      mismatches.push(`journal_unbalanced_${journal.id}`);
    }
  }

  let status: RailReconciliationStatus = 'MATCHED';
  if (mismatches.includes('duplicate_external')) {
    status = 'DUPLICATE_EXTERNAL';
  } else if (mismatches.includes('missing_internal') && !payment) {
    status = 'MISSING_INTERNAL';
  } else if (mismatches.includes('missing_external') && payment && !report) {
    status = payment.status === 'SETTLED' || payment.status === 'RETURNED' ? 'MISSING_EXTERNAL' : 'PENDING';
  } else if (mismatches.some((row) => row.endsWith('_mismatch') || row.startsWith('journal_unbalanced_'))) {
    status = mismatches.some((row) => row.startsWith('journal_unbalanced_')) ? 'INVESTIGATION_REQUIRED' : 'MISMATCH';
  } else if (mismatches.length > 0) {
    status = 'INVESTIGATION_REQUIRED';
  }

  return Object.freeze({
    paymentId: payment?.paymentId ?? (isProviderReport(report) ? report.paymentId : 'unknown'),
    status,
    mismatches: Object.freeze(mismatches),
    internalJournalIds: payment?.journalIds ?? [],
    providerSettlementRef: payment?.settlementRef ?? (isProviderReport(report) ? report.settlementRef : null),
    railSubmissionId: submission?.railSubmissionId ?? null,
  });
}

function isProviderReport(report: ProviderSettlementReport | SettlementReport | null): report is ProviderSettlementReport {
  return report !== null && 'destinationAmountMinorUnits' in report;
}

function isSettlementReport(report: ProviderSettlementReport | SettlementReport | null): report is SettlementReport {
  return report !== null && 'integrityHash' in report;
}
