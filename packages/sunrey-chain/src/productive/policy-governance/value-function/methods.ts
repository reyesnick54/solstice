/**
 * Exact Productive Value Function arithmetic.
 *
 * Bigint / exact-rational only. Factor domains are bounded. Composition
 * order is explicit. This is policy-validation math, not a valuation
 * engine and not a mint.
 */

import { mulDiv } from '../../formula.ts';
import type { RoundingMode } from '../../types.ts';
import {
  ATTRIBUTION_SHARE_SCALE,
  VALUE_FACTOR_SCALE,
  valueFunctionOk,
  valueFunctionRefuse,
  type ExactRational,
  type ValueFactorDefinition,
  type ValueFactorType,
  type ValueFunctionResult,
} from './types.ts';

export function assertExactInteger(value: unknown, label: string): ValueFunctionResult<bigint> {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return valueFunctionRefuse('FLOAT_MATH_FORBIDDEN', `${label} must be bigint, not number/float`);
  }
  if (typeof value !== 'bigint') {
    return valueFunctionRefuse('FLOAT_MATH_FORBIDDEN', `${label} must be bigint`);
  }
  return valueFunctionOk(value);
}

export function assertExactRational(share: ExactRational, label: string): ValueFunctionResult<ExactRational> {
  const numerator = assertExactInteger(share.numerator, `${label}.numerator`);
  if (!numerator.ok) {
    return numerator;
  }
  const denominator = assertExactInteger(share.denominator, `${label}.denominator`);
  if (!denominator.ok) {
    return denominator;
  }
  if (share.denominator <= 0n) {
    return valueFunctionRefuse('ATTRIBUTION_SHARE_INVALID', `${label} denominator must be positive`);
  }
  if (share.numerator < 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', `${label} numerator must be non-negative`);
  }
  if (share.numerator > share.denominator) {
    return valueFunctionRefuse('ATTRIBUTION_SHARE_UNBOUNDED', `${label} cannot exceed 1`);
  }
  return valueFunctionOk(Object.freeze({ numerator: share.numerator, denominator: share.denominator }));
}

export function rationalToScale(share: ExactRational, scale: bigint, rounding: RoundingMode): ValueFunctionResult<bigint> {
  const checked = assertExactRational(share, 'rational');
  if (!checked.ok) {
    return checked;
  }
  return valueFunctionOk(mulDiv(scale, share.numerator, share.denominator, rounding));
}

export function boundFactorValue(
  definition: ValueFactorDefinition,
  value: bigint,
): ValueFunctionResult<bigint> {
  const exact = assertExactInteger(value, definition.factorId);
  if (!exact.ok) {
    return exact;
  }
  if (definition.minimum < 0n && value < 0n && definition.minimum === 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', `${definition.factorId} does not define a negative domain`);
  }
  if (value < 0n && definition.minimum >= 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', `${definition.factorId} does not define a negative domain`);
  }
  if (value < definition.minimum || value > definition.maximum) {
    return valueFunctionRefuse(
      'FACTOR_OUT_OF_BOUNDS',
      `${definition.factorId} ${value.toString()} outside [${definition.minimum.toString()}, ${definition.maximum.toString()}]`,
    );
  }
  if (definition.maximum - definition.minimum < 0n) {
    return valueFunctionRefuse('UNBOUNDED_FACTOR', `${definition.factorId} has an inverted domain`);
  }
  return valueFunctionOk(value);
}

export function rejectUnboundedMultiplier(numerator: bigint, denominator: bigint, cap: bigint): ValueFunctionResult<true> {
  if (denominator <= 0n) {
    return valueFunctionRefuse('UNBOUNDED_FACTOR', 'multiplier denominator must be positive');
  }
  if (numerator < 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', 'negative multipliers are undefined');
  }
  if (numerator > cap) {
    return valueFunctionRefuse('UNBOUNDED_FACTOR', `multiplier numerator ${numerator.toString()} exceeds cap ${cap.toString()}`);
  }
  return valueFunctionOk(true);
}

export function utilizationRatio(
  actual: bigint,
  governedBasis: bigint,
  rounding: RoundingMode,
): ValueFunctionResult<bigint> {
  const actualOk = assertExactInteger(actual, 'utilization.actual');
  if (!actualOk.ok) {
    return actualOk;
  }
  const basisOk = assertExactInteger(governedBasis, 'utilization.basis');
  if (!basisOk.ok) {
    return basisOk;
  }
  if (actual < 0n || governedBasis < 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', 'utilization inputs must be non-negative');
  }
  if (governedBasis === 0n) {
    return valueFunctionRefuse('UTILIZATION_DIVIDE_BY_ZERO', 'governed capacity basis cannot be zero');
  }
  if (actual > governedBasis) {
    return valueFunctionOk(VALUE_FACTOR_SCALE);
  }
  return valueFunctionOk(mulDiv(VALUE_FACTOR_SCALE, actual, governedBasis, rounding));
}

export function attributionShareFactor(
  share: ExactRational,
  rounding: RoundingMode,
): ValueFunctionResult<bigint> {
  const scaled = rationalToScale(share, ATTRIBUTION_SHARE_SCALE, rounding);
  if (!scaled.ok) {
    return scaled;
  }
  if (scaled.value > ATTRIBUTION_SHARE_SCALE) {
    return valueFunctionRefuse('ATTRIBUTION_SHARE_UNBOUNDED', 'attribution share cannot exceed the event basis');
  }
  return scaled;
}

export type OrderedFactorApplication = {
  readonly factorType: ValueFactorType;
  readonly value: bigint;
};

export function composeFactors(
  ordered: readonly OrderedFactorApplication[],
  expectedOrder: readonly ValueFactorType[],
  floor: bigint,
  ceiling: bigint,
  rounding: RoundingMode,
): ValueFunctionResult<bigint> {
  if (ordered.length !== expectedOrder.length) {
    return valueFunctionRefuse('FACTOR_ORDER_NONDETERMINISTIC', 'composed factors must match the explicit policy order');
  }
  for (const [index, factor] of ordered.entries()) {
    if (factor.factorType !== expectedOrder[index]) {
      return valueFunctionRefuse(
        'FACTOR_ORDER_NONDETERMINISTIC',
        `factor order mismatch at ${String(index)}: expected ${expectedOrder[index]}, got ${factor.factorType}`,
      );
    }
    const exact = assertExactInteger(factor.value, factor.factorType);
    if (!exact.ok) {
      return exact;
    }
  }
  let acc = VALUE_FACTOR_SCALE;
  for (const factor of ordered) {
    acc = mulDiv(acc, factor.value, VALUE_FACTOR_SCALE, rounding);
  }
  if (acc < floor) {
    acc = floor;
  }
  if (acc > ceiling) {
    acc = ceiling;
  }
  return valueFunctionOk(acc);
}

export function applyAttributionToBasis(
  eventBasis: bigint,
  share: ExactRational,
  rounding: RoundingMode,
): ValueFunctionResult<bigint> {
  const basis = assertExactInteger(eventBasis, 'eventBasis');
  if (!basis.ok) {
    return basis;
  }
  const shareOk = assertExactRational(share, 'attributionShare');
  if (!shareOk.ok) {
    return shareOk;
  }
  return valueFunctionOk(mulDiv(eventBasis, share.numerator, share.denominator, rounding));
}

export function qualityToBoundedFactor(
  quality: bigint,
  maxQuality: bigint,
  rounding: RoundingMode,
): ValueFunctionResult<bigint> {
  const qualityOk = assertExactInteger(quality, 'quality');
  if (!qualityOk.ok) {
    return qualityOk;
  }
  const maxOk = assertExactInteger(maxQuality, 'maxQuality');
  if (!maxOk.ok) {
    return maxOk;
  }
  if (maxQuality <= 0n) {
    return valueFunctionRefuse('UNBOUNDED_FACTOR', 'quality maximum must be positive');
  }
  if (quality < 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', 'quality cannot be negative');
  }
  const capped = quality > maxQuality ? maxQuality : quality;
  return valueFunctionOk(mulDiv(VALUE_FACTOR_SCALE, capped, maxQuality, rounding));
}

export function freshnessToBoundedFactor(
  ageEpochs: bigint,
  maxAgeEpochs: bigint,
  rounding: RoundingMode,
): ValueFunctionResult<bigint> {
  const ageOk = assertExactInteger(ageEpochs, 'ageEpochs');
  if (!ageOk.ok) {
    return ageOk;
  }
  const maxOk = assertExactInteger(maxAgeEpochs, 'maxAgeEpochs');
  if (!maxOk.ok) {
    return maxOk;
  }
  if (maxAgeEpochs <= 0n) {
    return valueFunctionRefuse('UNBOUNDED_FACTOR', 'policy maximum age must be positive');
  }
  if (ageEpochs < 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', 'age cannot be negative');
  }
  if (ageEpochs > maxAgeEpochs) {
    return valueFunctionOk(0n);
  }
  const remaining = maxAgeEpochs - ageEpochs;
  return valueFunctionOk(mulDiv(VALUE_FACTOR_SCALE, remaining, maxAgeEpochs, rounding));
}
