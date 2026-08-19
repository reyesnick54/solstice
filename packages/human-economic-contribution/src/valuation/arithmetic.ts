/**
 * Exact valuation arithmetic. Economic values are bigint minor units.
 * Factors use basis points or integer rationals. Floating point is forbidden.
 */

export const BASIS_POINTS_PER_UNIT = 10_000n;
export const MAX_REFERENCE_MINOR_UNITS = 10n ** 24n;

export const ROUNDING_RULES = ['ROUND_DOWN', 'ROUND_HALF_UP'] as const;
export type RoundingRule = (typeof ROUNDING_RULES)[number];

export type ExactRational = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

export class ValuationArithmeticError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ValuationArithmeticError';
    this.code = code;
  }
}

function assertBigint(value: bigint, label: string): void {
  if (typeof value !== 'bigint') {
    throw new ValuationArithmeticError('FLOATING_POINT_FORBIDDEN', `${label} must be bigint; floating point is forbidden`);
  }
}

export function assertBounded(value: bigint, label: string): bigint {
  assertBigint(value, label);
  const abs = value < 0n ? -value : value;
  if (abs > MAX_REFERENCE_MINOR_UNITS) {
    throw new ValuationArithmeticError('INTEGER_OVERFLOW', `${label} exceeds the simulation overflow bound`);
  }
  return value;
}

export function gcd(left: bigint, right: bigint): bigint {
  assertBigint(left, 'gcd.left');
  assertBigint(right, 'gcd.right');
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

export function reduceRational(numerator: bigint, denominator: bigint): ExactRational {
  assertBigint(numerator, 'numerator');
  assertBigint(denominator, 'denominator');
  if (denominator === 0n) {
    throw new ValuationArithmeticError('ZERO_DENOMINATOR', 'rational denominator must be non-zero');
  }
  const divisor = gcd(numerator, denominator);
  let nextNumerator = numerator / divisor;
  let nextDenominator = denominator / divisor;
  if (nextDenominator < 0n) {
    nextNumerator = -nextNumerator;
    nextDenominator = -nextDenominator;
  }
  return Object.freeze({ numerator: nextNumerator, denominator: nextDenominator });
}

export function roundQuotient(numerator: bigint, denominator: bigint, rule: RoundingRule): bigint {
  assertBigint(numerator, 'round.numerator');
  assertBigint(denominator, 'round.denominator');
  if (denominator === 0n) {
    throw new ValuationArithmeticError('ZERO_DENOMINATOR', 'rounding denominator must be non-zero');
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) {
    return assertBounded(quotient, 'rounded quotient');
  }
  if (rule === 'ROUND_DOWN') {
    return assertBounded(quotient, 'rounded quotient');
  }
  const absRemainder = remainder < 0n ? -remainder : remainder;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  if (absRemainder * 2n >= absDenominator) {
    const step = numerator < 0n !== denominator < 0n ? -1n : 1n;
    return assertBounded(quotient + step, 'rounded quotient');
  }
  return assertBounded(quotient, 'rounded quotient');
}

export function multiplyRational(
  value: bigint,
  numerator: bigint,
  denominator: bigint,
  rule: RoundingRule,
): bigint {
  assertBounded(value, 'multiplicand');
  assertBounded(numerator, 'rational numerator');
  assertBounded(denominator, 'rational denominator');
  if (denominator === 0n) {
    throw new ValuationArithmeticError('ZERO_DENOMINATOR', 'rational denominator must be non-zero');
  }
  return roundQuotient(value * numerator, denominator, rule);
}

export function multiplyBasisPoints(value: bigint, basisPoints: bigint, rule: RoundingRule): bigint {
  return multiplyRational(value, basisPoints, BASIS_POINTS_PER_UNIT, rule);
}

export function applyCap(value: bigint, cap: bigint): { readonly value: bigint; readonly applied: boolean } {
  assertBounded(value, 'cap.value');
  assertBounded(cap, 'cap.limit');
  if (value > cap) {
    return Object.freeze({ value: cap, applied: true });
  }
  return Object.freeze({ value, applied: false });
}

export function applyFloor(value: bigint, floor: bigint): { readonly value: bigint; readonly applied: boolean } {
  assertBounded(value, 'floor.value');
  assertBounded(floor, 'floor.limit');
  if (value < floor) {
    return Object.freeze({ value: floor, applied: true });
  }
  return Object.freeze({ value, applied: false });
}

export function rejectNegative(value: bigint, permitted: boolean): bigint {
  assertBounded(value, 'signed value');
  if (value < 0n && !permitted) {
    throw new ValuationArithmeticError('NEGATIVE_VALUE_FORBIDDEN', 'negative valuation is not permitted by policy');
  }
  return value;
}

export function isRoundingRule(value: string): value is RoundingRule {
  return (ROUNDING_RULES as readonly string[]).includes(value);
}
