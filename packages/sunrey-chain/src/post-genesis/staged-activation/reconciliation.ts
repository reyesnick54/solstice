/**
 * AssetSupplyBook reconciliation for issuance stages.
 *
 * A mismatch blocks new issuance. The book is never repaired by
 * overwrite. Chunk 71 remains the monetary authority.
 */

import { expectedTotal, observedTotal } from '../../economics/supply.ts';
import type { SupplyBookSnapshot, SupplyReconciliationResult } from './types.ts';
import { SUPPLY_BOOK_MAY_BE_OVERWRITTEN } from './types.ts';

export function reconcileSupplyBook(book: SupplyBookSnapshot): SupplyReconciliationResult {
  const findings: string[] = [];
  const expected = expectedTotal({
    genesisAllocated: book.genesisAllocated,
    issuedPostGenesis: book.issuedPostGenesis,
    burned: book.burned,
  });
  const observed = observedTotal({
    circulating: book.circulating,
    locked: book.locked,
    escrowed: book.escrowed,
    feeReserved: book.feeReserved,
  });
  if (expected !== observed) {
    findings.push(`AssetSupplyBook mismatch for ${book.assetId}: expected ${expected} observed ${observed}`);
  }
  if (expected < 0n || observed < 0n) {
    findings.push(`AssetSupplyBook quantity cannot be negative for ${book.assetId}`);
  }
  const conserved = findings.length === 0;
  return Object.freeze({
    assetId: book.assetId,
    conserved,
    findings: Object.freeze(findings),
    bookOverwritten: SUPPLY_BOOK_MAY_BE_OVERWRITTEN,
    issuanceBlocked: !conserved,
  });
}

export function reconcileSupplyBooks(
  books: readonly SupplyBookSnapshot[],
): readonly SupplyReconciliationResult[] {
  return Object.freeze(books.map(reconcileSupplyBook));
}

export function issuanceBlockedBySupply(
  books: readonly SupplyBookSnapshot[],
  assetId: SupplyBookSnapshot['assetId'],
): boolean {
  const book = books.find((row) => row.assetId === assetId);
  if (!book) {
    return true;
  }
  return reconcileSupplyBook(book).issuanceBlocked;
}

export function overwriteSupplyBookRejected(): {
  readonly allowed: false;
  readonly bookOverwritten: false;
} {
  return Object.freeze({
    allowed: false,
    bookOverwritten: SUPPLY_BOOK_MAY_BE_OVERWRITTEN,
  });
}
