/**
 * L2 aggregation from L3 order sets — no hidden liquidity.
 */

import type { BookLevel, BookOrder } from './types.ts';
import type { BookSide } from './taxonomy.ts';

function sortLevels(levels: readonly BookLevel[], side: BookSide): readonly BookLevel[] {
  const sorted = [...levels].sort((a, b) => {
    if (a.priceMinorUnits === b.priceMinorUnits) return 0;
    if (side === 'bid') {
      return a.priceMinorUnits > b.priceMinorUnits ? -1 : 1;
    }
    return a.priceMinorUnits < b.priceMinorUnits ? -1 : 1;
  });
  return Object.freeze(sorted.map((row) => Object.freeze({ ...row })));
}

export function aggregateBookLevels(orders: readonly BookOrder[], side: BookSide): readonly BookLevel[] {
  const byPrice = new Map<string, { priceMinorUnits: bigint; quantityMinorUnits: bigint; orderCount: number }>();
  for (const order of orders) {
    if (order.side !== side) continue;
    if (order.quantityMinorUnits < 0n) continue;
    const key = order.priceMinorUnits.toString();
    const current = byPrice.get(key);
    if (current) {
      byPrice.set(key, {
        priceMinorUnits: order.priceMinorUnits,
        quantityMinorUnits: current.quantityMinorUnits + order.quantityMinorUnits,
        orderCount: current.orderCount + 1,
      });
    } else {
      byPrice.set(key, {
        priceMinorUnits: order.priceMinorUnits,
        quantityMinorUnits: order.quantityMinorUnits,
        orderCount: 1,
      });
    }
  }
  const levels: BookLevel[] = [];
  for (const row of byPrice.values()) {
    if (row.quantityMinorUnits > 0n) {
      levels.push(
        Object.freeze({
          priceMinorUnits: row.priceMinorUnits,
          quantityMinorUnits: row.quantityMinorUnits,
          orderCount: row.orderCount,
        }),
      );
    }
  }
  return sortLevels(levels, side);
}

export function levelsFromL2Seed(
  levels: readonly Pick<BookLevel, 'priceMinorUnits' | 'quantityMinorUnits'>[],
  side: BookSide,
): readonly BookLevel[] {
  const normalized: BookLevel[] = [];
  for (const row of levels) {
    if (row.quantityMinorUnits < 0n) continue;
    if (row.quantityMinorUnits === 0n) continue;
    normalized.push(
      Object.freeze({
        priceMinorUnits: row.priceMinorUnits,
        quantityMinorUnits: row.quantityMinorUnits,
        orderCount: 1,
      }),
    );
  }
  return sortLevels(normalized, side);
}
