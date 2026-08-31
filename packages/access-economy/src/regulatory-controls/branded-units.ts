/**
 * Strong typing boundary — Access units are not Money.
 *
 * Prevents accidental arithmetic such as "1 Mobility Day + $100" without
 * an explicit valuation/coverage context.
 */

import type { AccessCoverageMinorUnits, AccessUnitQuantity } from './types.ts';

/** Duck-type guard for Money-like fiat amounts — no import from packages/money. */
export type FiatMinorUnits = {
  readonly minorUnits: bigint;
  readonly currency: string;
};

export function isFiatMinorUnits(value: unknown): value is FiatMinorUnits {
  return (
    typeof value === 'object' &&
    value !== null &&
    'minorUnits' in value &&
    typeof (value as FiatMinorUnits).minorUnits === 'bigint' &&
    'currency' in value &&
    typeof (value as FiatMinorUnits).currency === 'string'
  );
}

export function accessUnits(value: bigint): AccessUnitQuantity {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new TypeError('AccessUnitQuantity requires a non-negative bigint');
  }
  return value as AccessUnitQuantity;
}

export function accessCoverageMinorUnits(value: bigint): AccessCoverageMinorUnits {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new TypeError('AccessCoverageMinorUnits requires a non-negative bigint');
  }
  return value as AccessCoverageMinorUnits;
}

export function assertNotMoneyAmount(value: unknown, label: string): void {
  if (isFiatMinorUnits(value)) {
    throw new TypeError(`${label} must not be a fiat Money amount; use explicit coverage context`);
  }
}

export function combineAccessUnits(
  left: AccessUnitQuantity,
  right: AccessUnitQuantity,
): AccessUnitQuantity {
  return accessUnits(left + right);
}

export function subtractAccessUnits(
  left: AccessUnitQuantity,
  right: AccessUnitQuantity,
): AccessUnitQuantity {
  const result = left - right;
  if (result < 0n) {
    throw new RangeError('Access unit subtraction would be negative');
  }
  return accessUnits(result);
}

/**
 * Explicit valuation context required to relate Access units to fiat coverage.
 * There is no canonical 1 SR = $X or 1 MR = $X rule.
 */
export type AccessCoverageValuationContext = {
  readonly accessUnits: AccessUnitQuantity;
  readonly coverageMinorUnits: AccessCoverageMinorUnits;
  readonly currency: string;
  readonly policyVersion: string;
  readonly tokenConversionContribution: 0n;
};

export function buildCoverageValuationContext(input: {
  readonly accessUnits: AccessUnitQuantity;
  readonly coverageMinorUnits: AccessCoverageMinorUnits;
  readonly currency: string;
  readonly policyVersion: string;
}): AccessCoverageValuationContext {
  return Object.freeze({
    accessUnits: input.accessUnits,
    coverageMinorUnits: input.coverageMinorUnits,
    currency: input.currency,
    policyVersion: input.policyVersion,
    tokenConversionContribution: 0n,
  });
}

export function forbidMixedArithmetic(
  accessUnitValue: AccessUnitQuantity,
  moneyValue: FiatMinorUnits,
): never {
  throw new TypeError(
    `cannot combine AccessUnitQuantity (${accessUnitValue}) with fiat minor units (${moneyValue.minorUnits} ${moneyValue.currency}) without an explicit AccessCoverageValuationContext`,
  );
}
