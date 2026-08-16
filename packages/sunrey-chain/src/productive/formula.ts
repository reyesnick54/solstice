import { WEIGHT_SCALE, type RoundingMode } from './types.ts';

export function mulDiv(value: bigint, numerator: bigint, denominator: bigint, rounding: RoundingMode): bigint {
  if (denominator <= 0n) {
    throw new TypeError('fixed-point denominator must be positive');
  }
  if (value < 0n || numerator < 0n) {
    throw new TypeError('fixed-point inputs must be non-negative');
  }
  const product = value * numerator;
  const quotient = product / denominator;
  const remainder = product % denominator;
  if (remainder === 0n) {
    return quotient;
  }
  if (rounding === 'FLOOR') {
    return quotient;
  }
  if (rounding === 'CEIL') {
    return quotient + 1n;
  }
  const twice = remainder * 2n;
  if (twice < denominator) {
    return quotient;
  }
  if (twice > denominator) {
    return quotient + 1n;
  }
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

export type FormulaInputs = {
  readonly eligibleQuantity: bigint;
  readonly categoryWeight: bigint;
  readonly claimTypeWeight: bigint;
  readonly qualityFactor: bigint;
  readonly roundingMode: RoundingMode;
  readonly maximumIssuance: bigint;
};

export type FormulaResult = {
  readonly formulaVersion: 'moonrey.issuance.formula.v1';
  readonly eligibleQuantity: bigint;
  readonly categoryWeight: bigint;
  readonly claimTypeWeight: bigint;
  readonly qualityFactor: bigint;
  readonly roundingMode: RoundingMode;
  readonly uncappedQuantity: bigint;
  readonly moonreyQuantity: bigint;
};

/**
 * eligible × category_weight × claim_factor × quality_factor
 * with explicit rounding at each scale division. No floating point.
 */
export function evaluateIssuanceFormula(input: FormulaInputs): FormulaResult {
  const afterCategory = mulDiv(input.eligibleQuantity, input.categoryWeight, WEIGHT_SCALE, input.roundingMode);
  const afterClaim = mulDiv(afterCategory, input.claimTypeWeight, WEIGHT_SCALE, input.roundingMode);
  const uncapped = mulDiv(afterClaim, input.qualityFactor, WEIGHT_SCALE, input.roundingMode);
  const moonreyQuantity = uncapped > input.maximumIssuance ? input.maximumIssuance : uncapped;
  return Object.freeze({
    formulaVersion: 'moonrey.issuance.formula.v1',
    eligibleQuantity: input.eligibleQuantity,
    categoryWeight: input.categoryWeight,
    claimTypeWeight: input.claimTypeWeight,
    qualityFactor: input.qualityFactor,
    roundingMode: input.roundingMode,
    uncappedQuantity: uncapped,
    moonreyQuantity,
  });
}
