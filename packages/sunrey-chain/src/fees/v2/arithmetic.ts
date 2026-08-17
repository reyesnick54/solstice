/**
 * Chunk 73 — checked integer / fixed-point arithmetic.
 *
 * Consensus fee math never uses floating point. Overflow is a rejection,
 * not a wrap. Wall-clock duration is not a resource quantity.
 */

export const PROTOCOL_U128_MAX = (1n << 128n) - 1n;
export const WEIGHT_PRICE_SCALE = 1n;
export const UTILIZATION_BPS_DENOMINATOR = 10_000n;
export const BASIS_POINTS_DENOMINATOR = 10_000n;

export class FeeArithmeticError extends Error {
  readonly code = 'FEE_ARITHMETIC_OVERFLOW' as const;
  readonly label: string;
  constructor(label: string) {
    super(`${label} overflowed the protocol unsigned range`);
    this.name = 'FeeArithmeticError';
    this.label = label;
  }
}

export function assertNonNegative(value: bigint, label: string): void {
  if (value < 0n) {
    throw new TypeError(`${label} must be an unsigned integer`);
  }
}

export function checkedAdd(left: bigint, right: bigint, label: string): bigint {
  assertNonNegative(left, label);
  assertNonNegative(right, label);
  const sum = left + right;
  if (sum < left || sum > PROTOCOL_U128_MAX) {
    throw new FeeArithmeticError(label);
  }
  return sum;
}

export function checkedMul(left: bigint, right: bigint, label: string): bigint {
  assertNonNegative(left, label);
  assertNonNegative(right, label);
  if (left === 0n || right === 0n) {
    return 0n;
  }
  const product = left * right;
  if (product / left !== right || product > PROTOCOL_U128_MAX) {
    throw new FeeArithmeticError(label);
  }
  return product;
}

export function checkedDiv(numerator: bigint, denominator: bigint, label: string): bigint {
  assertNonNegative(numerator, label);
  if (denominator <= 0n) {
    throw new TypeError(`${label} division requires a positive denominator`);
  }
  return numerator / denominator;
}

export function saturatingSub(left: bigint, right: bigint): bigint {
  return left > right ? left - right : 0n;
}

export function minBig(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

export function maxBig(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

export function clampBig(value: bigint, min: bigint, max: bigint): bigint {
  if (min > max) {
    throw new TypeError('clamp bounds are inverted');
  }
  return minBig(maxBig(value, min), max);
}
