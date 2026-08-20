import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  QUALITY_CHANGES_PHYSICAL_QUANTITY,
  type NormalizedWaterObservation,
  type WaterQualityEvidence,
  type WaterRefusal,
  type WaterSourceRecord,
} from './types.ts';

export function qualityDoesNotChangePhysicalQuantity(): false {
  return QUALITY_CHANGES_PHYSICAL_QUANTITY;
}

export function qualityIsNotVolume(record: WaterSourceRecord): Result<true, WaterRefusal> {
  if (record.measurementSemantics === 'WATER_QUALITY' || record.sourceClass === 'WATER_QUALITY_ATTESTATION') {
    return err({
      code: 'QUALITY_IS_NOT_VOLUME',
      detail: 'water quality evidence does not increase physical water quantity or independently create output',
    });
  }
  return ok(true);
}

export function qualityLeavesQuantityUnchanged(
  before: NormalizedWaterObservation['canonicalQuantity'],
  after: NormalizedWaterObservation['canonicalQuantity'],
): boolean {
  return (
    before.mantissa === after.mantissa &&
    before.unitId === after.unitId &&
    before.scale === after.scale &&
    before.numerator === after.numerator &&
    before.denominator === after.denominator
  );
}

export function defaultWaterQualityEvidence(
  overrides: Partial<WaterQualityEvidence> = {},
): WaterQualityEvidence {
  return Object.freeze({
    treatmentStandardReference: overrides.treatmentStandardReference ?? 'std.potable.sim',
    laboratoryAttestationReference: overrides.laboratoryAttestationReference ?? 'lab.water.sim',
    qualitySamplingReference: overrides.qualitySamplingReference ?? 'sample.water.sim',
    purityClassification: overrides.purityClassification ?? 'POTABLE_REFERENCE',
    fixtureOnly: overrides.fixtureOnly ?? true,
    provesLegalCertification: false,
    changesPhysicalQuantity: false,
    createsOutput: false,
  });
}
