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
  HumanInformationAnchorId,
  HumanInformationAnchorReconciliationId,
  HumanInformationUsageAnchorProjectionId,
} from './ids.ts';

export const HIN_ANCHOR_FAILURE_CODES = [
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
  readonly code: HinAnchorFailureCode | string;
  readonly message: string;
};

export const HIN_ANCHOR_KINDS = [
  'CONSENT_RECEIPT',
  'CONSENT_REVOCATION',
  'USAGE_RECEIPT',
  'COMPUTATION_RECEIPT',
  'PROOF_OF_CONTRIBUTION',
  'DIGITAL_ASSET_SETTLEMENT',
] as const;
export type HinAnchorKind = (typeof HIN_ANCHOR_KINDS)[number];

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
  readonly anchorId: HumanInformationAnchorId;
  readonly kind: HinAnchorKind;
  readonly recordType: ChainRecordType;
  readonly sourceRecordId: string;
  readonly subjectHandle: string;
  readonly requesterId: string | null;
  readonly intentId: ChainWriteIntentId | null;
  readonly operationId: ChainOperationId | null;
  readonly payloadCommitment: string | null;
  readonly chainState: ChainOperationState;
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
  readonly chainState: ChainOperationState;
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
  readonly chainState: ChainOperationState;
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

export type HinAnchorPrepareInput = {
  readonly kind: HinAnchorKind;
  readonly sourceRecordId: string;
  readonly subjectHandle: string;
  readonly requesterId?: string | null;
  readonly purpose: string;
  readonly jurisdictionCell: string;
  readonly correlationId: string;
  readonly schemaFields: Readonly<Record<string, string | number | boolean | null>>;
  readonly subjectRawId?: string;
  readonly priorConsentCommitment?: string | null;
};
