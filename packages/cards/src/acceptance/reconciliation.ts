import type { Journal } from '../../../ledger/src/types.ts';
import { ledgerScaledUnits } from '../../../money/src/ledger-amount.ts';
import type { MerchantPayment } from './payment.ts';

export const ACCEPTANCE_RECONCILIATION_STATUSES = [
  'MATCHED',
  'PENDING',
  'MISMATCH',
  'INVESTIGATION_REQUIRED',
] as const;
export type AcceptanceReconciliationStatus = (typeof ACCEPTANCE_RECONCILIATION_STATUSES)[number];

export type AcceptanceProviderReport = {
  readonly paymentId?: string;
  readonly providerTransactionRef?: string;
  readonly settlementRef?: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly journalId?: string | null;
};

export type AcceptanceReconciliationResult = {
  readonly subjectId: string;
  readonly status: AcceptanceReconciliationStatus;
  readonly mismatches: readonly string[];
  readonly internalJournalIds: readonly string[];
};

/**
 * Compare merchant payment, provider transaction, settlement report, and
 * internal journal. A mismatch opens investigation. The ledger is never
 * auto-corrected.
 */
export function reconcileAcceptancePayment(input: {
  readonly subjectId: string;
  readonly payment?: MerchantPayment;
  readonly report: AcceptanceProviderReport | null;
  readonly journals: readonly Journal[];
}): AcceptanceReconciliationResult {
  const mismatches: string[] = [];
  if (!input.payment) {
    mismatches.push('payment_missing');
  }
  if (!input.report) {
    return Object.freeze({
      subjectId: input.subjectId,
      status: mismatches.length === 0 ? 'PENDING' : 'INVESTIGATION_REQUIRED',
      mismatches: Object.freeze(mismatches),
      internalJournalIds: Object.freeze(input.payment?.settlementJournalId ? [input.payment.settlementJournalId] : []),
    });
  }
  if (input.payment && input.report.paymentId && input.report.paymentId !== input.payment.paymentId) {
    mismatches.push('payment_id_mismatch');
  }
  if (
    input.payment?.providerTransactionRef &&
    input.report.providerTransactionRef &&
    input.report.providerTransactionRef !== input.payment.providerTransactionRef
  ) {
    mismatches.push('provider_transaction_mismatch');
  }
  if (input.payment && input.report.amountMinorUnits !== input.payment.amount.minorUnits.toString()) {
    mismatches.push('amount_mismatch');
  }
  if (input.payment && input.report.currency !== input.payment.amount.currency) {
    mismatches.push('currency_mismatch');
  }
  const journalIds = [
    ...(input.payment?.settlementJournalId ? [input.payment.settlementJournalId] : []),
    ...(input.payment?.feeJournalId ? [input.payment.feeJournalId] : []),
    ...(input.report.journalId ? [input.report.journalId] : []),
  ];
  const unique = [...new Set(journalIds)];
  for (const journalId of unique) {
    const journal = input.journals.find((row) => row.id === journalId);
    if (!journal) {
      mismatches.push(`journal_missing_${journalId}`);
      continue;
    }
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
      mismatches.push(`journal_unbalanced_${journalId}`);
    }
  }
  const status: AcceptanceReconciliationStatus =
    mismatches.length === 0 ? 'MATCHED' : mismatches.some((row) => row.includes('mismatch') || row.includes('missing'))
      ? 'MISMATCH'
      : 'INVESTIGATION_REQUIRED';
  return Object.freeze({
    subjectId: input.subjectId,
    status: mismatches.length === 0 ? 'MATCHED' : status === 'MISMATCH' ? 'MISMATCH' : 'INVESTIGATION_REQUIRED',
    mismatches: Object.freeze(mismatches),
    internalJournalIds: Object.freeze(unique),
  });
}
