import { asMoney, ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import { Money } from '../../money/src/money.ts';
import { LedgerInvariantError, type Posting, type ProposedPosting, type ReversalKind } from './types.ts';

export type ReversalPlan = {
  readonly originalJournalId: string;
  readonly kind: ReversalKind;
  readonly postings: readonly ProposedPosting[];
  readonly originalTotalScaled: bigint;
  readonly reversedScaled: bigint;
};

/**
 * Invert a posted journal. The original postings are never mutated.
 * A partial reversal must name an explicit positive amount less than the
 * original single-sided total. Complex multi-amount journals require FULL.
 */
export function planReversal(
  originalJournalId: string,
  postings: readonly Posting[],
  kind: ReversalKind,
  partialAmount?: Money,
): ReversalPlan {
  if (postings.length < 2) {
    throw new LedgerInvariantError('REVERSAL', 'original journal has no invertible postings');
  }
  const amounts = new Set(postings.map((posting) => ledgerScaledUnits(posting.amount).toString()));
  const originalTotal = ledgerScaledUnits(postings[0]!.amount);
  if (kind === 'PARTIAL') {
    if (!partialAmount) {
      throw new LedgerInvariantError('REVERSAL', 'partial reversal requires an explicit amount');
    }
    if (amounts.size !== 1) {
      throw new LedgerInvariantError(
        'REVERSAL',
        'partial reversal is only supported when every original posting shares one amount',
      );
    }
    if (partialAmount.currency !== asMoney(postings[0]!.amount).currency) {
      throw new LedgerInvariantError('REVERSAL', 'partial reversal currency must match the original journal');
    }
    if (!partialAmount.isPositive() || partialAmount.minorUnits >= originalTotal) {
      throw new LedgerInvariantError(
        'REVERSAL',
        'partial reversal amount must be positive and strictly less than the original',
      );
    }
    return {
      originalJournalId,
      kind,
      originalTotalScaled: originalTotal,
      reversedScaled: partialAmount.minorUnits,
      postings: postings.map((posting) => ({
        accountId: posting.accountId,
        direction: posting.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        amount: Money.fromMinorUnits(partialAmount.minorUnits, asMoney(posting.amount).currency),
      })),
    };
  }
  return {
    originalJournalId,
    kind: 'FULL',
    originalTotalScaled: originalTotal,
    reversedScaled: originalTotal,
    postings: postings.map((posting) => ({
      accountId: posting.accountId,
      direction: posting.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      amount: asMoney(posting.amount),
    })),
  };
}
