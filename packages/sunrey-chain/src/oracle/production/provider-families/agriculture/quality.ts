import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  QUALITY_CHANGES_PHYSICAL_QUANTITY,
  type AgricultureQualityEvidence,
  type AgricultureRefusal,
  type AgricultureSourceRecord,
  type NormalizedAgricultureObservation,
} from './types.ts';

export function qualityDoesNotChangePhysicalQuantity(): false {
  return QUALITY_CHANGES_PHYSICAL_QUANTITY;
}

export function qualityIsNotMass(record: AgricultureSourceRecord): Result<true, AgricultureRefusal> {
  if (record.measurementSemantics === 'QUALITY_GRADE') {
    return err({
      code: 'QUALITY_IS_NOT_MASS',
      detail: 'food quality/grade is supporting evidence and does not create harvest mass',
    });
  }
  return ok(true);
}

export function fixtureCertificationIsNotLegalProof(evidence: AgricultureQualityEvidence): Result<true, AgricultureRefusal> {
  if (evidence.provesLegalCertification !== false) {
    return err({
      code: 'FIXTURE_IS_NOT_AUTHORIZATION',
      detail: 'fixture organic/certification strings are not proof that legal certification occurred',
    });
  }
  return ok(true);
}

export function qualityLeavesQuantityUnchanged(
  before: NormalizedAgricultureObservation['canonicalQuantity'],
  after: NormalizedAgricultureObservation['canonicalQuantity'],
): boolean {
  return (
    before.mantissa === after.mantissa &&
    before.unitId === after.unitId &&
    before.scale === after.scale &&
    before.numerator === after.numerator &&
    before.denominator === after.denominator
  );
}

export function defaultQualityEvidence(
  overrides: Partial<AgricultureQualityEvidence> = {},
): AgricultureQualityEvidence {
  return Object.freeze({
    moistureBps: overrides.moistureBps ?? 1_200n,
    grade: overrides.grade ?? 'US_NO_2',
    acceptedRejectedStatus: overrides.acceptedRejectedStatus ?? 'ACCEPTED',
    inspectionReference: overrides.inspectionReference ?? 'insp.sim.1',
    organicOrCertificationReference: overrides.organicOrCertificationReference ?? 'cert.fixture.organic',
    fixtureOnly: overrides.fixtureOnly ?? true,
    provesLegalCertification: false,
    changesPhysicalQuantity: false,
  });
}
