import type { Journal } from '../../ledger/src/types.ts';
import { ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import type { PaymentOrder } from './payment.ts';

export const RECONCILIATION_STATUSES = ['MATCHED', 'INVESTIGATION_REQUIRED'] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export type ProviderSettlementReport = {
  readonly paymentId: string;
  readonly settlementRef: string;
  readonly destinationAmountMinorUnits: string;
  readonly destinationCurrency: string;
  readonly sourceAmountMinorUnits: string;
  readonly sourceCurrency: string;
};

export type ReconciliationResult = {
  readonly paymentId: string;
  readonly status: ReconciliationStatus;
  readonly mismatches: readonly string[];
  readonly internalJournalIds: readonly string[];
  readonly providerSettlementRef: string | null;
};

/**
 * Compare internal payment + journals to a simulated provider report.
 * A mismatch creates INVESTIGATION_REQUIRED. The ledger is never auto-fixed.
 */
export function reconcilePayment(
  payment: PaymentOrder,
  journals: readonly Journal[],
  report: ProviderSettlementReport | null,
): ReconciliationResult {
  const mismatches: string[] = [];
  if (!report) {
    mismatches.push('provider_report_missing');
  } else {
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
  const related = journals.filter((journal) => payment.journalIds.includes(journal.id));
  if (related.length !== payment.journalIds.length) {
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
  return Object.freeze({
    paymentId: payment.paymentId,
    status: mismatches.length === 0 ? 'MATCHED' : 'INVESTIGATION_REQUIRED',
    mismatches: Object.freeze(mismatches),
    internalJournalIds: payment.journalIds,
    providerSettlementRef: report?.settlementRef ?? null,
  });
}
