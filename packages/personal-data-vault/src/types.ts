import type { UtcInstant } from '../../domain/src/time.ts';
import type { DataKeyHandle } from '../../security/src/provider.ts';
import type {
  DataAccessRecordId,
  DataAssetId,
  DataAssetVersionId,
  DataDeletionRequestId,
  DataDerivationId,
  DataExportId,
  DataIngestionId,
  DataPayloadId,
  DataSchemaId,
  DataSchemaVersion,
  DataSourceId,
  PersonalDataVaultId,
} from './ids.ts';
import type {
  AccessDecision,
  AssetLifecycleState,
  ContributionMark,
  DataCategory,
  DataUseClass,
  ProvenanceKind,
  RetentionOutcome,
  SensitivityClass,
  SupportedContentType,
  VaultOperation,
  VersionState,
} from './taxonomy.ts';

export type PersonalDataVaultRecord = {
  readonly vaultId: PersonalDataVaultId;
  readonly subjectId: string;
  readonly customerId: string | null;
  readonly createdAt: UtcInstant;
  readonly subjectKeyHandle: DataKeyHandle;
  readonly kekKeyId: string;
  readonly kekVersion: number;
};

export type DataProvenance = {
  readonly kind: ProvenanceKind;
  readonly sourceId: DataSourceId;
  readonly sourceRecordRef: string;
  readonly ingestedAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly schemaId: DataSchemaId;
  readonly schemaVersion: DataSchemaVersion;
  readonly contentSha256: string;
  readonly confidence: 'USER_DECLARED' | 'EXTERNAL' | 'DERIVED' | 'SIMULATED';
};

export type RetentionMetadata = {
  readonly policyId: string | null;
  readonly policySource: string | null;
  readonly reason: string | null;
};

export type DataAsset = {
  readonly assetId: DataAssetId;
  readonly vaultId: PersonalDataVaultId;
  readonly subjectId: string;
  readonly category: DataCategory;
  readonly schemaId: DataSchemaId;
  readonly schemaVersion: DataSchemaVersion;
  readonly sourceId: DataSourceId;
  readonly provenance: DataProvenance;
  readonly sensitivity: SensitivityClass;
  readonly currentVersionId: DataAssetVersionId | null;
  readonly currentPayloadId: DataPayloadId | null;
  readonly contentSha256: string | null;
  readonly createdAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly effectiveFrom: UtcInstant | null;
  readonly effectiveTo: UtcInstant | null;
  readonly lifecycle: AssetLifecycleState;
  readonly retention: RetentionMetadata;
  readonly derivationState: 'NONE' | 'SOURCE' | 'DERIVED';
  readonly contributionMark: ContributionMark;
  readonly authoritativeForFinancialState: false;
  readonly financialBalance: null;
  readonly tokenBalance: null;
  readonly expectedVersion: number;
};

export type DataAssetVersion = {
  readonly versionId: DataAssetVersionId;
  readonly assetId: DataAssetId;
  readonly subjectId: string;
  readonly sequence: number;
  readonly payloadId: DataPayloadId | null;
  readonly contentSha256: string | null;
  readonly schemaId: DataSchemaId;
  readonly schemaVersion: DataSchemaVersion;
  readonly state: VersionState;
  readonly createdAt: UtcInstant;
  readonly supersededAt: UtcInstant | null;
  readonly kekVersion: number;
  readonly rotationGeneration: number;
};

export type DataIngestionRecord = {
  readonly ingestionId: DataIngestionId;
  readonly assetId: DataAssetId;
  readonly subjectId: string;
  readonly sourceId: DataSourceId;
  readonly sourceRecordRef: string;
  readonly idempotencyKey: string;
  readonly sourceRevision: number;
  readonly contentType: SupportedContentType;
  readonly createdAt: UtcInstant;
};

export type DataAccessRecord = {
  readonly accessId: DataAccessRecordId;
  readonly actorId: string;
  readonly subjectId: string;
  readonly assetId: string;
  readonly operation: VaultOperation;
  readonly purposeRef: string;
  readonly requestedScope: string;
  readonly useClass: DataUseClass;
  readonly decision: AccessDecision;
  readonly reason: string;
  readonly occurredAt: UtcInstant;
  readonly consentDecisionId?: string;
  readonly purposeId?: string;
  readonly consentVersion?: string;
  readonly permitId?: string;
};

export type DataDerivation = {
  readonly derivationId: DataDerivationId;
  readonly outputAssetId: DataAssetId;
  readonly sourceAssetIds: readonly DataAssetId[];
  readonly method: string;
  readonly methodVersion: string;
  readonly outputSchemaId: DataSchemaId;
  readonly outputSchemaVersion: DataSchemaVersion;
  readonly confidence: 'DERIVED';
  readonly createdAt: UtcInstant;
};

export type DataExportManifest = {
  readonly format: 'SolsticePersonalDataExportV1';
  readonly exportId: DataExportId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly assetIds: readonly DataAssetId[];
  readonly schemaRefs: readonly string[];
  readonly contentHashes: readonly string[];
  readonly manifestSha256: string;
  readonly legalPortabilityClaim: false;
};

export type DataExportBundle = {
  readonly manifest: DataExportManifest;
  readonly assets: readonly {
    readonly metadata: DataAsset;
    readonly versions: readonly DataAssetVersion[];
    readonly payloadJson: unknown;
  }[];
};

export type DataDeletionRequest = {
  readonly requestId: DataDeletionRequestId;
  readonly assetId: DataAssetId;
  readonly subjectId: string;
  readonly requestedAt: UtcInstant;
  readonly outcome: RetentionOutcome;
  readonly policyId: string | null;
  readonly policySource: string | null;
  readonly technicalGuarantee: string;
  readonly completedAt: UtcInstant | null;
};

export type RetentionPolicyDecision = {
  readonly outcome: RetentionOutcome;
  readonly policyId: string;
  readonly policySource: string;
  readonly status: 'SIMULATION_RULE';
  readonly reason: string;
};

export type RetentionPolicyPort = {
  evaluate(input: {
    readonly asset: DataAsset;
    readonly requestedAt: UtcInstant;
  }): RetentionPolicyDecision;
};

export type VaultFailure = {
  readonly code:
    | 'VAULT_NOT_FOUND'
    | 'ASSET_NOT_FOUND'
    | 'SCHEMA_NOT_FOUND'
    | 'SCHEMA_INVALID'
    | 'UNSUPPORTED_TYPE'
    | 'LIMIT_EXCEEDED'
    | 'VERSION_CONFLICT'
    | 'IDEMPOTENT_REPLAY'
    | 'ENCRYPTION_FAILED'
    | 'DECRYPTION_FAILED'
    | 'INTEGRITY_FAILED'
    | 'PAYLOAD_UNREADABLE'
    | 'CROSS_SUBJECT_DENIED'
    | 'NOT_AUTHORITATIVE'
    | 'RETENTION_REQUIRED'
    | 'WILDCARD_FORBIDDEN'
    | 'INVALID_INPUT';
  readonly message: string;
};

export type PersonalDataVaultStoreSnapshot = {
  readonly vaults: readonly PersonalDataVaultRecord[];
  readonly assets: readonly DataAsset[];
  readonly versions: readonly DataAssetVersion[];
  readonly ingestions: readonly DataIngestionRecord[];
  readonly access: readonly DataAccessRecord[];
  readonly derivations: readonly DataDerivation[];
  readonly exports: readonly DataExportManifest[];
  readonly deletions: readonly DataDeletionRequest[];
  readonly payloads: readonly import('./encryption.ts').StoredEncryptedPayload[];
};
