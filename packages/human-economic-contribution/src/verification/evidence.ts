import type { UtcInstant } from '../../../domain/src/time.ts';
import { scanForbiddenPayload } from '../invariants.ts';
import {
  evidenceBundleIdFor,
  sha256Canonical,
  type AttestationRef,
  type ConsentGrantRef,
  type ContributionId,
  type EvidenceRef,
  type InformationRightRef,
  type PolicyDecisionRef,
  type ProvenanceRef,
  type PurposeRef,
  type UsageReceiptRef,
} from '../ids.ts';
import type { ContributionMeasurement, HumanContributionRegistryRecord, MeasurementPeriod } from '../types.ts';
import type { HumanContributionEvent } from '../types.ts';
import { HUMAN_CONTRIBUTION_EVIDENCE_SCHEMA_VERSION, type HumanContributionEvidenceBundle } from './types.ts';

export type EvidenceBundleDraft = {
  readonly contributionId: ContributionId;
  readonly subjectRef: HumanContributionEvidenceBundle['subjectRef'];
  readonly contributionClass: HumanContributionEvidenceBundle['contributionClass'];
  readonly sourceClass: HumanContributionEvidenceBundle['sourceClass'];
  readonly eventReference: HumanContributionEvidenceBundle['eventReference'];
  readonly measurement: ContributionMeasurement;
  readonly measurementUnit: HumanContributionEvidenceBundle['measurementUnit'];
  readonly measurementPeriod: MeasurementPeriod;
  readonly evidenceReferences?: readonly EvidenceRef[];
  readonly rightsReferences?: readonly InformationRightRef[];
  readonly consentReferences?: readonly ConsentGrantRef[];
  readonly purposeReferences?: readonly PurposeRef[];
  readonly usageReceiptReferences?: readonly UsageReceiptRef[];
  readonly attestationReferences?: readonly AttestationRef[];
  readonly provenanceReferences?: readonly ProvenanceRef[];
  readonly policyDecisionReferences?: readonly PolicyDecisionRef[];
  readonly jurisdiction: string;
  readonly createdAt: UtcInstant;
};

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort() as T[]);
}

export function canonicalizeReferenceCollection<T extends string>(values: readonly T[]): readonly T[] {
  return uniqueSorted(values);
}

export function duplicatedReferences<T extends string>(values: readonly T[]): readonly T[] {
  const seen = new Set<T>();
  const duplicates = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Object.freeze([...duplicates].sort() as T[]);
}

export function evidenceDigestMaterial(input: {
  readonly contributionId: ContributionId;
  readonly subjectRef: string;
  readonly contributionClass: string;
  readonly sourceClass: string;
  readonly eventReference: string;
  readonly measurementQuantity: string;
  readonly measurementUnit: string;
  readonly measurementPeriodStart: string;
  readonly measurementPeriodEnd: string;
  readonly evidenceReferences: readonly string[];
  readonly rightsReferences: readonly string[];
  readonly consentReferences: readonly string[];
  readonly purposeReferences: readonly string[];
  readonly usageReceiptReferences: readonly string[];
  readonly attestationReferences: readonly string[];
  readonly provenanceReferences: readonly string[];
  readonly policyDecisionReferences: readonly string[];
  readonly jurisdiction: string;
}): string {
  return [
    String(HUMAN_CONTRIBUTION_EVIDENCE_SCHEMA_VERSION),
    input.contributionId,
    input.subjectRef,
    input.contributionClass,
    input.sourceClass,
    input.eventReference,
    input.measurementQuantity,
    input.measurementUnit,
    input.measurementPeriodStart,
    input.measurementPeriodEnd,
    canonicalizeReferenceCollection(input.evidenceReferences).join(','),
    canonicalizeReferenceCollection(input.rightsReferences).join(','),
    canonicalizeReferenceCollection(input.consentReferences).join(','),
    canonicalizeReferenceCollection(input.purposeReferences).join(','),
    canonicalizeReferenceCollection(input.usageReceiptReferences).join(','),
    canonicalizeReferenceCollection(input.attestationReferences).join(','),
    canonicalizeReferenceCollection(input.provenanceReferences).join(','),
    canonicalizeReferenceCollection(input.policyDecisionReferences).join(','),
    input.jurisdiction,
  ].join('\n');
}

export function digestEvidenceBundleInput(input: EvidenceBundleDraft): string {
  return sha256Canonical(
    evidenceDigestMaterial({
      contributionId: input.contributionId,
      subjectRef: input.subjectRef,
      contributionClass: input.contributionClass,
      sourceClass: input.sourceClass,
      eventReference: input.eventReference,
      measurementQuantity: input.measurement.quantity.toString(),
      measurementUnit: input.measurementUnit,
      measurementPeriodStart: input.measurementPeriod.start,
      measurementPeriodEnd: input.measurementPeriod.end ?? '',
      evidenceReferences: input.evidenceReferences ?? [],
      rightsReferences: input.rightsReferences ?? [],
      consentReferences: input.consentReferences ?? [],
      purposeReferences: input.purposeReferences ?? [],
      usageReceiptReferences: input.usageReceiptReferences ?? [],
      attestationReferences: input.attestationReferences ?? [],
      provenanceReferences: input.provenanceReferences ?? [],
      policyDecisionReferences: input.policyDecisionReferences ?? [],
      jurisdiction: input.jurisdiction,
    }),
  );
}

export function createHumanContributionEvidenceBundle(
  input: EvidenceBundleDraft,
): HumanContributionEvidenceBundle {
  const forbidden = scanForbiddenPayload(input);
  if (!forbidden.ok) {
    throw new TypeError(forbidden.error.message);
  }
  const digest = digestEvidenceBundleInput(input);
  return Object.freeze({
    schemaVersion: HUMAN_CONTRIBUTION_EVIDENCE_SCHEMA_VERSION,
    bundleId: evidenceBundleIdFor(`${input.contributionId}:${digest}`),
    contributionId: input.contributionId,
    subjectRef: input.subjectRef,
    contributionClass: input.contributionClass,
    sourceClass: input.sourceClass,
    eventReference: input.eventReference,
    measurement: Object.freeze({ ...input.measurement }),
    measurementUnit: input.measurementUnit,
    measurementPeriod: Object.freeze({ ...input.measurementPeriod }),
    evidenceReferences: canonicalizeReferenceCollection(input.evidenceReferences ?? []),
    rightsReferences: canonicalizeReferenceCollection(input.rightsReferences ?? []),
    consentReferences: canonicalizeReferenceCollection(input.consentReferences ?? []),
    purposeReferences: canonicalizeReferenceCollection(input.purposeReferences ?? []),
    usageReceiptReferences: canonicalizeReferenceCollection(input.usageReceiptReferences ?? []),
    attestationReferences: canonicalizeReferenceCollection(input.attestationReferences ?? []),
    provenanceReferences: canonicalizeReferenceCollection(input.provenanceReferences ?? []),
    policyDecisionReferences: canonicalizeReferenceCollection(input.policyDecisionReferences ?? []),
    jurisdiction: input.jurisdiction,
    evidenceDigest: digest,
    createdAt: input.createdAt,
    containsRawPersonalData: false,
    containsRawCleanRoomRows: false,
    containsRawPDVData: false,
  });
}

export function evidenceBundleFromRecord(record: HumanContributionRegistryRecord): HumanContributionEvidenceBundle {
  return createHumanContributionEvidenceBundle({
    contributionId: record.contributionId,
    subjectRef: record.subjectRef,
    contributionClass: record.contributionClass,
    sourceClass: record.sourceClass,
    eventReference: record.event.eventReference,
    measurement: record.event.measurement,
    measurementUnit: record.measurementUnit,
    measurementPeriod: record.measurementPeriod,
    evidenceReferences: record.evidenceReferences,
    rightsReferences: record.rightsReferences,
    consentReferences: record.consentReferences,
    purposeReferences: record.purposeReferences,
    usageReceiptReferences: record.event.usageReceiptReferences,
    attestationReferences: record.event.attestationReferences,
    provenanceReferences: record.provenanceReferences,
    policyDecisionReferences: record.event.policyDecisionRef ? [record.event.policyDecisionRef] : [],
    jurisdiction: record.jurisdiction,
    createdAt: record.createdAt,
  });
}

export function evidenceBundleFromEvent(event: HumanContributionEvent): HumanContributionEvidenceBundle {
  return createHumanContributionEvidenceBundle({
    contributionId: event.contributionId,
    subjectRef: event.subjectRef,
    contributionClass: event.contributionClass,
    sourceClass: event.sourceClass,
    eventReference: event.eventReference,
    measurement: event.measurement,
    measurementUnit: event.measurementUnit,
    measurementPeriod: { start: event.validFrom, end: event.validUntil },
    evidenceReferences: event.evidenceReferences,
    rightsReferences: event.rightsReferences,
    consentReferences: event.consentReferences,
    purposeReferences: event.purposeReferences,
    usageReceiptReferences: event.usageReceiptReferences,
    attestationReferences: event.attestationReferences,
    provenanceReferences: event.provenanceReferences,
    policyDecisionReferences: event.policyDecisionRef ? [event.policyDecisionRef] : [],
    jurisdiction: event.jurisdiction,
    createdAt: event.createdAt,
  });
}

export function assertEvidenceDigest(bundle: HumanContributionEvidenceBundle): boolean {
  return digestEvidenceBundleInput(bundle) === bundle.evidenceDigest;
}
