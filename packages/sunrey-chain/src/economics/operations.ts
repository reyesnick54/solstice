/**
 * Transfer, lock, escrow, fee-reserve, and burn operations on the
 * monetary supply book. Validator misconduct never burns unrelated
 * customer assets.
 */

import { cloneBook } from './issuance.ts';
import { debitCirculating, lockClassToLive, moveLive, type AssetSupplyBook } from './supply.ts';
import type { BurnClass, NativeLockClass } from './types.ts';

export type BurnRejection =
  | 'UNAUTHORIZED_BURN_CLASS'
  | 'VALIDATOR_MISCONDUCT_CUSTOMER_BURN_FORBIDDEN'
  | 'INSUFFICIENT_CIRCULATING';

export type BurnResult =
  | { readonly ok: true; readonly book: AssetSupplyBook }
  | { readonly ok: false; readonly code: BurnRejection };

const ACTIVE_BURN_CLASSES: readonly BurnClass[] = [
  'VOLUNTARY_USER_BURN',
  'FEE_BURN',
  'PROTOCOL_ECONOMIC_PENALTY',
];

export function transfer(
  book: AssetSupplyBook,
  from: string,
  to: string,
  quantity: bigint,
): AssetSupplyBook {
  if (from === to) {
    throw new TypeError('self-transfer rejected');
  }
  const next = cloneBook(book);
  debitCirculating(next, from, quantity);
  const recipient = next.positions.get(to) ?? {
    account: to,
    circulating: 0n,
    locked: 0n,
    escrowed: 0n,
    feeReserved: 0n,
  };
  next.positions.set(
    to,
    Object.freeze({ ...recipient, circulating: recipient.circulating + quantity }),
  );
  next.circulating += quantity;
  return next;
}

export function lock(
  book: AssetSupplyBook,
  account: string,
  lockId: string,
  quantity: bigint,
  lockClass: NativeLockClass,
): AssetSupplyBook {
  if (book.locks.has(lockId)) {
    throw new TypeError('duplicate lock id');
  }
  const next = cloneBook(book);
  const live = lockClassToLive(lockClass);
  moveLive(next, account, 'CIRCULATING', live, quantity);
  next.locks.set(
    lockId,
    Object.freeze({
      lockId,
      account,
      assetId: book.assetId,
      quantity,
      lockClass,
      active: true,
    }),
  );
  return next;
}

export function unlock(book: AssetSupplyBook, lockId: string): AssetSupplyBook {
  const existing = book.locks.get(lockId);
  if (!existing || !existing.active) {
    throw new TypeError('lock not found');
  }
  const next = cloneBook(book);
  const live = lockClassToLive(existing.lockClass);
  moveLive(next, existing.account, live, 'CIRCULATING', existing.quantity);
  next.locks.set(lockId, Object.freeze({ ...existing, active: false }));
  return next;
}

export function reserveFee(book: AssetSupplyBook, account: string, quantity: bigint): AssetSupplyBook {
  const next = cloneBook(book);
  moveLive(next, account, 'CIRCULATING', 'FEE_RESERVED', quantity);
  return next;
}

export function releaseFeeReserve(book: AssetSupplyBook, account: string, quantity: bigint): AssetSupplyBook {
  const next = cloneBook(book);
  moveLive(next, account, 'FEE_RESERVED', 'CIRCULATING', quantity);
  return next;
}

export function burn(
  book: AssetSupplyBook,
  account: string,
  quantity: bigint,
  burnClass: BurnClass,
  options?: { readonly validatorMisconduct?: boolean; readonly unrelatedCustomer?: boolean },
): BurnResult {
  if (!ACTIVE_BURN_CLASSES.includes(burnClass)) {
    return { ok: false, code: 'UNAUTHORIZED_BURN_CLASS' };
  }
  if (options?.validatorMisconduct && options.unrelatedCustomer) {
    return { ok: false, code: 'VALIDATOR_MISCONDUCT_CUSTOMER_BURN_FORBIDDEN' };
  }
  try {
    const next = cloneBook(book);
    debitCirculating(next, account, quantity);
    next.burned += quantity;
    return { ok: true, book: next };
  } catch {
    return { ok: false, code: 'INSUFFICIENT_CIRCULATING' };
  }
}

export function burnReservedFee(book: AssetSupplyBook, account: string, quantity: bigint): BurnResult {
  try {
    const next = cloneBook(book);
    moveLive(next, account, 'FEE_RESERVED', 'CIRCULATING', quantity);
    debitCirculating(next, account, quantity);
    next.burned += quantity;
    return { ok: true, book: next };
  } catch {
    return { ok: false, code: 'INSUFFICIENT_CIRCULATING' };
  }
}
