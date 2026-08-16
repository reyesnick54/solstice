import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  ChainAdapterId,
  ChainAttestationId,
  ChainBlockReference,
  ChainCommitmentId,
  ChainId,
  ChainNetworkId,
  ChainOperationId,
  ChainReceiptId,
  ChainReconciliationId,
  ChainSettlementAnchorId,
  ChainSubjectReference,
  ChainTransactionId,
  ChainWriteIntentId,
} from './ids.ts';
import type {
  ChainDataClass,
  ChainHealthStatus,
  ChainNetworkMode,
  ChainOperationState,
  ChainRecordType,
  ReconciliationOutcome,
  SourceSubsystem,
  SubjectReferenceKind,
} from './taxonomy.ts';

export type ChainFailure = {
  readonly code: string;
  readonly message: string;
};

export type ScopedSubjectReference = {
  readonly referenceId: ChainSubjectReference;
  readonly kind: SubjectReferenceKind;
  readonly recipientContext: string;
  readonly purpose: string;
  readonly jurisdictionCell: string;
  readonly keyVersion: number;
  readonly commitment: string;
};

export type ChainRecordSchema = {
  readonly recordType: ChainRecordType;
  readonly dataClass: ChainDataClass;
  readonly fields: Readonly<Record<string, string | number | boolean | null>>;
};

export type ConsentReceiptSchema = ChainRecordSchema & {
  readonly recordType: 'CONSENT_RECEIPT';
  readonly fields: {
    readonly consentId: string;
    readonly consentVersion: string;
    readonly consentHash: string;
    readonly purposeId: string;
    readonly purposeVersion: string;
    readonly subjectReference: string;
    readonly recipientClass: string;
    readonly scopeCommitment: string;
    readonly effectiveState: string;
    readonly expirationReference: string;
    readonly timestamp: string;
  };
};

export type ConsentRevocationSchema = ChainRecordSchema & {
  readonly recordType: 'CONSENT_REVOCATION';
  readonly fields: {
    readonly consentId: string;
    readonly consentVersion: string;
    readonly revocationId: string;
    readonly subjectReference: string;
    readonly revokedAt: string;
    readonly priorReceiptCommitment: string;
  };
};

export type AttestationSchema = ChainRecordSchema & {
  readonly recordType: 'ATTESTATION';
  readonly fields: {
    readonly attestationHash: string;
    readonly issuer: string;
    readonly subjectReference: string;
    readonly claimSchema: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly revocationState: string;
    readonly provenanceReference: string;
  };
};

export type ProvenanceSchema = ChainRecordSchema & {
  readonly recordType: 'PROVENANCE';
  readonly fields: {
    readonly sourceCommitment: string;
    readonly transformationReference: string;
    readonly authorizationReference: string;
    readonly outputCommitment: string;
  };
};

export type PolicyDecisionSchema = ChainRecordSchema & {
  readonly recordType: 'POLICY_DECISION';
  readonly fields: {
    readonly actionReference: string;
    readonly policyVersion: string;
    readonly rdtSnapshot: string;
    readonly kernelDecisionId: string;
    readonly outcome: string;
    readonly decisionCommitment: string;
  };
};

export type ComputationReceiptSchema = ChainRecordSchema & {
  readonly recordType: 'COMPUTATION_RECEIPT';
  readonly fields: {
    readonly receiptHash: string;
    readonly requesterReference: string;
    readonly purpose: string;
    readonly privacyPolicyVersion: string;
    readonly resultCommitment: string;
    readonly timestamp: string;
  };
};

export type ProofOfContributionSchema = ChainRecordSchema & {
  readonly recordType: 'PROOF_OF_CONTRIBUTION';
  readonly fields: {
    readonly contributionCommitment: string;
    readonly subjectReference: string;
    readonly purpose: string;
    readonly receiptReference: string;
    readonly doesNotMint: true;
  };
};

export type SettlementAnchorSchema = ChainRecordSchema & {
  readonly recordType: 'DIGITAL_ASSET_SETTLEMENT';
  readonly fields: {
    readonly journalId: string;
    readonly transferId: string;
    readonly assetCommitment: string;
    readonly authoritativeLedger: 'canonical-internal-ledger';
    readonly chainBalanceAuthoritative: false;
  };
};

export type ChainWriteIntent = {
  readonly intentId: ChainWriteIntentId;
  readonly operationId: ChainOperationId;
  readonly recordType: ChainRecordType;
  readonly sourceSubsystem: SourceSubsystem;
  readonly sourceRecordReference: string;
  readonly subjectReference: ScopedSubjectReference | null;
  readonly purpose: string;
  readonly payloadCommitment: string;
  readonly schema: ChainRecordSchema;
  readonly dataClass: ChainDataClass;
  readonly policyVersion: string;
  readonly jurisdictionCell: string;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly correlationId: string;
  readonly economicValueMovement: false;
};

export type ChainSignatureMetadata = {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly algorithm: string;
  readonly signatureHex: string;
};

export type ChainOperation = {
  readonly operationId: ChainOperationId;
  readonly intentId: ChainWriteIntentId;
  readonly adapterId: ChainAdapterId;
  readonly chainId: ChainId;
  readonly networkId: ChainNetworkId;
  readonly networkMode: ChainNetworkMode;
  readonly recordType: ChainRecordType;
  readonly commitmentId: ChainCommitmentId;
  readonly payloadCommitment: string;
  readonly state: ChainOperationState;
  readonly transactionId: ChainTransactionId | null;
  readonly receiptId: ChainReceiptId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly confirmations: number;
  readonly signature: ChainSignatureMetadata | null;
  readonly unknownAfterBroadcast: boolean;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly correlationId: string;
};

export type ChainReceipt = {
  readonly receiptId: ChainReceiptId;
  readonly operationId: ChainOperationId;
  readonly transactionId: ChainTransactionId;
  readonly blockReference: ChainBlockReference;
  readonly payloadCommitment: string;
  readonly accepted: boolean;
  readonly finalized: boolean;
  readonly reorgObserved: boolean;
  readonly recordedAt: UtcInstant;
};

export type ChainHealth = {
  readonly status: ChainHealthStatus;
  readonly networkMode: ChainNetworkMode;
  readonly adapterId: ChainAdapterId;
  readonly height: number;
  readonly reason: string | null;
  readonly observedAt: UtcInstant;
};

export type ChainOperationStatus = {
  readonly operationId: ChainOperationId;
  readonly state: ChainOperationState;
  readonly recordType: ChainRecordType;
  readonly payloadCommitment: string;
  readonly confirmations: number;
  readonly unknownAfterBroadcast: boolean;
};

export type ChainRecordProjection = {
  readonly commitmentId: ChainCommitmentId;
  readonly recordType: ChainRecordType;
  readonly payloadCommitment: string;
  readonly active: boolean;
  readonly supersededBy: ChainCommitmentId | null;
};

export type ConsentAnchorStatus = {
  readonly consentId: string;
  readonly receiptCommitment: string | null;
  readonly revocationCommitment: string | null;
  readonly projectedActive: boolean;
};

export type AttestationAnchorStatus = {
  readonly attestationId: ChainAttestationId | string;
  readonly commitment: string;
  readonly revocationState: string;
};

export type SettlementAnchorStatus = {
  readonly anchorId: ChainSettlementAnchorId | string;
  readonly journalId: string;
  readonly transferId: string;
  readonly chainState: ChainOperationState;
  readonly authoritativeBalanceSource: 'canonical-internal-ledger';
};

export type ReconciliationRecord = {
  readonly reconciliationId: ChainReconciliationId;
  readonly operationId: ChainOperationId;
  readonly outcome: ReconciliationOutcome;
  readonly sourceRecordReference: string;
  readonly intentCommitment: string;
  readonly chainCommitment: string | null;
  readonly notes: string;
  readonly autoFixed: false;
  readonly createdAt: UtcInstant;
};

export type SunReyChainStoreSnapshot = {
  readonly intents: readonly ChainWriteIntent[];
  readonly operations: readonly ChainOperation[];
  readonly receipts: readonly ChainReceipt[];
  readonly reconciliations: readonly ReconciliationRecord[];
  readonly health: ChainHealth;
};

export type SimulationAdapterControls = {
  readonly finalityDelayBlocks: number;
  readonly unavailable: boolean;
  readonly rejectNext: boolean;
  readonly unknownNext: boolean;
};
