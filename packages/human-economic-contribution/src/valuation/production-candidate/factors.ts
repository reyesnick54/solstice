/**
 * Production-candidate factor policy.
 *
 * Reuses the existing human valuation factor identifiers and exact
 * rational / basis-point arithmetic. Does not create a parallel factor
 * engine or opaque model multipliers.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';

import {
  FORBIDDEN_PERSON_LEVEL_MULTIPLIERS,
  valuationCandidateFailure,
  type NumericPolicyValue,
  type ProductionCandidateValuationFailure,
} from './types.ts';

/** Exact names from the existing valuation factor architecture. */
export const PERMITTED_PRODUCTION_CANDIDATE_FACTORS = [
  'VERIFICATION_QUALITY',
  'REALIZATION',
  'RIGHTS_SCOPE',
  'USAGE_SCOPE',
  'OUTCOME_ATTRIBUTION',
  'FRESHNESS',
  'CONTRACTUAL_TERM',
  'JURISDICTION_POLICY',
] as const;
export type PermittedValuationFactor = (typeof PERMITTED_PRODUCTION_CANDIDATE_FACTORS)[number];

export const ROUNDING_RULES = ['FLOOR', 'CEILING', 'NEAREST_EVEN'] as const;
export type ProductionCandidateRoundingRule = (typeof ROUNDING_RULES)[number];

export const BASIS_POINTS_PER_UNIT = 10_000n;

export type IntegerBasisPoints = {
  readonly kind: 'BASIS_POINTS';
  readonly points: NumericPolicyValue;
};

export type RationalMultiplier = {
  readonly kind: 'RATIONAL';
  readonly numerator: NumericPolicyValue;
  readonly denominator: NumericPolicyValue;
};

export type ProductionCandidateFactorRule = {
  readonly factor: PermittedValuationFactor | string;
  readonly multiplier: IntegerBasisPoints | RationalMultiplier;
  readonly roundingRule: ProductionCandidateRoundingRule;
};

export function isPermittedProductionCandidateFactor(value: string): value is PermittedValuationFactor {
  return (PERMITTED_PRODUCTION_CANDIDATE_FACTORS as readonly string[]).includes(value);
}

export function isForbiddenPersonLevelMultiplier(value: string): boolean {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
  return (FORBIDDEN_PERSON_LEVEL_MULTIPLIERS as readonly string[]).includes(normalized) ||
    normalized.includes('CELEBRITY') ||
    normalized.includes('NET_WORTH') ||
    normalized.includes('FOLLOWER') ||
    normalized.includes('CREDITWORTH') ||
    normalized.includes('PRESTIGE') ||
    normalized.includes('DESIRABILITY') ||
    (normalized.includes('INCOME') && normalized.includes('MULTIPLIER')) ||
    (normalized.includes('CITIZENSHIP') && normalized.includes('DESIRABILITY'));
}

export function factorValuesConfigured(rule: ProductionCandidateFactorRule): boolean {
  if (rule.multiplier.kind === 'BASIS_POINTS') {
    return rule.multiplier.points.status === 'CONFIGURED';
  }
  return rule.multiplier.numerator.status === 'CONFIGURED' && rule.multiplier.denominator.status === 'CONFIGURED';
}

export function validateFactorRule(
  rule: ProductionCandidateFactorRule,
): Result<true, ProductionCandidateValuationFailure> {
  if (isForbiddenPersonLevelMultiplier(rule.factor)) {
    return err(
      valuationCandidateFailure(
        'PERSON_LEVEL_MULTIPLIER_FORBIDDEN',
        `person-level multiplier '${rule.factor}' is forbidden; valuation is event-specific`,
      ),
    );
  }
  if (!isPermittedProductionCandidateFactor(rule.factor)) {
    return err(
      valuationCandidateFailure(
        'PERSON_LEVEL_MULTIPLIER_FORBIDDEN',
        `factor '${rule.factor}' is not a permitted contribution-event factor`,
      ),
    );
  }
  if (rule.multiplier.kind === 'RATIONAL') {
    if (
      rule.multiplier.denominator.status === 'CONFIGURED' &&
      rule.multiplier.denominator.value === 0n
    ) {
      return err(valuationCandidateFailure('ZERO_DENOMINATOR', 'factor denominator cannot be zero'));
    }
    if (
      (rule.multiplier.numerator.status === 'CONFIGURED' && typeof rule.multiplier.numerator.value !== 'bigint') ||
      (rule.multiplier.denominator.status === 'CONFIGURED' && typeof rule.multiplier.denominator.value !== 'bigint')
    ) {
      return err(valuationCandidateFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'factor rationals must be bigint'));
    }
  } else if (
    rule.multiplier.points.status === 'CONFIGURED' &&
    typeof rule.multiplier.points.value !== 'bigint'
  ) {
    return err(valuationCandidateFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'basis-point multipliers must be bigint'));
  }
  return ok(true);
}

export function applyConfiguredFactor(
  amount: bigint,
  rule: ProductionCandidateFactorRule,
): Result<bigint, ProductionCandidateValuationFailure> {
  if (typeof amount !== 'bigint') {
    return err(valuationCandidateFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'factor application admits only bigint amounts'));
  }
  const checked = validateFactorRule(rule);
  if (!checked.ok) {
    return checked;
  }
  if (!factorValuesConfigured(rule)) {
    return err(valuationCandidateFailure('VALUES_UNCONFIGURED', `factor '${rule.factor}' numeric values are unconfigured`));
  }
  let numerator: bigint;
  let denominator: bigint;
  if (rule.multiplier.kind === 'BASIS_POINTS') {
    numerator = amount * rule.multiplier.points.value!;
    denominator = BASIS_POINTS_PER_UNIT;
  } else {
    numerator = amount * rule.multiplier.numerator.value!;
    denominator = rule.multiplier.denominator.value!;
  }
  return ok(divideRounded(numerator, denominator, rule.roundingRule));
}

export function divideRounded(
  numerator: bigint,
  denominator: bigint,
  rounding: ProductionCandidateRoundingRule,
): bigint {
  if (denominator === 0n) {
    throw new TypeError('rounding denominator must be non-zero');
  }
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
