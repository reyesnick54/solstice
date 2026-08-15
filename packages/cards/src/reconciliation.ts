import type { Journal } from '../../ledger/src/types.ts';
import { ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import type { CardAuthorizationRecord } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';

export const CARD_RECONCILIATION_STATUSES = ['MATCHED', 'INVESTIGATION_REQUIRED'] as const;
export type CardReconciliationStatus = (typeof CARD_RECONCILIATION_STATUSES)[number];

export type ProcessorCardReport = {
  readonly authorizationId?: string;
  readonly clearingId?: string;
  readonly settlementRef?: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly holdId?: string | null;
  readonly journalId?: string | null;
};

export type CardReconciliationResult = {
  readonly subjectId: string;
  readonly status: CardReconciliationStatus;
  readonly mismatches: readonly string[];
  readonly internalHoldId: string | null;
  readonly internalJournalIds: readonly string[];
};

/**
 * Compare processor authorization/clearing/settlement facts to internal
 * hold and journal records. A mismatch opens investigation. The ledger
 * is never auto-corrected.
 */
export function reconcileCardTransaction(input: {
  readonly subjectId: string;
  readonly authorization?: CardAuthorizationRecord;
  readonly clearing?: CardClearingRecord;
  readonly report: ProcessorCardReport | null;
  readonly journals: readonly Journal[];
}): CardReconciliationResult {
  const mismatches: string[] = [];
  if (!input.report) {
    mismatches.push('provider_report_missing');
  } else {
    if (input.authorization && input.report.authorizationId && input.report.authorizationId !== input.authorization.authorizationId) {
      mismatches.push('authorization_id_mismatch');
    }
    if (input.clearing && input.report.clearingId && input.report.clearingId !== input.clearing.clearingId) {
      mismatches.push('clearing_id_mismatch');
    }
    const expectedAmount = input.clearing?.amount.minorUnits.toString() ?? input.authorization?.request.amount.minorUnits.toString();
    const expectedCurrency = input.clearing?.amount.currency ?? input.authorization?.request.currency;
    if (expectedAmount && input.report.amountMinorUnits !== expectedAmount) {
      mismatches.push('amount_mismatch');
    }
    if (expectedCurrency && input.report.currency !== expectedCurrency) {
      mismatches.push('currency_mismatch');
    }
    if (input.authorization?.holdId && input.report.holdId && input.report.holdId !== input.authorization.holdId) {
      mismatches.push('hold_mismatch');
    }
  }
  const journalIds = [
    ...(input.clearing?.journalId ? [input.clearing.journalId] : []),
    ...(input.report?.journalId ? [input.report.journalId] : []),
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
  return Object.freeze({
    subjectId: input.subjectId,
    status: mismatches.length === 0 ? 'MATCHED' : 'INVESTIGATION_REQUIRED',
    mismatches: Object.freeze(mismatches),
    internalHoldId: input.authorization?.holdId ?? null,
    internalJournalIds: Object.freeze(unique),
  });
}
