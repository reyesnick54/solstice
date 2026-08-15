import type { UtcInstant } from '../../domain/src/time.ts';
import type { ConsentId, ConsentVersion, DataUsePermitId, PurposeId, PurposeVersion, RecipientId } from '../../consent/src/ids.ts';
import type { DataCategory } from '../../personal-data-vault/src/taxonomy.ts';
import type {
  AuthorizationSnapshotId,
  CleanRoomDatasetId,
  CleanRoomJobId,
  CleanRoomQueryId,
  CleanRoomRequesterId,
  CleanRoomSessionId,
  ComputationReceiptId,
  ContributionComputationId,
  EgressDecisionId,
  PrivacyPolicyVersion,
  PseudonymousJoinKeyId,
  QueryTemplateId,
  QueryTemplateVersion,
} from './ids.ts';
import type {
  CleanRoomJobState,
  CleanRoomReasonCode,
  CleanRoomSessionState,
  EgressDecision,
  QueryOperation,
  ThresholdLabel,
} from './taxonomy.ts';

export type CleanRoomFailure = {
  readonly code: CleanRoomReasonCode;
  readonly message: string;
};

export type QueryFilter = {
  readonly field: string;
  readonly eq?: string;
};

export type QueryAst = {
  readonly operation: QueryOperation;
  readonly field?: string;
  readonly categoryField?: string;
  readonly filters?: readonly QueryFilter[];
  readonly groupBy?: readonly string[];
  readonly buckets?: readonly { readonly startMinor: string; readonly endMinor: string }[];
  readonly rawRowExport?: boolean;
};

export type QueryTemplate = {
  readonly templateId: QueryTemplateId;
  readonly version: QueryTemplateVersion;
  readonly versionNumber: number;
  readonly code: string;
  readonly description: string;
  readonly ast: QueryAst;
  readonly allowedCategories: readonly DataCategory[];
  readonly allowedFields: readonly string[];
  readonly status: 'ACTIVE' | 'RETIRED';
};

export type CleanRoomRequester = {
  readonly requesterId: CleanRoomRequesterId;
  readonly recipientId: RecipientId;
  readonly actorSubjectId: string;
  readonly label: string;
  readonly simulationFixture: true;
  readonly liveEnterprise: false;
  readonly canBrowseVault: false;
  readonly canObtainKeys: false;
  readonly canRunArbitrarySql: false;
};

export type SubjectAuthorization = {
  readonly subjectId: string;
  readonly qualified: boolean;
  readonly reasonCode: CleanRoomReasonCode;
  readonly consentId: ConsentId | null;
  readonly consentVersion: ConsentVersion | null;
  readonly permitId: DataUsePermitId | null;
  readonly purposeId: PurposeId | null;
  readonly purposeVersion: PurposeVersion | null;
};

export type AuthorizationSnapshot = {
  readonly snapshotId: AuthorizationSnapshotId;
  readonly sessionId: CleanRoomSessionId;
  readonly subjects: readonly SubjectAuthorization[];
  readonly qualifiedSubjectIds: readonly string[];
  readonly createdAt: UtcInstant;
  readonly hash: string;
};

export type QueryBudget = {
  readonly sessionId: CleanRoomSessionId;
  readonly requesterId: CleanRoomRequesterId;
  readonly purposeId: PurposeId;
  readonly queriesUsed: number;
  readonly complexityUsed: number;
  readonly outputCardinalityUsed: number;
  readonly repeatedSlices: number;
  readonly expiresAt: UtcInstant;
  readonly differentialPrivacy: 'DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED';
};

export type CleanRoomSession = {
  readonly sessionId: CleanRoomSessionId;
  readonly requesterId: CleanRoomRequesterId;
  readonly recipientId: RecipientId;
  readonly requesterActorId: string;
  readonly proposedSubjectIds: readonly string[];
  readonly purposeId: PurposeId;
  readonly purposeVersion: PurposeVersion;
  readonly purposeRef: string;
  readonly consentIds: readonly ConsentId[];
  readonly consentVersions: readonly ConsentVersion[];
  readonly permitIds: readonly DataUsePermitId[];
  readonly allowedCategories: readonly DataCategory[];
  readonly allowedFields: readonly string[];
  readonly allowedTemplateIds: readonly QueryTemplateId[];
  readonly privacyPolicyVersion: PrivacyPolicyVersion;
  readonly authorizationSnapshotId: AuthorizationSnapshotId | null;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly status: CleanRoomSessionState;
  readonly denialReason: CleanRoomReasonCode | null;
};

export type CleanRoomJob = {
  readonly jobId: CleanRoomJobId;
  readonly sessionId: CleanRoomSessionId;
  readonly queryId: CleanRoomQueryId;
  readonly templateId: QueryTemplateId;
  readonly templateVersion: QueryTemplateVersion;
  readonly ast: QueryAst;
  readonly authorizationSnapshotId: AuthorizationSnapshotId;
  readonly datasetId: CleanRoomDatasetId | null;
  readonly status: CleanRoomJobState;
  readonly createdAt: UtcInstant;
  readonly startedAt: UtcInstant | null;
  readonly completedAt: UtcInstant | null;
  readonly reasonCode: CleanRoomReasonCode | null;
};

export type DatasetLineage = {
  readonly datasetId: CleanRoomDatasetId;
  readonly sessionId: CleanRoomSessionId;
  readonly jobId: CleanRoomJobId;
  readonly subjectCount: number;
  readonly assetRefs: readonly {
    readonly subjectId: string;
    readonly assetId: string;
    readonly versionId: string | null;
    readonly contentSha256: string | null;
    readonly category: DataCategory;
  }[];
  readonly fields: readonly string[];
  readonly createdAt: UtcInstant;
  readonly plaintextPersisted: false;
};

export type EgressRecord = {
  readonly decisionId: EgressDecisionId;
  readonly jobId: CleanRoomJobId;
  readonly decision: EgressDecision;
  readonly reasonCode: CleanRoomReasonCode;
  readonly reason: string;
  readonly cohortSize: number;
  readonly outputRowCount: number;
  readonly dimensions: number;
  readonly rawRowExport: boolean;
  readonly privacyPolicyVersion: PrivacyPolicyVersion;
  readonly onwardSharing: boolean;
  readonly occurredAt: UtcInstant;
};

export type CleanRoomComputationReceipt = {
  readonly receiptId: ComputationReceiptId;
  readonly sessionId: CleanRoomSessionId;
  readonly jobId: CleanRoomJobId;
  readonly requesterId: CleanRoomRequesterId;
  readonly purposeId: PurposeId;
  readonly purposeVersion: PurposeVersion;
  readonly consentRefs: readonly { readonly consentId: ConsentId; readonly version: ConsentVersion }[];
  readonly consentSnapshotHash: string;
  readonly permitIds: readonly DataUsePermitId[];
  readonly templateId: QueryTemplateId;
  readonly templateVersion: QueryTemplateVersion;
  readonly inputAssetHashes: readonly string[];
  readonly authorizedCohortCount: number;
  readonly computationImplementation: string;
  readonly computationVersion: string;
  readonly privacyPolicyVersion: PrivacyPolicyVersion;
  readonly egressDecision: EgressDecision;
  readonly resultHash: string;
  readonly generatedAt: UtcInstant;
  readonly rawInputIncluded: false;
  readonly immutable: true;
};

export type ContributionComputationReference = {
  readonly contributionId: ContributionComputationId;
  readonly subjectId: string;
  readonly receiptId: ComputationReceiptId;
  readonly purposeId: PurposeId;
  readonly participatingAssetRefs: readonly string[];
  readonly provenanceScoreInputs: {
    readonly sourceVerification: 'SIMULATED_CONNECTOR' | 'USER_DECLARED' | 'USER_UPLOADED';
    readonly provenanceStrength: 'CONNECTOR' | 'DECLARED' | 'UPLOAD';
    readonly freshness: string;
    readonly schemaCompleteness: 'COMPLETE' | 'PARTIAL';
    readonly duplicateState: 'UNIQUE' | 'DUPLICATE';
  };
  readonly participationState: 'INCLUDED' | 'EXCLUDED';
  readonly coinIssued: false;
  readonly marketPriceAssigned: false;
  readonly humanMonetaryValueAssigned: false;
  readonly marketplaceTrade: false;
  readonly settledEarnings: false;
};

export type ReleasedResult = {
  readonly shape: 'AGGREGATE';
  readonly operation: QueryOperation;
  readonly values: Readonly<Record<string, string | number | boolean | null>>;
  readonly groups?: readonly Readonly<Record<string, string | number | boolean | null>>[];
};

export type JobOutcome = {
  readonly job: CleanRoomJob;
  readonly egress: EgressRecord;
  readonly receipt: CleanRoomComputationReceipt | null;
  readonly result: ReleasedResult | null;
  readonly contributions: readonly ContributionComputationReference[];
};

export type PrivacyThresholds = {
  readonly minCohortSize: number;
  readonly minCellSize: number;
  readonly maxGroupingDimensions: number;
  readonly maxOutputRowCount: number;
  readonly maxQueriesPerSession: number;
  readonly label: ThresholdLabel;
  readonly legalSufficiency: ThresholdLabel;
};

export type CleanRoomStoreSnapshot = {
  readonly sessions: readonly CleanRoomSession[];
  readonly jobs: readonly CleanRoomJob[];
  readonly snapshots: readonly AuthorizationSnapshot[];
  readonly budgets: readonly QueryBudget[];
  readonly egress: readonly EgressRecord[];
  readonly receipts: readonly CleanRoomComputationReceipt[];
  readonly contributions: readonly ContributionComputationReference[];
  readonly lineage: readonly DatasetLineage[];
  readonly joinMetadata: readonly {
    readonly joinKeyId: PseudonymousJoinKeyId;
    readonly requesterId: CleanRoomRequesterId;
    readonly purposeId: PurposeId;
    readonly createdAt: UtcInstant;
  }[];
  readonly sessionIdempotency: Readonly<Record<string, string>>;
};

export type CandidatePolicySimulation = {
  readonly minCohortSize?: number;
  readonly permittedCategories?: readonly DataCategory[];
  readonly purposeRef?: string;
  readonly recipientId?: string;
  readonly jurisdiction?: string;
  readonly retentionDays?: number;
  readonly externalSharing?: boolean;
};
