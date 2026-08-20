import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  ChainBlockReference,
  ChainOperationId,
  ChainReceiptId,
  ChainTransactionId,
  ChainWriteIntentId,
} from '../../../../sunrey-chain/src/ids.ts';
import type { ChainOperationState, ChainRecordType, ReconciliationOutcome } from '../../../../sunrey-chain/src/taxonomy.ts';
import type {
  HumanInformationConsentGrantId,
  HumanInformationRevocationId,
  HumanInformationRightId,
  HumanInformationUsageReceiptId,
} from '../ids.ts';
import type {
  HumanInformationAnchorReconciliationId,
  HumanInformationUsageAnchorProjectionId,
} from './ids.ts';
import type { ChainRecordType } from '../../../../sunrey-chain/src/taxonomy.ts';

export const HIN_ANCHOR_KINDS = [
  'CONSENT_GRANT',
  'CONSENT_REVOCATION',
  'INFORMATION_RIGHT_STATE',
  'PURPOSE_GRANT',
  'USAGE_RECEIPT',
  'CLEAN_ROOM_COMPUTATION',
  'PROVENANCE',
  'HUMAN_CONTRIBUTION_PROOF',
  'COMPENSATION_SETTLEMENT_REFERENCE',
] as const;
export type HinAnchorKind = (typeof HIN_ANCHOR_KINDS)[number];

export const HIN_ANCHOR_STATES = [
  'CREATED',
  'INTENT_CREATED',
  'QUEUED',
  'SUBMITTED',
  'ACCEPTED',
  'SUBMITTED',
  'PENDING_FINALITY',
  'FINALIZED',
  'REJECTED',
  'UNKNOWN',
  'REORG_OBSERVED',
  'FAILED',
] as const;
export type HinAnchorState = (typeof HIN_ANCHOR_STATES)[number];

export const HIN_ANCHOR_FAILURE_CODES = [
  'HIN_ANCHOR_SOURCE_NOT_FOUND',
  'HIN_ANCHOR_KIND_UNSUPPORTED',
  'HIN_ANCHOR_PRIVACY_VIOLATION',
  'HIN_ANCHOR_SCHEMA_INVALID',
  'HIN_ANCHOR_DUPLICATE',
  'HIN_ANCHOR_SUBJECT_SCOPE_REQUIRED',
  'HIN_ANCHOR_SETTLEMENT_NOT_CANONICAL',
  'HIN_ANCHOR_CONTRIBUTION_NOT_VERIFIED',
  'HIN_ANCHOR_CHAIN_UNAVAILABLE',
  'HIN_ANCHOR_INTENT_CREATION_FAILED',
  'HIN_ANCHOR_OPERATION_NOT_FOUND',
  'HIN_ANCHOR_SUBMISSION_UNKNOWN',
  'HIN_ANCHOR_RECONCILIATION_REQUIRED',
  'HIN_ANCHOR_HASH_MISMATCH',
  'HIN_ANCHOR_REORG_OBSERVED',
  'HIN_ANCHOR_FINALITY_PENDING',
  'HIN_ANCHOR_REJECTED',
  'HIN_ANCHOR_FINALITY_UNAVAILABLE',
  'HIN_ANCHOR_SCOPE_MISMATCH',
] as const;
export type HinAnchorFailureCode = (typeof HIN_ANCHOR_FAILURE_CODES)[number];

export type HinAnchorFailure = {
  readonly code: HinAnchorFailureCode;
  readonly message: string;
};

export type HumanInformationAnchorId = string & { readonly __brand: 'HumanInformationAnchorId' };
export type HumanInformationAnchorKey = string & { readonly __brand: 'HumanInformationAnchorKey' };

export type HumanInformationChainAnchorRecord = {
  readonly anchorId: HumanInformationAnchorId;
  readonly anchorKind: HinAnchorKind;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: string;
  readonly chainRecordType: ChainRecordType;
  readonly payloadCommitment: string;
  readonly subjectReferenceCommitment: string | null;
  readonly intentId: ChainWriteIntentId | null;
  readonly operationId: ChainOperationId | null;
  readonly transactionId: ChainTransactionId | null;
  readonly receiptId: ChainReceiptId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly state: HinAnchorState;
  readonly confirmations: number;
  readonly policyVersion: string;
  readonly jurisdictionCell: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly rawSensitivePersonalInformation: false;
  readonly transfersOwnership: false;
  readonly createsMonetaryAuthority: false;
  readonly mintsAsset: false;
};

export type CanonicalSettlementReference = {
  readonly journalId: string;
  readonly transferId: string;
  readonly assetCommitment: string;
};

export type HinAnchorRequest = {
  readonly kind: HinAnchorKind;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion?: string;
  readonly contributionId?: string;
  readonly canonicalSettlement?: CanonicalSettlementReference;
  readonly extraPayload?: Readonly<Record<string, unknown>>;
  readonly requesterId?: string | null;
  readonly subjectHandle?: string;
  readonly priorConsentCommitment?: string | null;
};

export type HinSubjectScope = {
  readonly rawSubjectId: string;
  readonly recipientContext: string;
  readonly purpose: string;
  readonly jurisdictionCell: string;
  readonly keyVersion: number;
};

export const HIN_RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'PENDING',
  'REVIEW_REQUIRED',
  'REANCHOR_REVIEW_REQUIRED',
  'FAILED',
] as const;
export type HinReconciliationOutcome = (typeof HIN_RECONCILIATION_OUTCOMES)[number];

export const PRIVACY_SAFE_ANCHOR_PRESENTATIONS = ['FINALIZED', 'PENDING', 'REVIEW_REQUIRED'] as const;
export type PrivacySafeAnchorPresentation = (typeof PRIVACY_SAFE_ANCHOR_PRESENTATIONS)[number];

/**
 * HIN projection of an existing SunRey Chain operation.
 * States are the chain lifecycle, not a second finality model.
 */
export type HumanInformationAnchor = {
  readonly schemaVersion: 1;
  readonly record: HumanInformationChainAnchorRecord;
  readonly anchorId: HumanInformationAnchorId;
  readonly kind: HinAnchorKind;
  readonly recordType: ChainRecordType;
  readonly sourceRecordId: string;
  readonly subjectHandle: string;
  readonly requesterId: string | null;
  readonly intentId: ChainWriteIntentId | null;
  readonly operationId: ChainOperationId | null;
  readonly payloadCommitment: string | null;
  readonly chainState: HinAnchorState | ChainOperationState;
  readonly schedule: 'PENDING_ANCHOR' | 'SUBMITTED' | 'SETTLED' | 'REVIEW';
  readonly transactionId: ChainTransactionId | null;
  readonly receiptId: ChainReceiptId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly confirmations: number;
  readonly finalized: boolean;
  readonly unknownAfterBroadcast: boolean;
  readonly reorgObserved: boolean;
  readonly priorConsentCommitment: string | null;
  readonly revocationCommitment: string | null;
  readonly projectedActive: boolean;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly rawPersonalData: false;
  readonly mintsAsset: false;
  readonly altersLedger: false;
};

export type HumanInformationUsageAnchorProjection = {
  readonly schemaVersion: 2;
  readonly projectionId: HumanInformationUsageAnchorProjectionId;
  readonly receiptId: HumanInformationUsageReceiptId;
  readonly rightId: HumanInformationRightId;
  readonly anchorId: HumanInformationAnchorId;
  readonly chainHeight: bigint | null;
  readonly transactionId: ChainTransactionId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly finalized: boolean;
  readonly createdAt: UtcInstant;
};

export type HumanInformationConsentAnchorProjection = {
  readonly grantId: HumanInformationConsentGrantId;
  readonly anchorId: HumanInformationAnchorId;
  readonly payloadCommitment: string | null;
  readonly transactionId: ChainTransactionId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly chainState: HinAnchorState | ChainOperationState;
  readonly finalized: boolean;
  readonly projectedActive: boolean;
  readonly legalConsentAuthority: 'HIN';
};

export type HumanInformationRevocationAnchorProjection = {
  readonly revocationId: HumanInformationRevocationId;
  readonly grantId: HumanInformationConsentGrantId;
  readonly anchorId: HumanInformationAnchorId;
  readonly priorConsentAnchorCommitment: string | null;
  readonly revocationCommitment: string | null;
  readonly transactionId: ChainTransactionId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly finalized: boolean;
  readonly historicalConsentAnchorImmutable: true;
  readonly hinFutureUseBlocked: true;
};

export type HumanInformationAnchorReconciliation = {
  readonly reconciliationId: HumanInformationAnchorReconciliationId;
  readonly anchorId: HumanInformationAnchorId | null;
  readonly sourceRecordId: string;
  readonly operationId: ChainOperationId | null;
  readonly expectedCommitment: string | null;
  readonly observedCommitment: string | null;
  readonly chainOutcome: ReconciliationOutcome;
  readonly hinOutcome: HinReconciliationOutcome;
  readonly createdAt: UtcInstant;
  readonly autoFixed: false;
};

export type PrivacySafeAnchorStatus = {
  readonly presentation: PrivacySafeAnchorPresentation;
  readonly chainState: HinAnchorState | ChainOperationState;
  readonly transactionId: ChainTransactionId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly confirmations: number;
  readonly finalized: boolean;
};

export type HumanInformationAnchorHealth = {
  readonly chainAvailable: boolean;
  readonly pendingAnchors: number;
  readonly unknownSubmissions: number;
  readonly reconciliationFailures: number;
  readonly reorgCount: number;
  readonly oldestPendingAge: number | null;
  readonly isHumanScore: false;
};

export type HumanInformationRightsAuditV2 = {
  readonly schemaVersion: 2;
  readonly onChainAnchors: number;
  readonly anchorsCreated: number;
  readonly anchorsSubmitted: number;
  readonly anchorsFinalized: number;
  readonly anchorsPending: number;
  readonly anchorsReconciliationRequired: number;
  readonly anchorsReorgObserved: number;
};
