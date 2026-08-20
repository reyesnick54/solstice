import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  ChainBlockReference,
  ChainOperationId,
  ChainReceiptId,
  ChainRecordType,
  ChainTransactionId,
  ChainWriteIntentId,
} from '../../../../sunrey-chain/src/index.ts';

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
};

export type HinSubjectScope = {
  readonly rawSubjectId: string;
  readonly recipientContext: string;
  readonly purpose: string;
  readonly jurisdictionCell: string;
  readonly keyVersion: number;
};
