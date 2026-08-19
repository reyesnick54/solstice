import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  consentRefFor,
  controllerRefFor,
  projectDescriptor,
  purposeRefFor,
  reflectSourceLifecycle,
  rightsHolderRefFor,
  scanForbiddenPayload,
  subjectRefFor,
  valuationMethodRefFor,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistryPort,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../economic-asset-registry/src/index.ts';
import type { HumanContributionEvidenceBundle } from './verification/types.ts';
import type { HumanContributionRegistryRecord, VerifiedContributionReference } from './types.ts';

/**
 * Privacy-safe valuation-reference metadata. Amounts stay on the
 * source valuation result and are never copied into automaticValue.
 */
export type ProjectableValuationReference = {
  readonly referenceId: string;
  readonly sourceClass: string;
  readonly observedAt: UtcInstant;
  readonly effectiveAt: UtcInstant;
  readonly expiresAt?: UtcInstant | null;
  readonly jurisdiction: string;
  readonly provenanceDigest: string;
  readonly quality?: 'AUTHORITATIVE' | 'APPROVED' | 'ATTESTED' | 'LOW';
  readonly valuationMethod?: string | null;
};

export type ProjectableValuationResult = {
  readonly finalReferenceValue: bigint;
};

const OWNER = CANONICAL_SYSTEM_OWNERS.humanContribution;

/**
 * Maps verified human contributions into master registry descriptors.
 *
 * Valuation amounts stay on the valuation result. They are never copied
 * into automaticValue. Registration does not authorize settlement.
 */
export class HumanContributionEconomicAssetAdapter {
  readonly registry: EconomicAssetRegistryPort;

  constructor(registry: EconomicAssetRegistryPort) {
    this.registry = registry;
  }

  projectEvidence(
    evidence: HumanContributionEvidenceBundle,
    at: UtcInstant,
  ): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapContributionEvidence(evidence, at);
    if (!mapped.ok) {
      return mapped;
    }
    return projectDescriptor(this.registry, mapped.value);
  }

  projectRecord(
    record: HumanContributionRegistryRecord | VerifiedContributionReference,
    at: UtcInstant,
    evidenceAssetId?: EconomicAssetDescriptor['assetId'],
  ): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapContributionRecord(record, at);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok || !evidenceAssetId) {
      return projected;
    }
    if (projected.value.lineage.some((edge) => edge.toAssetId === evidenceAssetId && edge.kind === 'VERIFIED_BY')) {
      return projected;
    }
    return this.registry.addLineage({
      fromAssetId: projected.value.assetId,
      toAssetId: evidenceAssetId,
      kind: 'VERIFIED_BY',
      at,
    });
  }

  projectValuationReference(
    datum: ProjectableValuationReference,
    at: UtcInstant,
    contributionAssetId?: EconomicAssetDescriptor['assetId'],
  ): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapValuationReference(datum, at);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok || !contributionAssetId) {
      return projected;
    }
    return this.registry.addLineage({
      fromAssetId: projected.value.assetId,
      toAssetId: contributionAssetId,
      kind: 'DERIVED_FROM',
      at,
    });
  }

  linkRightToEvidence(
    rightAssetId: EconomicAssetDescriptor['assetId'],
    evidenceAssetId: EconomicAssetDescriptor['assetId'],
    at: UtcInstant,
  ): Result<EconomicAssetDescriptor, RegistryFailure> {
    return this.registry.addLineage({
      fromAssetId: evidenceAssetId,
      toAssetId: rightAssetId,
      kind: 'CONTRIBUTED_TO',
      at,
    });
  }

  reflectCorrection(
    prior: HumanContributionRegistryRecord,
    next: HumanContributionRegistryRecord,
    at: UtcInstant,
  ): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapContributionRecord(next, at);
    if (!mapped.ok) {
      return mapped;
    }
    const existing = this.registry.findBySourceRecord(OWNER, prior.contributionId);
    if (!existing) {
      return this.projectRecord(next, at);
    }
    return this.registry.correct(existing.assetId, { ...mapped.value, sourceRecordId: next.contributionId });
  }

  reflectSuspension(contributionId: string, at: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure> {
    return reflectSourceLifecycle(this.registry, OWNER, contributionId, 'SUSPENDED', at);
  }
}

export function createHumanContributionEconomicAssetAdapter(
  registry: EconomicAssetRegistryPort,
): HumanContributionEconomicAssetAdapter {
  return new HumanContributionEconomicAssetAdapter(registry);
}

export function mapContributionEvidence(
  evidence: HumanContributionEvidenceBundle,
  at: UtcInstant,
): Result<RegisterAssetInput, RegistryFailure> {
  if (evidence.containsRawPersonalData !== false || evidence.containsRawPDVData !== false || evidence.containsRawCleanRoomRows !== false) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'contribution evidence must remain privacy-safe references' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'HUMAN_CONTRIBUTION_EVIDENCE',
    domain: 'HUMAN_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: evidence.bundleId,
    sourceClass: 'HUMAN_CONTRIBUTION_REGISTRY',
    sourceSystem: OWNER,
    sourceSchemaVersion: String(evidence.schemaVersion),
    controllerRef: controllerRefFor(`hec-evidence:${evidence.bundleId}`),
    rightsHolderRefs: [rightsHolderRefFor(`hec-subject:${evidence.subjectRef}`)],
    subjectRef: subjectRefFor(evidence.subjectRef),
    jurisdiction: evidence.jurisdiction,
    consentRefs: evidence.consentReferences.map((ref) => consentRefFor(ref)),
    purposeRefs: evidence.purposeReferences.map((ref) => purposeRefFor(ref)),
    rightsConcepts: ['SUBJECT_RIGHTS', 'USAGE_RIGHTS'],
    sensitivityClass: 'PERSONAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: evidence.createdAt,
    economicCategory: 'ECONOMIC_PARTICIPATION',
    contentCommitmentMaterial: `hec-ev:${evidence.bundleId}:${evidence.evidenceDigest}`.slice(0, 256),
    provenanceMaterial: `hec-ev-prov:${evidence.contributionId}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_PROTECTED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function mapContributionRecord(
  record: HumanContributionRegistryRecord | VerifiedContributionReference,
  at: UtcInstant,
): Result<RegisterAssetInput, RegistryFailure> {
  if ('valuationAmount' in record && record.valuationAmount !== null) {
    return err({
      code: 'AUTOMATIC_VALUATION_FORBIDDEN',
      message: 'valuation amounts cannot be projected onto automaticValue',
    });
  }
  const fingerprint = record.fingerprint;
  const policy = 'verificationPolicyVersion' in record ? record.verificationPolicyVersion : null;
  const payload: RegisterAssetInput = {
    assetClass: 'HUMAN_CONTRIBUTION_RECORD',
    domain: 'HUMAN_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: record.contributionId,
    sourceClass: 'HUMAN_CONTRIBUTION_REGISTRY',
    sourceSystem: OWNER,
    sourceSchemaVersion: policy ?? '1',
    controllerRef: controllerRefFor(`hec-record:${record.contributionId}`),
    rightsHolderRefs: [rightsHolderRefFor(`hec-subject:${record.subjectRef}`)],
    subjectRef: subjectRefFor(record.subjectRef),
    jurisdiction: 'jurisdiction' in record ? record.jurisdiction : 'GB',
    consentRefs: 'consentReferences' in record ? record.consentReferences.map((ref) => consentRefFor(ref)) : [],
    purposeRefs: 'purposeReferences' in record ? record.purposeReferences.map((ref) => purposeRefFor(ref)) : [],
    rightsConcepts: ['SUBJECT_RIGHTS', 'USAGE_RIGHTS'],
    sensitivityClass: 'PERSONAL',
    qualityClass: record.status === 'VERIFIED' ? 'VERIFIED' : 'ATTESTED',
    freshness: record.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT',
    validFrom: 'createdAt' in record ? record.createdAt : at,
    economicCategory: 'ECONOMIC_PARTICIPATION',
    permittedValuationMethodRefs: policy ? [valuationMethodRefFor(policy)] : [],
    contentCommitmentMaterial: `hec-rec:${record.contributionId}:${fingerprint}`.slice(0, 256),
    provenanceMaterial: `hec-rec-prov:${record.evidenceDigest}`.slice(0, 256),
    storageClass: 'ON_CHAIN_COMMITMENT_ONLY',
    status: record.status === 'VERIFIED' ? 'VERIFIED' : record.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'REGISTERED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function mapValuationReference(
  datum: ProjectableValuationReference,
  at: UtcInstant,
): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'ECONOMIC_REFERENCE_DATA',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: datum.referenceId,
    sourceClass: 'HUMAN_CONTRIBUTION_REGISTRY',
    sourceSystem: OWNER,
    sourceSchemaVersion: datum.valuationMethod ?? '1',
    controllerRef: controllerRefFor(`hec-ref:${datum.referenceId}`),
    jurisdiction: datum.jurisdiction === 'GLOBAL' ? 'UN' : datum.jurisdiction,
    qualityClass: datum.quality === 'AUTHORITATIVE' ? 'AUTHORITATIVE' : 'ATTESTED',
    freshness: 'CURRENT',
    observedAt: datum.observedAt,
    validFrom: datum.effectiveAt,
    validUntil: datum.expiresAt,
    economicCategory: 'SHARED_ECONOMIC_REFERENCE',
    permittedValuationMethodRefs: datum.valuationMethod ? [valuationMethodRefFor(datum.valuationMethod)] : [],
    contentCommitmentMaterial: `hec-valref:${datum.referenceId}:${datum.provenanceDigest}`.slice(0, 256),
    provenanceMaterial: `hec-valref-prov:${datum.sourceClass}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_PUBLIC_REFERENCE',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function valuationResultIsNotAutomaticValue(result: ProjectableValuationResult): true {
  void result.finalReferenceValue;
  return true;
}
