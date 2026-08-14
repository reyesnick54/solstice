import type { Account } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import {
  asStatementId,
  freezeStatement,
  type CustomerStatement,
  type StatementLine,
} from '../../../packages/domain/src/statement.ts';
import type { UtcInstant } from '../../../packages/domain/src/time.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
import { Money } from '../../../packages/money/src/money.ts';

export function generateAccountStatement(input: {
  readonly ledger: Ledger;
  readonly account: Account;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly generatedAt: UtcInstant;
  readonly statementId?: string;
}): CustomerStatement {
  const lines: StatementLine[] = [];
  let opening = Money.zero(input.account.currency);
  let credits = Money.zero(input.account.currency);
  let debits = Money.zero(input.account.currency);
  for (const journal of input.ledger.listJournals()) {
    for (const posting of journal.postings) {
      if (posting.accountId !== input.account.id) {
        continue;
      }
      if (posting.amount.currency !== input.account.currency) {
        throw new TypeError('statement refused: journal posting currency does not match account');
      }
      if (journal.createdAt < input.periodStart) {
        if (posting.direction === 'CREDIT') {
          opening = opening.plus(posting.amount);
        } else {
          opening = opening.minus(posting.amount);
        }
        continue;
      }
      if (journal.createdAt > input.periodEnd) {
        continue;
      }
      if (posting.direction === 'CREDIT') {
        credits = credits.plus(posting.amount);
      } else {
        debits = debits.plus(posting.amount);
      }
      lines.push(
        Object.freeze({
          journalId: journal.id,
          postedAt: journal.createdAt as UtcInstant,
          direction: posting.direction,
          amountMinorUnits: posting.amount.minorUnits,
          currency: asCurrencyCode(posting.amount.currency),
          description: describeJournal(journal.actionType, posting.direction),
          transactionReference: journal.id,
        }),
      );
    }
  }
  const closing = opening.plus(credits).minus(debits);
  return freezeStatement({
    id: asStatementId(input.statementId ?? `stmt_${input.account.id}_${input.periodStart}`),
    accountId: input.account.id,
    customerId: input.account.ownerId,
    currency: input.account.currency,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    openingMinorUnits: opening.minorUnits,
    closingMinorUnits: closing.minorUnits,
    creditsMinorUnits: credits.minorUnits,
    debitsMinorUnits: debits.minorUnits,
    lines,
    generatedAt: input.generatedAt,
  });
}

function describeJournal(actionType: string, direction: 'CREDIT' | 'DEBIT'): string {
  if (actionType === 'POST_DEPOSIT') {
    return direction === 'CREDIT' ? 'Simulated deposit' : 'Simulated funding contra';
  }
  if (actionType === 'POST_WITHDRAWAL') {
    return direction === 'DEBIT' ? 'Simulated withdrawal' : 'Simulated funding contra';
  }
  if (actionType === 'INTERNAL_TRANSFER') {
    return direction === 'DEBIT' ? 'Internal transfer out' : 'Internal transfer in';
  }
  if (actionType === 'POST_FEE') {
    return 'Explicit fee';
  }
  if (actionType === 'POST_INTEREST') {
    return 'Interest posting';
  }
  if (actionType === 'POST_REVERSAL') {
    return 'Compensating reversal';
  }
  if (actionType === 'CAPTURE_HOLD') {
    return 'Hold capture';
  }
  if (actionType === 'INITIATE_PENDING_SETTLEMENT') {
    return direction === 'DEBIT' ? 'Pending settlement initiated' : 'Pending settlement credit';
  }
  if (actionType === 'SETTLE_PENDING') {
    return 'Pending settlement completed';
  }
  if (actionType === 'RETURN_PENDING') {
    return 'Pending settlement returned';
  }
  return actionType;
}
