import { err, ok, type Result } from '../../domain/src/result.ts';

/**
 * Canonical investment quantity.
 *
 * Representation: bigint `units` at a fixed `scale`.
 * One whole share at the default scale is `10 ** QUANTITY_SCALE` units.
 *
 * Default scale is 8 (100_000_000 units = 1 share). This is a scale-based
 * integer, not a JavaScript number and not Money.
 *
 * Fractional shares are permitted only when the instrument allows them and
 * the quantity is a multiple of the instrument increment.
 */
export const QUANTITY_SCALE = 8 as const;

export type InvestmentQuantity = {
  readonly units: bigint;
  readonly scale: typeof QUANTITY_SCALE;
};

export type QuantityFailure = {
  readonly code:
    | 'FLOATING_POINT_QUANTITY'
    | 'INVALID_QUANTITY'
    | 'NEGATIVE_QUANTITY'
    | 'SCALE_MISMATCH'
    | 'INCREMENT_VIOLATION';
  readonly message: string;
};

const INTEGER_RE = /^-?\d+$/;

export function quantityScaleFactor(): bigint {
  return 100_000_000n;
}

export function zeroQuantity(): InvestmentQuantity {
  return Object.freeze({ units: 0n, scale: QUANTITY_SCALE });
}

export function wholeShares(shares: bigint): Result<InvestmentQuantity, QuantityFailure> {
  if (shares < 0n) {
    return err({ code: 'NEGATIVE_QUANTITY', message: 'quantity cannot be negative' });
  }
  return ok(Object.freeze({ units: shares * quantityScaleFactor(), scale: QUANTITY_SCALE }));
}

/**
 * Parse a quantity from a decimal-free integer string of scaled units.
 * Rejects any floating-point or scientific notation input.
 */
export function quantityFromScaledString(value: string): Result<InvestmentQuantity, QuantityFailure> {
  if (typeof value !== 'string' || !INTEGER_RE.test(value)) {
    return err({
      code: 'FLOATING_POINT_QUANTITY',
      message: 'quantity must be a signed integer string of scaled units; floating-point is rejected',
    });
  }
  const units = BigInt(value);
  if (units < 0n) {
    return err({ code: 'NEGATIVE_QUANTITY', message: 'quantity cannot be negative' });
  }
  return ok(Object.freeze({ units, scale: QUANTITY_SCALE }));
}

export function quantityFromWholeString(value: string): Result<InvestmentQuantity, QuantityFailure> {
  if (typeof value !== 'string' || !INTEGER_RE.test(value)) {
    return err({
      code: 'FLOATING_POINT_QUANTITY',
      message: 'whole-share quantity must be an integer string; floating-point is rejected',
    });
  }
  return wholeShares(BigInt(value));
}

export function assertPositiveQuantity(
  quantity: InvestmentQuantity,
): Result<InvestmentQuantity, QuantityFailure> {
  if (quantity.scale !== QUANTITY_SCALE) {
    return err({ code: 'SCALE_MISMATCH', message: 'quantity scale must be 8' });
  }
  if (quantity.units <= 0n) {
    return err({ code: 'INVALID_QUANTITY', message: 'quantity must be greater than zero' });
  }
  return ok(quantity);
}

export function addQuantity(
  left: InvestmentQuantity,
  right: InvestmentQuantity,
): Result<InvestmentQuantity, QuantityFailure> {
  if (left.scale !== QUANTITY_SCALE || right.scale !== QUANTITY_SCALE) {
    return err({ code: 'SCALE_MISMATCH', message: 'quantity scale must be 8' });
  }
  return ok(Object.freeze({ units: left.units + right.units, scale: QUANTITY_SCALE }));
}

export function subtractQuantity(
  left: InvestmentQuantity,
  right: InvestmentQuantity,
): Result<InvestmentQuantity, QuantityFailure> {
  if (left.scale !== QUANTITY_SCALE || right.scale !== QUANTITY_SCALE) {
    return err({ code: 'SCALE_MISMATCH', message: 'quantity scale must be 8' });
  }
  if (left.units < right.units) {
    return err({ code: 'INVALID_QUANTITY', message: 'subtraction would make quantity negative' });
  }
  return ok(Object.freeze({ units: left.units - right.units, scale: QUANTITY_SCALE }));
}

export function quantityCmp(left: InvestmentQuantity, right: InvestmentQuantity): -1 | 0 | 1 {
  if (left.units < right.units) {
    return -1;
  }
  if (left.units > right.units) {
    return 1;
  }
  return 0;
}

export function quantityEquals(left: InvestmentQuantity, right: InvestmentQuantity): boolean {
  return left.units === right.units && left.scale === right.scale;
}

export function isMultipleOfIncrement(
  quantity: InvestmentQuantity,
  increment: InvestmentQuantity,
): boolean {
  if (increment.units <= 0n) {
    return false;
  }
  return quantity.units % increment.units === 0n;
}

export function serializeQuantity(quantity: InvestmentQuantity): {
  readonly units: string;
  readonly scale: typeof QUANTITY_SCALE;
} {
  return { units: quantity.units.toString(), scale: QUANTITY_SCALE };
}
