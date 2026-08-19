import { err, ok, type Result } from '../../../domain/src/result.ts';
import { valuationFailure, type ValuationFailure } from './types.ts';

export const PERMITTED_VALUATION_FACTORS = [
  'VERIFICATION_QUALITY',
  'REALIZATION',
  'RIGHTS_SCOPE',
  'USAGE_SCOPE',
  'OUTCOME_ATTRIBUTION',
  'REFERENCE_MARKET',
  'FRESHNESS',
  'CONTRACTUAL_TERM',
  'JURISDICTION_POLICY',
] as const;
export type PermittedValuationFactor = (typeof PERMITTED_VALUATION_FACTORS)[number];

export const FORBIDDEN_VALUATION_FACTORS = [
  'PERSON_QUALITY',
  'PERSON_DESIRABILITY',
  'SOCIAL_STATUS',
  'WEALTH',
  'DEMOGRAPHIC_VALUE',
] as const;
export type ForbiddenValuationFactor = (typeof FORBIDDEN_VALUATION_FACTORS)[number];

export const BASIS_POINTS_PER_UNIT = 10_000n;

export type IntegerBasisPoints = {
  readonly kind: 'BASIS_POINTS';
  readonly points: bigint;
};

export type RationalMultiplier = {
  readonly kind: 'RATIONAL';
  readonly numerator: bigint;
  readonly denominator: bigint;
};

export type ValuationMultiplier = IntegerBasisPoints | RationalMultiplier;

export type ValuationFactorRule = {
  readonly factor: PermittedValuationFactor;
  readonly multiplier: ValuationMultiplier;
};

export const ROUNDING_RULES = ['FLOOR', 'CEILING', 'HALF_EVEN'] as const;
export type RoundingRule = (typeof ROUNDING_RULES)[number];

export function isPermittedValuationFactor(value: string): value is PermittedValuationFactor {
  return (PERMITTED_VALUATION_FACTORS as readonly string[]).includes(value);
}

export function isForbiddenValuationFactor(value: string): value is ForbiddenValuationFactor {
  return (FORBIDDEN_VALUATION_FACTORS as readonly string[]).includes(value);
}

export function assertIntegerMultiplier(multiplier: ValuationMultiplier): Result<true, ValuationFailure> {
  if (multiplier.kind === 'BASIS_POINTS') {
    if (typeof multiplier.points !== 'bigint') {
      return err(valuationFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'basis-point multipliers must be bigint'));
    }
    return ok(true);
  }
  if (typeof multiplier.numerator !== 'bigint' || typeof multiplier.denominator !== 'bigint') {
    return err(valuationFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'rational multipliers must be bigint numerator/denominator'));
  }
  if (multiplier.denominator === 0n) {
    return err(valuationFailure('INVALID_POLICY', 'rational multiplier denominator cannot be zero'));
  }
  return ok(true);
}

export function applyMultiplier(amount: bigint, multiplier: ValuationMultiplier, rounding: RoundingRule): Result<bigint, ValuationFailure> {
  if (typeof amount !== 'bigint') {
    return err(valuationFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'factor application admits only bigint amounts'));
  }
  const checked = assertIntegerMultiplier(multiplier);
  if (!checked.ok) {
    return checked;
  }
  const numerator = multiplier.kind === 'BASIS_POINTS' ? amount * multiplier.points : amount * multiplier.numerator;
  const denominator = multiplier.kind === 'BASIS_POINTS' ? BASIS_POINTS_PER_UNIT : multiplier.denominator;
  return ok(divideRounded(numerator, denominator, rounding));
}

function divideRounded(numerator: bigint, denominator: bigint, rounding: RoundingRule): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) {
    return quotient;
  }
  if (rounding === 'FLOOR') {
    return numerator >= 0n ? quotient : quotient - 1n;
  }
  if (rounding === 'CEILING') {
    return numerator >= 0n ? quotient + 1n : quotient;
  }
  const twice = remainder < 0n ? remainder * -2n : remainder * 2n;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  if (twice > absDenominator) {
    return numerator >= 0n ? quotient + 1n : quotient - 1n;
  }
  if (twice < absDenominator) {
    return quotient;
  }
  return quotient % 2n === 0n ? quotient : numerator >= 0n ? quotient + 1n : quotient - 1n;
}

export function assertFactorRule(rule: ValuationFactorRule): Result<true, ValuationFailure> {
  if (isForbiddenValuationFactor(rule.factor)) {
    return err(valuationFailure('FORBIDDEN_VALUATION_FACTOR', `factor '${rule.factor}' is a forbidden person-level factor`));
  }
  if (!isPermittedValuationFactor(rule.factor)) {
    return err(valuationFailure('FORBIDDEN_VALUATION_FACTOR', `factor '${rule.factor}' is not a permitted contribution-level factor`));
  }
  return assertIntegerMultiplier(rule.multiplier);
}
