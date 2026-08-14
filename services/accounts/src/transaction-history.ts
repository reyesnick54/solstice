import type { Account } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import type { CustomerId } from '../../../packages/domain/src/customer.ts';
import { isActiveHold, type FundsHold } from '../../../packages/domain/src/hold.ts';
import type { PendingSettlementRecord } from '../../../packages/domain/src/pending-settlement.ts';
import {
  freezeHistoryItem,
  type TransactionHistoryItem,
} from '../../../packages/domain/src/transaction-history.ts';
import type { UtcInstant } from '../../../packages/domain/src/time.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';

export function projectTransactionHistory(input: {
  readonly ledger: Ledger;
  readonly customerId: CustomerId;
  readonly accounts: readonly Account[];
  readonly holds: readonly FundsHold[];
  readonly pending: readonly PendingSettlementRecord[];
  readonly now: UtcInstant;
}): readonly TransactionHistoryItem[] {
  const owned = new Set(
    input.accounts.filter((account) => account.ownerId === input.customerId).map((a) => a.id),
  );
  const items: TransactionHistoryItem[] = [];
  for (const journal of input.ledger.listJournals()) {
    for (const posting of journal.postings) {
      if (!owned.has(posting.accountId as never)) {
        continue;
      }
      const reversed = journal.actionType === 'POST_REVERSAL';
      const returned = journal.actionType === 'RETURN_PENDING';
      items.push(
        freezeHistoryItem({
          reference: `${journal.id}:${posting.id}`,
          accountId: posting.accountId as Account['id'],
          customerId: input.customerId,
          status: reversed ? 'REVERSED' : returned ? 'RETURNED' : 'COMPLETED',
          direction: posting.direction,
          amountMinorUnits: posting.amount.minorUnits,
          currency: asCurrencyCode(posting.amount.currency),
          description: `${journal.actionType} ${posting.direction.toLowerCase()}`,
          journalId: journal.id,
          holdId: null,
          occurredAt: journal.createdAt as UtcInstant,
        }),
      );
    }
  }
  for (const hold of input.holds) {
    if (!owned.has(hold.accountId)) {
      continue;
    }
    const pendingHold = isActiveHold(hold, input.now);
    items.push(
      freezeHistoryItem({
        reference: `hold:${hold.id}`,
        accountId: hold.accountId,
        customerId: input.customerId,
        status: pendingHold ? 'PENDING' : hold.state === 'CANCELLED' ? 'FAILED' : 'COMPLETED',
        direction: 'HOLD',
        amountMinorUnits: hold.amountMinorUnits,
        currency: hold.currency,
        description: `Funds hold ${hold.purpose} ${hold.state}`,
        journalId: hold.captureJournalId,
        holdId: hold.id,
        occurredAt: hold.createdAt,
      }),
    );
  }
  for (const pending of input.pending) {
    if (!owned.has(pending.sourceAccountId) && !owned.has(pending.pendingAccountId)) {
      continue;
    }
    items.push(
      freezeHistoryItem({
        reference: `pending:${pending.id}`,
        accountId: pending.sourceAccountId,
        customerId: input.customerId,
        status:
          pending.state === 'PENDING' || pending.state === 'INITIATED'
            ? 'PENDING'
            : pending.state === 'RETURNED'
              ? 'RETURNED'
              : pending.state === 'REVERSED'
                ? 'REVERSED'
                : 'COMPLETED',
        direction: 'DEBIT',
        amountMinorUnits: pending.amountMinorUnits,
        currency: pending.currency,
        description: `Pending settlement ${pending.state}`,
        journalId: pending.settleJournalId ?? pending.initiateJournalId,
        holdId: null,
        occurredAt: pending.createdAt,
      }),
    );
  }
  return Object.freeze(
    items.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0)),
  );
}
