import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DataAsset, DataAssetVersion, DataDerivation } from '../types.ts';
import type { ProductClassification } from './classification.ts';
import { classificationFromLegacySensitivity } from './classification.ts';
import type { VaultCategoryId, VaultCategoryRecord, VaultPurpose } from './category-registry.ts';
import { DEFAULT_CATEGORY_REGISTRY } from './category-registry.ts';
import type { DataKind, VerificationState } from './kinds.ts';
import { kindFromProvenance, verificationFromKind } from './kinds.ts';
import type { VaultOwnership } from './ownership.ts';
import { ownershipForSubject } from './ownership.ts';
import type { RecordProvenance } from './provenance.ts';
import { enhanceProvenance } from './provenance.ts';
import type { ProductRetentionPolicy } from './retention.ts';

export const RECORD_STATUSES = [
  'ACTIVE',
  'SUPERSEDED',
  'DISPUTED',
  'REVOKED',
  'DELETED',
  'RETAINED_BY_POLICY',
] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export type VaultAccessPolicy = {
  readonly ownerOnly: boolean;
  readonly agentEligible: boolean;
  readonly allowedPurposes: readonly VaultPurpose[];
  readonly getAllUserDataForbidden: true;
};

export type VaultDataRecord = {
  readonly schema: 'sunrey.vault.data-record.v1';
  readonly dataRecordId: string;
  readonly ownerSubjectId: string;
  readonly dataCategory: VaultCategoryId;
  readonly dataType: string;
  readonly dataKind: DataKind;
  readonly schemaVersion: string;
  readonly source: string;
  readonly sourceReference: string;
  readonly provenance: RecordProvenance;
  readonly createdAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly verificationState: VerificationState;
  readonly confidence: DataAsset['provenance']['confidence'] | 'AI_INFERRED';
  readonly classification: ProductClassification;
  readonly retentionPolicy: ProductRetentionPolicy;
  readonly consentReference: string | null;
  readonly purposeRestrictions: readonly VaultPurpose[];
  readonly accessPolicy: VaultAccessPolicy;
  readonly integrityHash: string | null;
  readonly status: RecordStatus;
  readonly ownership: VaultOwnership;
  readonly version: number;
  readonly currentVersionId: string | null;
  readonly parentRecordIds: readonly string[];
  readonly changeReason: string | null;
  readonly disputed: boolean;
  readonly authoritativeForFinancialState: false;
  readonly productionActive: false;
  readonly liveMonetizationEnabled: false;
};

export type VaultRecordMetadata = {
  readonly assetId: string;
  readonly registryCategory: VaultCategoryId;
  readonly dataKind: DataKind;
  readonly verificationState: VerificationState;
  readonly consentReference: string | null;
  readonly purposeRestrictions: readonly VaultPurpose[];
  readonly parentRecordIds: readonly string[];
  readonly changeReason: string | null;
  readonly licenseRef: string | null;
  readonly disputed: boolean;
  readonly objectRef: string | null;
};

export function defaultRecordMetadata(asset: DataAsset): VaultRecordMetadata {
  const category = DEFAULT_CATEGORY_REGISTRY.fromAssetCategory(asset.category);
  const dataKind = kindFromProvenance(asset.provenance.kind, asset.derivationState);
  return Object.freeze({
    assetId: asset.assetId,
    registryCategory: category.categoryId,
    dataKind,
    verificationState: verificationFromKind(dataKind, asset.provenance.kind),
    consentReference: null,
    purposeRestrictions: category.allowedPurposes,
    parentRecordIds: Object.freeze([]),
    changeReason: null,
    licenseRef: null,
    disputed: false,
    objectRef: null,
  });
}

export function statusFromAsset(asset: DataAsset, disputed: boolean): RecordStatus {
  if (asset.lifecycle === 'DELETED') {
    return 'DELETED';
  }
  if (asset.lifecycle === 'RETAINED_BY_POLICY') {
    return 'RETAINED_BY_POLICY';
  }
  if (asset.lifecycle === 'SUPERSEDED') {
    return 'SUPERSEDED';
  }
  if (disputed) {
    return 'DISPUTED';
  }
  return 'ACTIVE';
}

export function projectVaultDataRecord(input: {
  readonly asset: DataAsset;
  readonly versions?: readonly DataAssetVersion[];
  readonly derivations?: readonly DataDerivation[];
  readonly metadata?: VaultRecordMetadata;
  readonly category?: VaultCategoryRecord;
}): VaultDataRecord {
  const metadata = input.metadata ?? defaultRecordMetadata(input.asset);
  const category = input.category ?? DEFAULT_CATEGORY_REGISTRY.get(metadata.registryCategory) ?? DEFAULT_CATEGORY_REGISTRY.fromAssetCategory(input.asset.category);
  const current = input.versions?.find((row) => row.versionId === input.asset.currentVersionId);
  const updatedAt = current?.createdAt ?? input.asset.createdAt;
  return Object.freeze({
    schema: 'sunrey.vault.data-record.v1',
    dataRecordId: input.asset.assetId,
    ownerSubjectId: input.asset.subjectId,
    dataCategory: category.categoryId,
    dataType: input.asset.schemaId,
    dataKind: metadata.dataKind,
    schemaVersion: input.asset.schemaVersion,
    source: input.asset.sourceId,
    sourceReference: input.asset.provenance.sourceRecordRef,
    provenance: enhanceProvenance({
      asset: input.asset,
      dataKind: metadata.dataKind,
      verification: metadata.verificationState,
      derivations: input.derivations ?? [],
      parentRecordIds: metadata.parentRecordIds,
      licenseRef: metadata.licenseRef,
    }),
    createdAt: input.asset.createdAt,
    observedAt: input.asset.observedAt,
    updatedAt,
    verificationState: metadata.verificationState,
    confidence: metadata.dataKind === 'AI_INFERENCE' ? 'AI_INFERRED' : input.asset.provenance.confidence,
    classification:
      category.classification ??
      classificationFromLegacySensitivity(input.asset.sensitivity, input.asset.category),
    retentionPolicy: category.retention,
    consentReference: metadata.consentReference,
    purposeRestrictions: metadata.purposeRestrictions,
    accessPolicy: Object.freeze({
      ownerOnly: true,
      agentEligible: category.agentAccessEligible,
      allowedPurposes: category.allowedPurposes,
      getAllUserDataForbidden: true,
    }),
    integrityHash: input.asset.contentSha256,
    status: statusFromAsset(input.asset, metadata.disputed),
    ownership: ownershipForSubject({
      subjectId: input.asset.subjectId,
      sourceId: input.asset.sourceId,
    }),
    version: input.asset.expectedVersion,
    currentVersionId: input.asset.currentVersionId,
    parentRecordIds: metadata.parentRecordIds,
    changeReason: metadata.changeReason,
    disputed: metadata.disputed,
    authoritativeForFinancialState: false,
    productionActive: false,
    liveMonetizationEnabled: false,
  });
}
