import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  WATER_AVAILABILITY_EQUALS_PRODUCTION,
  type NormalizedWaterObservation,
  type WaterRefusal,
  type WaterSourceRecord,
} from './types.ts';

export function waterAvailabilityEqualsProduction(): false {
  return WATER_AVAILABILITY_EQUALS_PRODUCTION;
}

export function availabilityCannotCreateOutput(record: WaterSourceRecord): Result<true, WaterRefusal> {
  if (record.factType === 'WATER_AVAILABILITY' && record.measurementSemantics !== 'AVAILABLE_RESERVE') {
    return err({
      code: 'WATER_AVAILABILITY_IS_NOT_PRODUCTION',
      detail: 'WATER_AVAILABILITY is capacity/reserve context and cannot be reported as another water semantic',
    });
  }
  if (record.factType === 'WATER_PRODUCTION' && record.measurementSemantics === 'AVAILABLE_RESERVE') {
    return err({
      code: 'AVAILABILITY_CANNOT_CREATE_OUTPUT',
      detail: 'available reserve cannot be ingested as WATER_PRODUCTION',
    });
  }
  return ok(true);
}

export function availabilityIsNotProduction(observation: NormalizedWaterObservation): Result<true, WaterRefusal> {
  if (observation.createsAvailabilityEvidence && observation.createsWaterProductionEvent) {
    return err({
      code: 'WATER_AVAILABILITY_IS_NOT_PRODUCTION',
      detail: 'availability evidence cannot also be treated as realized water production',
    });
  }
  if (observation.createsAvailabilityEvidence && observation.canCreateOutputClaim) {
    return err({
      code: 'AVAILABILITY_CANNOT_CREATE_OUTPUT',
      detail: 'WATER_AVAILABILITY cannot create OUTPUT from capacity or reserve alone',
    });
  }
  return ok(true);
}
