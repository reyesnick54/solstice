import type { UtcInstant } from '../../domain/src/time.ts';
import {
  contributionFingerprintFor,
  registryRecordIdFor,
  sha256Canonical,
  verificationPolicyVersionFor,
  type ContributionFingerprint,
  type ContributionId,
  type EventReference,
  type EvidenceRef,
  type RegistryRecordId,
  type SubjectRef,
  type VerificationPolicyVersion,
} from './ids.ts';
import type { ContributionClass, MeasurementUnit, SourceClass } from './taxonomy.ts';

export const DEFAULT_VERIFICATION_POLICY_VERSION: VerificationPolicyVersion = verificationPolicyVersionFor(
  'sunrey-human-contribution-verification-engineering-v1',
);

export type FingerprintMaterial = {
  readonly subjectRef: SubjectRef;
  readonly contributionClass: ContributionClass;
  readonly eventReference: EventReference;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant | null;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: MeasurementUnit;
  readonly jurisdiction: string;
  readonly sourceClass: SourceClass;
};

export function fingerprintEconomicEvent(material: FingerprintMaterial): ContributionFingerprint {
  return contributionFingerprintFor(
    [
      material.subjectRef,
      material.contributionClass,
      material.eventReference,
      material.validFrom,
      material.validUntil ?? '',
      material.measurementQuantity.toString(),
      material.measurementUnit,
      material.jurisdiction,
      material.sourceClass,
    ].join('\n'),
  );
}

export function evidenceDigestOf(references: readonly EvidenceRef[]): string {
  return sha256Canonical([...references].map((reference) => String(reference)).sort().join('\n'));
}

export function registryRecordIdForContribution(contributionId: ContributionId): RegistryRecordId {
  return registryRecordIdFor(contributionId);
}
