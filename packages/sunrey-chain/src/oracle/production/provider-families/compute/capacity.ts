/**
 * Capacity inventory and utilization.
 *
 * Installed GPU fleet (AI_COMPUTE_CAPACITY) is not realized
 * AI_INFERENCE_USAGE or AI_TRAINING_USAGE. Capacity inventory may
 * support utilization references. It does not create productive
 * issuance.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { lookupUnit } from '../../../../units/convert.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import {
  computeRefusal,
  type ComputeCapacityInventory,
  type ComputeRefusal,
  type ComputeSourceObservation,
  type ComputeUtilization,
} from './types.ts';

export function capacityDoesNotEqualUsage(capacityFact: string, usageFact: string): true {
  return capacityFact !== usageFact;
}

export function inventoryFrom(observation: ComputeSourceObservation): Result<ComputeCapacityInventory, ComputeRefusal> {
  if (observation.factType !== 'AI_COMPUTE_CAPACITY' && observation.factType !== 'COMPUTE_CAPACITY') {
    return err(computeRefusal('CAPACITY_IS_NOT_REALIZED_USAGE', `${observation.factType} is not a capacity inventory fact`));
  }
  if (!observation.capacity) {
    return err(computeRefusal('RESOURCE_COUNT_REQUIRED', 'capacity inventory requires resource class, count, and duration'));
  }
  if (observation.capacity.resourceCount <= 0n || observation.capacity.availableDurationSeconds <= 0n) {
    return err(computeRefusal('RESOURCE_COUNT_REQUIRED', 'capacity count and available duration must be positive integers'));
  }
  return ok(observation.capacity);
}

export function computeUtilization(input: {
  readonly actual: ExactQuantity;
  readonly capacity: ExactQuantity;
  readonly actualStart: bigint;
  readonly actualEnd: bigint;
  readonly capacityStart: bigint;
  readonly capacityEnd: bigint;
}): Result<ComputeUtilization, ComputeRefusal> {
  const actualDef = lookupUnit(input.actual.unitId);
  const capacityDef = lookupUnit(input.capacity.unitId);
  if (!actualDef || !capacityDef) {
    return err(computeRefusal('INCOMPATIBLE_DIMENSION', 'utilization requires known resource-time units'));
  }
  if (actualDef.dimension !== capacityDef.dimension) {
    return err(
      computeRefusal(
        'UTILIZATION_DIMENSION_MISMATCH',
        `cannot divide ${actualDef.dimension} by ${capacityDef.dimension}; tokens cannot be divided by GPU capacity`,
      ),
    );
  }
  if (input.actualStart !== input.capacityStart || input.actualEnd !== input.capacityEnd) {
    return err(
      computeRefusal('UTILIZATION_DIMENSION_MISMATCH', 'utilization requires matching measurement periods'),
    );
  }
  const actualValue = input.actual.mantissa * input.actual.numerator;
  const capacityValue = input.capacity.mantissa * input.capacity.numerator;
  if (capacityValue <= 0n) {
    return err(computeRefusal('UTILIZATION_DIMENSION_MISMATCH', 'capacity resource-time must be a positive integer'));
  }
  return ok(
    Object.freeze({
      actualResourceTime: input.actual,
      capacityResourceTime: input.capacity,
      utilizationNumerator: actualValue * input.capacity.denominator,
      utilizationDenominator: capacityValue * input.actual.denominator,
      matchingPeriod: true,
      matchingDimension: true,
    }),
  );
}

export function capacityDoesNotIssueMoonRey(): false {
  return false;
}
