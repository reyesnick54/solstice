import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { exactQuantity, scaleByRational } from '../../../../units/quantity.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import type { AssayGradeEvidence, ResourceFabricPolicy, ResourceRefusal, ResourceSourceRecord } from './types.ts';

/**
 * Mineral grade, purity, and assay results are quality/composition
 * evidence. They are not physical mass.
 *
 * mass × grade is refused unless the policy explicitly defines a
 * contained-material measurement.
 */
export function assayIsNotMass(record: ResourceSourceRecord): Result<AssayGradeEvidence, ResourceRefusal> {
  if (record.measurementSemantics === 'ASSAY_GRADE_QUALITY' && record.assayEvidence === null) {
    return err({
      code: 'ASSAY_GRADE_IS_NOT_MASS',
      detail: 'assay grade observations require explicit assay evidence and are not mass',
    });
  }
  if (record.assayEvidence === null) {
    return err({
      code: 'ASSAY_GRADE_IS_NOT_MASS',
      detail: 'no assay evidence present',
    });
  }
  if (record.assayEvidence.isPhysicalMass !== false) {
    return err({
      code: 'ASSAY_GRADE_IS_NOT_MASS',
      detail: 'assay evidence cannot be marked as physical mass',
    });
  }
  return ok(record.assayEvidence);
}

export function containedMaterialMass(
  bulkMass: ExactQuantity,
  assay: AssayGradeEvidence,
  policy: ResourceFabricPolicy,
): Result<ExactQuantity, ResourceRefusal> {
  if (!policy.allowContainedMaterialMeasurement) {
    return err({
      code: 'CONTAINED_MATERIAL_POLICY_REQUIRED',
      detail: 'mass × grade is refused unless policy explicitly allows CONTAINED_MATERIAL_MASS',
    });
  }
  if (assay.gradePpm < 0n) {
    return err({
      code: 'ASSAY_GRADE_IS_NOT_MASS',
      detail: 'negative assay grades are refused',
    });
  }
  const scaled = scaleByRational(bulkMass, assay.gradePpm, 1_000_000n, bulkMass.unitId);
  if (!scaled.ok) {
    return err({
      code: 'ASSAY_GRADE_IS_NOT_MASS',
      detail: scaled.error.detail,
    });
  }
  return ok(scaled.value);
}

export function refuseMassTimesGradeWithoutPolicy(
  bulkMantissa: bigint,
  gradePpm: bigint,
  policy: ResourceFabricPolicy,
): Result<never, ResourceRefusal> | Result<ExactQuantity, ResourceRefusal> {
  const bulk = exactQuantity({ mantissa: bulkMantissa, unitId: 'g' });
  if (!bulk.ok) {
    return err({ code: 'ASSAY_GRADE_IS_NOT_MASS', detail: bulk.error.detail });
  }
  return containedMaterialMass(bulk.value, {
    gradePpm,
    analyte: 'unspecified',
    samplingMethodologyReference: 'fixture.sampling',
    laboratoryAttestationReference: 'fixture.lab',
    isPhysicalMass: false,
  }, policy);
}
