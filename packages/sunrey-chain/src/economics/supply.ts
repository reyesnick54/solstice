/**
 * Canonical native-asset supply accounting.
 *
 * Conservation identity (integer, no plugs):
 *
 *   genesisAllocated + issuedPostGenesis - burned
 *     = circulating + locked + escrowed + feeReserved
 *
 * Source classes and live classes never overlap. Locked quantity
 * remains part of supply. Burns are the only authorized sink.
 */

import { requireKnownAsset } from './constitution.ts';
import {
  LIVE_SUPPLY_CLASSES,
  SOURCE_SUPPLY_CLASSES,
  type LiveSupplyClass,
  type NativeLockClass,
  type NativeMonetaryAssetId,
  type NativeSupplySnapshot,
  type SourceSupplyClass,
} from './types.ts';

export type AccountPosition = {
  readonly account: string;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
};

export type LockRecord = {
  readonly lockId: string;
  readonly account: string;
  readonly assetId: NativeMonetaryAssetId;
  readonly quantity: bigint;
  readonly lockClass: NativeLockClass;
  readonly active: boolean;
};

export type AssetSupplyBook = {
  readonly assetId: NativeMonetaryAssetId;
  readonly policyVersion: string;
  genesisAllocated: bigint;
  issuedPostGenesis: bigint;
  burned: bigint;
  circulating: bigint;
  locked: bigint;
  escrowed: bigint;
  feeReserved: bigint;
  readonly positions: Map<string, AccountPosition>;
  readonly locks: Map<string, LockRecord>;
  readonly usedReplayIds: Set<string>;
};

export function emptyBook(assetId: NativeMonetaryAssetId, policyVersion: string): AssetSupplyBook {
  return {
    assetId,
    policyVersion,
    genesisAllocated: 0n,
    issuedPostGenesis: 0n,
    burned: 0n,
    circulating: 0n,
    locked: 0n,
    escrowed: 0n,
    feeReserved: 0n,
    positions: new Map(),
    locks: new Map(),
    usedReplayIds: new Set(),
  };
}

export function expectedTotal(book: Pick<AssetSupplyBook, 'genesisAllocated' | 'issuedPostGenesis' | 'burned'>): bigint {
  return book.genesisAllocated + book.issuedPostGenesis - book.burned;
}

export function observedTotal(
  book: Pick<AssetSupplyBook, 'circulating' | 'locked' | 'escrowed' | 'feeReserved'>,
): bigint {
  return book.circulating + book.locked + book.escrowed + book.feeReserved;
}

export function supplyReconciles(book: AssetSupplyBook): boolean {
  if (expectedTotal(book) !== observedTotal(book)) {
    return false;
  }
  if (expectedTotal(book) < 0n) {
    return false;
  }
  let heldCirculating = 0n;
  let heldLocked = 0n;
  let heldEscrowed = 0n;
  let heldReserved = 0n;
  for (const position of book.positions.values()) {
    heldCirculating += position.circulating;
    heldLocked += position.locked;
    heldEscrowed += position.escrowed;
    heldReserved += position.feeReserved;
  }
  if (
    heldCirculating !== book.circulating ||
    heldLocked !== book.locked ||
    heldEscrowed !== book.escrowed ||
    heldReserved !== book.feeReserved
  ) {
    return false;
  }
  let lockSum = 0n;
  let escrowSum = 0n;
  for (const lock of book.locks.values()) {
    if (!lock.active) {
      continue;
    }
    if (lock.lockClass === 'MACHINE_ESCROW' || lock.lockClass === 'INTEROP_ESCROW') {
      escrowSum += lock.quantity;
    } else {
      lockSum += lock.quantity;
    }
  }
  return lockSum === book.locked && escrowSum === book.escrowed;
}

export function snapshotOf(book: AssetSupplyBook): NativeSupplySnapshot {
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
    expectedTotal: expectedTotal(book),
    observedTotal: observedTotal(book),
  });
}

export function positionOf(book: AssetSupplyBook, account: string): AccountPosition {
  return (
    book.positions.get(account) ??
    Object.freeze({ account, circulating: 0n, locked: 0n, escrowed: 0n, feeReserved: 0n })
  );
}

function writePosition(book: AssetSupplyBook, next: AccountPosition): void {
  if (next.circulating === 0n && next.locked === 0n && next.escrowed === 0n && next.feeReserved === 0n) {
    book.positions.delete(next.account);
    return;
  }
  book.positions.set(next.account, Object.freeze(next));
}

export function creditCirculating(book: AssetSupplyBook, account: string, quantity: bigint): void {
  if (quantity <= 0n) {
    throw new TypeError('quantity must be positive');
  }
  const current = positionOf(book, account);
  writePosition(book, { ...current, circulating: current.circulating + quantity });
  book.circulating += quantity;
}

export function debitCirculating(book: AssetSupplyBook, account: string, quantity: bigint): void {
  const current = positionOf(book, account);
  if (current.circulating < quantity) {
    throw new TypeError('insufficient circulating quantity');
  }
  writePosition(book, { ...current, circulating: current.circulating - quantity });
  book.circulating -= quantity;
}

export function moveLive(
  book: AssetSupplyBook,
  account: string,
  from: LiveSupplyClass,
  to: LiveSupplyClass,
  quantity: bigint,
): void {
  if (from === to || quantity <= 0n) {
    throw new TypeError('invalid live-class move');
  }
  const current = positionOf(book, account);
  const fromKey = liveKey(from);
  const toKey = liveKey(to);
  if (current[fromKey] < quantity) {
    throw new TypeError(`insufficient ${from}`);
  }
  writePosition(book, {
    ...current,
    [fromKey]: current[fromKey] - quantity,
    [toKey]: current[toKey] + quantity,
  });
  book[fromKey] -= quantity;
  book[toKey] += quantity;
}

function liveKey(classification: LiveSupplyClass): 'circulating' | 'locked' | 'escrowed' | 'feeReserved' {
  switch (classification) {
    case 'CIRCULATING':
      return 'circulating';
    case 'LOCKED':
      return 'locked';
    case 'ESCROWED':
      return 'escrowed';
    case 'FEE_RESERVED':
      return 'feeReserved';
  }
}

export function lockClassToLive(lockClass: NativeLockClass): LiveSupplyClass {
  return lockClass === 'MACHINE_ESCROW' || lockClass === 'INTEROP_ESCROW' ? 'ESCROWED' : 'LOCKED';
}

export function assertNoDoubleCount(classification: string): void {
  const isSource = (SOURCE_SUPPLY_CLASSES as readonly string[]).includes(classification);
  const isLive = (LIVE_SUPPLY_CLASSES as readonly string[]).includes(classification);
  if (isSource && isLive) {
    throw new TypeError('supply classification cannot be both source and live');
  }
}

export function requireAssetBook(
  books: Readonly<Record<NativeMonetaryAssetId, AssetSupplyBook>>,
  assetId: string,
): AssetSupplyBook {
  return books[requireKnownAsset(assetId)];
}

export function sourceClassOf(kind: 'genesis' | 'post-genesis'): SourceSupplyClass {
  return kind === 'genesis' ? 'GENESIS_ALLOCATED' : 'ISSUED_POST_GENESIS';
}
