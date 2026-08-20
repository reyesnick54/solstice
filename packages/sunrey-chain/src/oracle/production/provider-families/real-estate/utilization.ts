import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { quantitiesEqual } from '../../../../units/quantity.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import type { NormalizedRealEstateObservation, RealEstateRefusal, UtilizationEvidence } from './types.ts';

export function evaluateUtilization(input: {
  readonly actual: NormalizedRealEstateObservation;
  readonly capacity: NormalizedRealEstateObservation;
}): Result<UtilizationEvidence, RealEstateRefusal> {
  if (!input.actual.createsUsageEvent || !input.capacity.createsCapacityReference) {
    return err({
      code: 'UTILIZATION_DIMENSION_MISMATCH',
      detail: 'utilization requires realized use over a governed capacity basis',
    });
  }
  if (input.actual.canonicalQuantity.unitId === input.capacity.canonicalQuantity.unitId) {
    return computeRatio(input.actual.canonicalQuantity, input.capacity.canonicalQuantity);
  }
  if (input.actual.areaMantissa <= 0n || input.capacity.areaMantissa <= 0n) {
    return err({
      code: 'UTILIZATION_DENOMINATOR_INVENTED',
      detail: 'utilization cannot invent a missing capacity denominator',
    });
  }
  if (input.actual.identityRefs.spaceRef !== input.capacity.identityRefs.spaceRef) {
    return err({
      code: 'UTILIZATION_IDENTITY_MISMATCH',
      detail: 'utilization requires the same space identity',
    });
  }
  if (input.actual.identityRefs.propertyRef !== input.capacity.identityRefs.propertyRef) {
    return err({
      code: 'UTILIZATION_IDENTITY_MISMATCH',
      detail: 'utilization requires the same property identity',
    });
  }
  if (
    input.actual.sourceQuantity.unitId !== 'm2_hour'
    || input.capacity.canonicalUnit === 'm2' && input.actual.durationSeconds <= 0n
  ) {
    return err({
      code: 'UTILIZATION_DIMENSION_MISMATCH',
      detail: 'area-time usage cannot be divided by a missing or incompatible capacity basis',
    });
  }
  if (input.capacity.canonicalUnit === 'm2') {
    const comparableCapacity = {
      ...input.capacity.canonicalQuantity,
      mantissa: input.capacity.areaMantissa * input.actual.durationSeconds,
      unitId: 'm2_s',
    };
    const comparableActual = {
      ...input.actual.canonicalQuantity,
      mantissa: input.actual.areaMantissa * input.actual.durationSeconds,
      unitId: 'm2_s',
    };
    return computeRatio(comparableActual, comparableCapacity);
  }
  return err({
    code: 'UTILIZATION_DIMENSION_MISMATCH',
    detail: 'utilization dimensions are not compatible',
  });
}

function computeRatio(actual: ExactQuantity, capacity: ExactQuantity): Result<UtilizationEvidence, RealEstateRefusal> {
  if (capacity.mantissa === 0n) {
    return err({
      code: 'UTILIZATION_DENOMINATOR_INVENTED',
      detail: 'zero capacity is not a governed utilization denominator',
    });
  }
  return ok(
    Object.freeze({
      actual,
      capacityBasis: capacity,
      ratioNumerator: actual.mantissa * capacity.denominator * actual.numerator * capacity.denominator,
      ratioDenominator: capacity.mantissa * actual.denominator * capacity.numerator * actual.denominator,
      inventedDenominator: false,
    }),
  );
}

export function refuseInventedDenominator(): Result<never, RealEstateRefusal> {
  return err({
    code: 'UTILIZATION_DENOMINATOR_INVENTED',
    detail: 'utilization cannot invent a capacity denominator',
  });
}

export function refuseStaleUtilization(nowUnix: bigint, observedUnix: bigint, maxAge: number): Result<true, RealEstateRefusal> {
  if (nowUnix - observedUnix > BigInt(maxAge)) {
    return err({
      code: 'STALE_UTILIZATION',
      detail: 'utilization evidence is older than the governed freshness window',
    });
  }
  return ok(true);
}

export function utilizationQuantitiesMatch(left: ExactQuantity, right: ExactQuantity): boolean {
  return quantitiesEqual(left, right);
}
