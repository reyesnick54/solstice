/**
 * Post-mutation integrity validation for canonical order books.
 */

import type { BookIntegrityViolation } from './taxonomy.ts';
import type { BookIntegrityState, BookLevel, BookOrder } from './types.ts';

function isSortedBids(levels: readonly BookLevel[]): boolean {
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i - 1]!.priceMinorUnits < levels[i]!.priceMinorUnits) {
      return false;
    }
  }
  return true;
}

function isSortedAsks(levels: readonly BookLevel[]): boolean {
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i - 1]!.priceMinorUnits > levels[i]!.priceMinorUnits) {
      return false;
    }
  }
  return true;
}

export function validateBookIntegrity(input: {
  readonly orders: readonly BookOrder[];
  readonly bids: readonly BookLevel[];
  readonly asks: readonly BookLevel[];
  readonly executableBook: boolean;
  readonly extraViolations?: readonly BookIntegrityViolation[];
}): BookIntegrityState {
  const violations: BookIntegrityViolation[] = [...(input.extraViolations ?? [])];

  const seen = new Set<string>();
  for (const order of input.orders) {
    if (order.quantityMinorUnits < 0n) {
      violations.push('NEGATIVE_QUANTITY');
    }
    if (seen.has(order.orderId)) {
      violations.push('DUPLICATE_ORDER_ID');
    }
    seen.add(order.orderId);
  }

  for (const level of [...input.bids, ...input.asks]) {
    if (level.quantityMinorUnits < 0n) {
      violations.push('NEGATIVE_QUANTITY');
    }
  }

  if (!isSortedBids(input.bids)) {
    violations.push('BID_SORT_VIOLATION');
  }
  if (!isSortedAsks(input.asks)) {
    violations.push('ASK_SORT_VIOLATION');
  }

  const unique = Object.freeze([...new Set(violations)]);
  return Object.freeze({
    ok: unique.length === 0,
    violations: unique,
    executableBook: input.executableBook && unique.length === 0,
  });
}
