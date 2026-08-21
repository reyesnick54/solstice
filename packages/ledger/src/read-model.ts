import { ledgerAssetKey, ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import { Money } from '../../money/src/money.ts';
import { journalReadStatus } from './lifecycle.ts';
import type { Journal, LedgerAccount, Posting } from './types.ts';

export type LedgerBalanceProjection = {
  readonly accountId: string;
  readonly currency: string;
  readonly posted: Money;
  readonly credits: bigint;
  readonly debits: bigint;
};

export type JournalHistoryPage = {
  readonly items: readonly Journal[];
  readonly nextCursor: string | null;
};

/**
 * Derived posted balance. Not a stored account field and not a second
 * accounting authority. Credits minus debits for customer-style deposit books.
 */
export function projectPostedBalance(
  journals: readonly Journal[],
  account: Pick<LedgerAccount, 'id' | 'currency'>,
): LedgerBalanceProjection {
  let credits = 0n;
  let debits = 0n;
  for (const journal of journals) {
    for (const posting of journal.postings) {
      if (posting.accountId !== account.id) {
        continue;
      }
      const asset = ledgerAssetKey(posting.amount);
      if (asset !== account.currency) {
        throw new TypeError(`mixed currency on account ${account.id}: ${account.currency} vs ${asset}`);
      }
      const units = ledgerScaledUnits(posting.amount);
      if (posting.direction === 'CREDIT') {
        credits += units;
      } else {
        debits += units;
      }
    }
  }
  return Object.freeze({
    accountId: account.id,
    currency: account.currency,
    posted: Money.fromMinorUnits(credits - debits, account.currency),
    credits,
    debits,
  });
}

export function lookupJournal(
  journals: readonly Journal[],
  id: string,
): Journal | undefined {
  return journals.find((journal) => journal.id === id);
}

export function lookupJournalByReference(
  journals: readonly Journal[],
  reference: string,
): Journal | undefined {
  return journals.find((journal) => journal.reference === reference || journal.idempotencyKey === reference);
}

export function journalHistory(
  journals: readonly Journal[],
  input: {
    readonly accountId?: string;
    readonly cursor?: string;
    readonly limit?: number;
  } = {},
): JournalHistoryPage {
  const limit = input.limit ?? 50;
  const filtered = journals.filter((journal) => {
    if (!input.accountId) {
      return true;
    }
    return journal.postings.some((posting) => posting.accountId === input.accountId);
  });
  const start = input.cursor ? filtered.findIndex((journal) => journal.id === input.cursor) + 1 : 0;
  const slice = filtered.slice(Math.max(start, 0), Math.max(start, 0) + limit);
  const last = slice[slice.length - 1];
  const more = start + slice.length < filtered.length;
  return Object.freeze({
    items: slice,
    nextCursor: more && last ? last.id : null,
  });
}

export function derivedJournalStatus(
  journal: Journal,
  journals: readonly Journal[],
): 'POSTED' | 'REVERSED' {
  const reversed = journals.some(
    (candidate) => candidate.reversesJournalId === journal.id && candidate.reversalKind === 'FULL',
  );
  return journalReadStatus({ posted: true, reversed });
}

export function postingsForAccount(journals: readonly Journal[], accountId: string): readonly Posting[] {
  const out: Posting[] = [];
  for (const journal of journals) {
    for (const posting of journal.postings) {
      if (posting.accountId === accountId) {
        out.push(posting);
      }
    }
  }
  return out;
}
