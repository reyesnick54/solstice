import type { HumanContributionEvent, HumanContributionRegistryRecord, VerifiedContributionReference } from './types.ts';
import { fingerprintEconomicEvent, evidenceDigestOf, registryRecordIdForContribution } from './fingerprint.ts';
import type { ContributionId, VerificationPolicyVersion } from './ids.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

export function registryRecordFromEvent(
  event: HumanContributionEvent,
  extras: {
    readonly verificationPolicyVersion?: VerificationPolicyVersion | null;
    readonly verificationTimestamp?: UtcInstant | null;
    readonly corrects?: ContributionId | null;
    readonly correctedBy?: ContributionId | null;
  } = {},
): HumanContributionRegistryRecord {
  const verified = event.status === 'VERIFIED';
  return Object.freeze({
    registryRecordId: registryRecordIdForContribution(event.contributionId),
    contributionId: event.contributionId,
    fingerprint: fingerprintEconomicEvent({
      subjectRef: event.subjectRef,
      contributionClass: event.contributionClass,
      eventReference: event.eventReference,
      validFrom: event.validFrom,
      validUntil: event.validUntil,
      measurementQuantity: event.measurement.quantity,
      measurementUnit: event.measurement.unit,
      jurisdiction: event.jurisdiction,
      sourceClass: event.sourceClass,
    }),
    subjectRef: event.subjectRef,
    contributionClass: event.contributionClass,
    verifiedMeasurement: verified ? event.measurement : null,
    measurementUnit: event.measurementUnit,
    measurementPeriod: Object.freeze({
      start: event.validFrom,
      end: event.validUntil,
    }),
    jurisdiction: event.jurisdiction,
    sourceClass: event.sourceClass,
    evidenceDigest: evidenceDigestOf(event.evidenceReferences),
    evidenceReferences: event.evidenceReferences,
    rightsReferences: event.rightsReferences,
    consentReferences: event.consentReferences,
    purposeReferences: event.purposeReferences,
    provenanceReferences: event.provenanceReferences,
    verificationPolicyVersion: extras.verificationPolicyVersion ?? null,
    verificationTimestamp: extras.verificationTimestamp ?? null,
    status: event.status,
    createdAt: event.createdAt,
    supersedes: event.supersedes,
    supersededBy: event.supersededBy,
    corrects: extras.corrects ?? null,
    correctedBy: extras.correctedBy ?? null,
    event,
    sunReyQuantity: null,
    valuationAmount: null,
    issuesExecutionAuthority: false,
    issuesMintAuthority: false,
  });
}

export function replaceRecordEvent(
  record: HumanContributionRegistryRecord,
  event: HumanContributionEvent,
  extras: Partial<Pick<HumanContributionRegistryRecord, 'verificationPolicyVersion' | 'verificationTimestamp' | 'corrects' | 'correctedBy' | 'verifiedMeasurement'>> = {},
): HumanContributionRegistryRecord {
  return Object.freeze({
    ...record,
    event,
    status: event.status,
    supersedes: event.supersedes,
    supersededBy: event.supersededBy,
    verifiedMeasurement: extras.verifiedMeasurement !== undefined ? extras.verifiedMeasurement : event.status === 'VERIFIED' ? event.measurement : record.verifiedMeasurement,
    verificationPolicyVersion: extras.verificationPolicyVersion !== undefined ? extras.verificationPolicyVersion : record.verificationPolicyVersion,
    verificationTimestamp: extras.verificationTimestamp !== undefined ? extras.verificationTimestamp : record.verificationTimestamp,
    corrects: extras.corrects !== undefined ? extras.corrects : record.corrects,
    correctedBy: extras.correctedBy !== undefined ? extras.correctedBy : record.correctedBy,
    sunReyQuantity: null,
    valuationAmount: null,
    issuesExecutionAuthority: false,
    issuesMintAuthority: false,
  });
}

export function asVerifiedReference(record: HumanContributionRegistryRecord): VerifiedContributionReference | undefined {
  if (
    record.status !== 'VERIFIED' ||
    record.verifiedMeasurement === null ||
    record.verificationPolicyVersion === null ||
    record.verificationTimestamp === null
  ) {
    return undefined;
  }
  return Object.freeze({
    registryRecordId: record.registryRecordId,
    contributionId: record.contributionId,
    fingerprint: record.fingerprint,
    subjectRef: record.subjectRef,
    contributionClass: record.contributionClass,
    status: 'VERIFIED',
    evidenceDigest: record.evidenceDigest,
    verificationPolicyVersion: record.verificationPolicyVersion,
    verificationTimestamp: record.verificationTimestamp,
    measurementUnit: record.measurementUnit,
    verifiedMeasurement: record.verifiedMeasurement,
    jurisdiction: record.jurisdiction,
    containsRawPersonalData: false,
  });
}
