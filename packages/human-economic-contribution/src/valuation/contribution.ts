import type { HumanContributionEvent, HumanContributionRegistryRecord, VerifiedContributionReference } from '../types.ts';
import type { VerifiedHumanEconomicContribution } from './types.ts';

export type ValuationContributionSource =
  | VerifiedHumanEconomicContribution
  | HumanContributionRegistryRecord
  | VerifiedContributionReference
  | HumanContributionEvent;

function isVerifiedHuman(value: ValuationContributionSource): value is VerifiedHumanEconomicContribution {
  return 'contributionFingerprint' in value && 'containsRawPersonalData' in value && 'evidenceDigest' in value;
}

function isRegistryRecord(value: ValuationContributionSource): value is HumanContributionRegistryRecord {
  return 'registryRecordId' in value && 'event' in value && 'fingerprint' in value;
}

function isVerifiedReference(value: ValuationContributionSource): value is VerifiedContributionReference {
  return 'fingerprint' in value && 'status' in value && value.status === 'VERIFIED' && 'verifiedMeasurement' in value && !('event' in value);
}

export function asVerifiedHumanEconomicContribution(
  source: ValuationContributionSource,
): VerifiedHumanEconomicContribution {
  if (isVerifiedHuman(source) && !isRegistryRecord(source) && !isVerifiedReference(source)) {
    return source;
  }
  if (isRegistryRecord(source)) {
    return Object.freeze({
      contributionId: source.contributionId,
      contributionFingerprint: source.fingerprint,
      contributionClass: source.contributionClass,
      status: source.status,
      dataQuality: source.event.dataQuality,
      verifiedMeasurement: source.verifiedMeasurement,
      measurementUnit: source.measurementUnit,
      jurisdiction: source.jurisdiction,
      evidenceReferences: source.evidenceReferences,
      evidenceDigest: source.evidenceDigest,
      rightsReferences: source.rightsReferences,
      consentReferences: source.consentReferences,
      purposeReferences: source.purposeReferences,
      usageReceiptReferences: source.event.usageReceiptReferences,
      sourceClass: source.sourceClass,
      verificationPolicyVersion: source.verificationPolicyVersion,
      verificationTimestamp: source.verificationTimestamp,
      eventReference: source.event.eventReference,
      subjectRef: source.subjectRef,
      validFrom: source.measurementPeriod.start,
      validUntil: source.measurementPeriod.end,
      containsRawPersonalData: false,
      peveScoreUsedAsValue: false,
      humanWorthScore: false,
      sunReyQuantity: null,
    });
  }
  if (isVerifiedReference(source)) {
    return Object.freeze({
      contributionId: source.contributionId,
      contributionFingerprint: source.fingerprint,
      contributionClass: source.contributionClass,
      status: source.status,
      dataQuality: 'CURRENT',
      verifiedMeasurement: source.verifiedMeasurement,
      measurementUnit: source.measurementUnit,
      jurisdiction: source.jurisdiction,
      evidenceReferences: [],
      evidenceDigest: source.evidenceDigest,
      rightsReferences: [],
      consentReferences: [],
      purposeReferences: [],
      usageReceiptReferences: [],
      sourceClass: 'OTHER_GOVERNED_SOURCE',
      verificationPolicyVersion: source.verificationPolicyVersion,
      verificationTimestamp: source.verificationTimestamp,
      eventReference: source.registryRecordId,
      subjectRef: source.subjectRef,
      validFrom: source.verificationTimestamp,
      validUntil: null,
      containsRawPersonalData: false,
      peveScoreUsedAsValue: false,
      humanWorthScore: false,
      sunReyQuantity: null,
    });
  }
  const event = source;
  return Object.freeze({
    contributionId: event.contributionId,
    contributionFingerprint: event.contributionId as unknown as VerifiedHumanEconomicContribution['contributionFingerprint'],
    contributionClass: event.contributionClass,
    status: event.status,
    dataQuality: event.dataQuality,
    verifiedMeasurement: event.status === 'VERIFIED' ? event.measurement : null,
    measurementUnit: event.measurementUnit,
    jurisdiction: event.jurisdiction,
    evidenceReferences: event.evidenceReferences,
    evidenceDigest: event.evidenceReferences.join('|'),
    rightsReferences: event.rightsReferences,
    consentReferences: event.consentReferences,
    purposeReferences: event.purposeReferences,
    usageReceiptReferences: event.usageReceiptReferences,
    sourceClass: event.sourceClass,
    verificationPolicyVersion: null,
    verificationTimestamp: event.status === 'VERIFIED' ? event.createdAt : null,
    eventReference: event.eventReference,
    subjectRef: event.subjectRef,
    validFrom: event.validFrom,
    validUntil: event.validUntil,
    containsRawPersonalData: false,
    peveScoreUsedAsValue: false,
    humanWorthScore: false,
    sunReyQuantity: null,
  });
}
