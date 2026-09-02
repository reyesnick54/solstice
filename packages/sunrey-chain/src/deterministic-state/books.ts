/**
 * Convert between in-memory AssetSupplyBook and canonical serializable form.
 */

import { emptyBook, type AssetSupplyBook } from '../economics/supply.ts';
import type { NativeMonetaryAssetId } from '../economics/types.ts';
import type { CanonicalAccountPosition, CanonicalSupplyBook } from './types.ts';

function compareAccountPosition(
  left: CanonicalAccountPosition,
  right: CanonicalAccountPosition,
): number {
  if (left.account !== right.account) {
    return left.account < right.account ? -1 : 1;
  }
  return left.assetId < right.assetId ? -1 : left.assetId > right.assetId ? 1 : 0;
}

export function bookToCanonical(book: AssetSupplyBook): CanonicalSupplyBook {
  const positions: CanonicalAccountPosition[] = [];
  for (const position of book.positions.values()) {
    positions.push(
      Object.freeze({
        account: position.account,
        assetId: book.assetId,
        circulating: position.circulating,
        locked: position.locked,
        escrowed: position.escrowed,
        feeReserved: position.feeReserved,
      }),
    );
  }
  positions.sort(compareAccountPosition);
  const usedReplayIds = [...book.usedReplayIds].sort();
  return Object.freeze({
    assetId: book.assetId,
    policyVersion: book.policyVersion,
    genesisAllocated: book.genesisAllocated,
    issuedPostGenesis: book.issuedPostGenesis,
    burned: book.burned,
    circulating: book.circulating,
    locked: book.locked,
    escrowed: book.escrowed,
    feeReserved: book.feeReserved,
    positions: Object.freeze(positions),
    usedReplayIds: Object.freeze(usedReplayIds),
  });
}

export function bookFromCanonical(canonical: CanonicalSupplyBook): AssetSupplyBook {
  const book = emptyBook(canonical.assetId, canonical.policyVersion);
  book.genesisAllocated = canonical.genesisAllocated;
  book.issuedPostGenesis = canonical.issuedPostGenesis;
  book.burned = canonical.burned;
  book.circulating = canonical.circulating;
  book.locked = canonical.locked;
  book.escrowed = canonical.escrowed;
  book.feeReserved = canonical.feeReserved;
  for (const position of canonical.positions) {
    if (position.assetId !== canonical.assetId) {
      throw new TypeError('position assetId must match supply book assetId');
    }
    book.positions.set(position.account, Object.freeze({ ...position }));
  }
  for (const replayId of canonical.usedReplayIds) {
    book.usedReplayIds.add(replayId);
  }
  return book;
}

export function canonicalSuppliesFromBooks(
  books: Readonly<Record<NativeMonetaryAssetId, AssetSupplyBook>>,
): readonly [CanonicalSupplyBook, CanonicalSupplyBook] {
  const sunrey = bookToCanonical(books.SUNREY_COIN);
  const moonrey = bookToCanonical(books.MOONREY_COIN);
  return Object.freeze([sunrey, moonrey]);
}

export function booksFromCanonicalSupplies(
  supplies: readonly [CanonicalSupplyBook, CanonicalSupplyBook],
): Record<NativeMonetaryAssetId, AssetSupplyBook> {
  const [left, right] = supplies;
  const sunrey = left.assetId === 'SUNREY_COIN' ? left : right;
  const moonrey = left.assetId === 'MOONREY_COIN' ? left : right;
  if (sunrey.assetId !== 'SUNREY_COIN' || moonrey.assetId !== 'MOONREY_COIN') {
    throw new TypeError('canonical supplies must contain both native assets');
  }
  return {
    SUNREY_COIN: bookFromCanonical(sunrey),
    MOONREY_COIN: bookFromCanonical(moonrey),
  };
}
