/**
 * HELIOS OS03 — single price level on the simulated order book.
 */

export type BookLevel = {
  readonly priceMinorUnits: bigint;
  readonly sizeUnits: bigint;
};

export function bookLevel(priceMinorUnits: bigint, sizeUnits: bigint): BookLevel {
  return Object.freeze({ priceMinorUnits, sizeUnits });
}

export function consumeLevel(level: BookLevel, quantityUnits: bigint): {
  readonly filledUnits: bigint;
  readonly remainderLevel: BookLevel | null;
} {
  if (quantityUnits <= 0n) {
    return Object.freeze({ filledUnits: 0n, remainderLevel: level });
  }
  if (quantityUnits >= level.sizeUnits) {
    return Object.freeze({ filledUnits: level.sizeUnits, remainderLevel: null });
  }
  return Object.freeze({
    filledUnits: quantityUnits,
    remainderLevel: bookLevel(level.priceMinorUnits, level.sizeUnits - quantityUnits),
  });
}
