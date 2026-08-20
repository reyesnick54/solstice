/**
 * Capacity inventory and utilization.
 *
 * BANDWIDTH_CAPACITY is a DATA_RATE / available-capacity concept.
 * It is not automatically realized usage. Utilization requires a
 * volume numerator and a volume denominator of the same service
 * class, interval, and network scope. GB / (GB/s) without time
 * is refused.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { lookupUnit } from '../../../../units/convert.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import { rateTimesDuration } from './transfer.ts';
import {
  bandwidthRefusal,
  type BandwidthCapacityInventory,
  type BandwidthRefusal,
  type BandwidthSourceObservation,
  type BandwidthUtilization,
  type NetworkServiceStage,
} from './types.ts';

export function capacityDoesNotEqualUsage(capacityFact: string, usageFact: string): true {
  if (capacityFact === usageFact) {
    throw new Error('CAPACITY_EQUALS_USAGE');
  }
  return true;
}

export function inventoryFrom(observation: BandwidthSourceObservation): Result<BandwidthCapacityInventory, BandwidthRefusal> {
  if (observation.factType !== 'BANDWIDTH_CAPACITY') {
    return err(bandwidthRefusal('CAPACITY_IS_NOT_REALIZED_USAGE', `${observation.factType} is not a capacity inventory fact`));
  }
  const rateDef = lookupUnit(observation.unit === 'B_s' ? 'B_s' : observation.unit);
  if (!rateDef || rateDef.dimension !== 'DATA_RATE') {
    return err(
      bandwidthRefusal(
        'RATE_PRESENTED_AS_VOLUME',
        'BANDWIDTH_CAPACITY must use a DATA_RATE unit; GB/TB volume is not capacity',
      ),
    );
  }
  return ok(
    Object.freeze({
      rate: {
        mantissa: BigInt(observation.numericValue),
        scale: 0,
        numerator: 1n,
        denominator: 1n,
        unitId: observation.unit === 'B_s' ? 'B_s' : observation.unit,
      },
      dimension: 'DATA_RATE' as const,
      serviceClass: observation.networkStage,
      region: observation.region,
      realizedUsage: false as const,
    }),
  );
}

export function bandwidthUtilization(input: {
  readonly actualVolume: ExactQuantity;
  readonly capacityRate: ExactQuantity;
  readonly durationSeconds: bigint | null;
  readonly actualStart: bigint;
  readonly actualEnd: bigint;
  readonly capacityStart: bigint;
  readonly capacityEnd: bigint;
  readonly actualStage: NetworkServiceStage;
  readonly capacityStage: NetworkServiceStage;
  readonly actualRegion: string;
  readonly capacityRegion: string;
}): Result<BandwidthUtilization, BandwidthRefusal> {
  const actualDef = lookupUnit(input.actualVolume.unitId);
  const capacityDef = lookupUnit(input.capacityRate.unitId);
  if (!actualDef || !capacityDef) {
    return err(bandwidthRefusal('INCOMPATIBLE_DIMENSION', 'utilization requires known bandwidth units'));
  }
  if (actualDef.dimension !== 'DATA_VOLUME') {
    return err(
      bandwidthRefusal('UTILIZATION_DIMENSION_MISMATCH', 'utilization numerator must be transferred DATA_VOLUME'),
    );
  }
  if (capacityDef.dimension === 'DATA_RATE' && (input.durationSeconds === null || input.durationSeconds <= 0n)) {
    return err(
      bandwidthRefusal(
        'DURATION_REQUIRED',
        'cannot divide DATA_VOLUME by DATA_RATE without incorporating time; GB / (GB/s) is refused',
      ),
    );
  }
  if (input.actualStage !== input.capacityStage) {
    return err(
      bandwidthRefusal('UTILIZATION_DIMENSION_MISMATCH', 'utilization requires the same network service class'),
    );
  }
  if (input.actualStart !== input.capacityStart || input.actualEnd !== input.capacityEnd) {
    return err(bandwidthRefusal('UTILIZATION_DIMENSION_MISMATCH', 'utilization requires the same measurement interval'));
  }
  if (input.actualRegion !== input.capacityRegion) {
    return err(
      bandwidthRefusal('UTILIZATION_DIMENSION_MISMATCH', 'utilization requires compatible geography/network scope'),
    );
  }

  let capacityVolume = input.capacityRate;
  if (capacityDef.dimension === 'DATA_RATE') {
    const converted = rateTimesDuration({
      rate: input.capacityRate,
      durationSeconds: input.durationSeconds,
      factType: 'BANDWIDTH_USAGE',
    });
    if (!converted.ok) {
      return converted;
    }
    capacityVolume = converted.value.volume;
  } else if (capacityDef.dimension !== 'DATA_VOLUME') {
    return err(
      bandwidthRefusal('UTILIZATION_DIMENSION_MISMATCH', 'capacity basis must be DATA_RATE or compatible DATA_VOLUME'),
    );
  }

  const actualValue = input.actualVolume.mantissa * input.actualVolume.numerator;
  const capacityValue = capacityVolume.mantissa * capacityVolume.numerator;
  if (capacityValue <= 0n) {
    return err(bandwidthRefusal('UTILIZATION_DIMENSION_MISMATCH', 'capacity volume must be a positive integer'));
  }
  return ok(
    Object.freeze({
      actualVolume: input.actualVolume,
      capacityVolume,
      utilizationNumerator: actualValue * capacityVolume.denominator,
      utilizationDenominator: capacityValue * input.actualVolume.denominator,
      matchingPeriod: true as const,
      matchingDimension: true as const,
      matchingServiceClass: true as const,
      matchingScope: true as const,
    }),
  );
}

export function capacityDoesNotIssueMoonRey(): false {
  return false;
}
