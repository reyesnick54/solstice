/**
 * Epoch supply reconciliation against canonical AssetSupplyBook.
 *
 * expected = genesis + issued - burned
 * observed = circulating + locked + escrowed + feeReserved
 */

import { expectedTotal, observedTotal, snapshotOf, supplyReconciles } from '../../economics/supply.ts';
import type { AssetSupplyBook } from '../../economics/supply.ts';
import type { SupplyView } from './types.ts';

export function viewOf(book: AssetSupplyBook): SupplyView {
  return Object.freeze({
    assetId: book.assetId,
    genesis: book.genesisAllocated,
    issued: book.issuedPostGenesis,
    burned: book.burned,
    circulating: book.circulating,
    locked: book.locked,
    escrowed: book.escrowed,
    feeReserved: book.feeReserved,
    expected: expectedTotal(book),
    observed: observedTotal(book),
    reconciled: supplyReconciles(book),
  });
}

export function reconcileEpoch(
  epoch: number,
  sunrey: AssetSupplyBook,
  moonrey: AssetSupplyBook,
): {
  readonly epoch: number;
  readonly sunreyReconciled: boolean;
  readonly moonreyReconciled: boolean;
  readonly sunrey: SupplyView;
  readonly moonrey: SupplyView;
} {
  return Object.freeze({
    epoch,
    sunreyReconciled: supplyReconciles(sunrey),
    moonreyReconciled: supplyReconciles(moonrey),
    sunrey: viewOf(sunrey),
    moonrey: viewOf(moonrey),
  });
}

export function snapshotPair(sunrey: AssetSupplyBook, moonrey: AssetSupplyBook) {
  return Object.freeze([snapshotOf(sunrey), snapshotOf(moonrey)]);
}

export function noNegativeSupply(book: AssetSupplyBook): boolean {
  return (
    book.genesisAllocated >= 0n &&
    book.issuedPostGenesis >= 0n &&
    book.burned >= 0n &&
    book.circulating >= 0n &&
    book.locked >= 0n &&
    book.escrowed >= 0n &&
    book.feeReserved >= 0n
  );
}

export function withinMaximumSupply(book: AssetSupplyBook, maximum: bigint): boolean {
  return expectedTotal(book) <= maximum;
}
