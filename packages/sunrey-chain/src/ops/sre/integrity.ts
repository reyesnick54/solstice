/**
 * Restore/chaos integrity checks for fixture journals.
 *
 * Does not import Ledger internals. Canonical posting remains
 * `Ledger.postJournal` in packages/ledger. This only verifies that a
 * recovered fixture still balances in integer minor units and did not
 * invent journals.
 */

export type FixturePosting = {
  readonly direction: 'DEBIT' | 'CREDIT';
  readonly minorUnits: bigint;
};

export type FixtureJournal = {
  readonly postings: readonly FixturePosting[];
};

export function fixtureJournalsBalanced(journals: readonly FixtureJournal[]): boolean {
  for (const journal of journals) {
    if (journal.postings.length < 2) {
      return false;
    }
    let debits = 0n;
    let credits = 0n;
    for (const posting of journal.postings) {
      if (typeof posting.minorUnits !== 'bigint' || posting.minorUnits <= 0n) {
        return false;
      }
      if (posting.direction === 'DEBIT') {
        debits += posting.minorUnits;
      } else if (posting.direction === 'CREDIT') {
        credits += posting.minorUnits;
      } else {
        return false;
      }
    }
    if (debits !== credits) {
      return false;
    }
  }
  return journals.length > 0;
}
