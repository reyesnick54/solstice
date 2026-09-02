import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ConsentGrantId, PurposeAuthorizationId, RightsGrantId, RightsRevocationId } from '../rights/ids.ts';
import type { ConsentGrant, PurposeAuthorization, RightsCommitment, RightsRevocation } from '../rights/types.ts';
import type {
  AuthorizedContributionKind,
  ConsentLifecycleState,
  HumanDataClassification,
  HumanEconomyPurposeCode,
  HumanEconomySchemaVersion,
  MinimumNecessaryProofKind,
} from './taxonomy.ts';
import type {
  AuthorizedContributionId,
  HumanDataUsageReceiptId,
  HumanEconomyConsentGrantId,
  OffChainRecordRefId,
} from './ids.ts';

/**
 * Human Economy specialization of Wave 3 ConsentGrant.
 * Supports specific purpose, scope, recipient, effective period, revocation,
 * renewal, version, proof, and usage receipt linkage.
 */
export type HumanEconomyConsentGrant = {
  readonly schemaVersion: HumanEconomySchemaVersion;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
  readonly baseConsentGrant: ConsentGrant;
  readonly purposeCode: HumanEconomyPurposeCode;
  readonly consentVersion: number;
  readonly renewedFromConsentId: HumanEconomyConsentGrantId | null;
  readonly recipientSystemRef: string;
  readonly scopeLabels: readonly string[];
  readonly lifecycleState: ConsentLifecycleState;
  readonly usageReceiptCommitments: readonly string[];
  readonly authorizesMonetaryIssuance: false;
  readonly authorizesDatasetMonetization: false;
};

/**
 * Raw data is not a contribution. Only explicitly authorized use under a
 * permitted purpose constitutes an economic contribution event.
 */
export type AuthorizedDatasetContribution = {
  readonly schemaVersion: HumanEconomySchemaVersion;
  readonly contributionId: AuthorizedContributionId;
  readonly kind: 'AUTHORIZED_DATASET_CONTRIBUTION';
  readonly subjectCommitment: string;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
  readonly purposeCode: HumanEconomyPurposeCode;
  readonly authorizedComputationRef: string;
  readonly dataClassification: HumanDataClassification;
  readonly offChainRecordRef: OffChainRecordRefId;
  readonly onChainCommitment: string;
  readonly rawDataOnChain: false;
  readonly occurredAt: UtcInstant;
};

export type AuthorizedComputationParticipation = {
  readonly schemaVersion: HumanEconomySchemaVersion;
  readonly contributionId: AuthorizedContributionId;
  readonly kind: 'AUTHORIZED_COMPUTATION_PARTICIPATION';
  readonly subjectCommitment: string;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
  readonly purposeCode: HumanEconomyPurposeCode;
  readonly computationRef: string;
  readonly computationCompleted: true;
  readonly resultEvidenceRef: string;
  readonly rawDataOnChain: false;
  readonly occurredAt: UtcInstant;
};

export type AuthorizedContribution = AuthorizedDatasetContribution | AuthorizedComputationParticipation;

/**
 * Minimum-necessary verification proof — prefer boolean attestations over
 * retrieving underlying personal records.
 */
export type MinimumNecessaryProof = {
  readonly kind: MinimumNecessaryProofKind;
  readonly valid: true;
  readonly evidenceRef: string;
  readonly underlyingRecordRequired: false;
};

export type HumanDataUsageReceipt = {
  readonly schemaVersion: HumanEconomySchemaVersion;
  readonly receiptId: HumanDataUsageReceiptId;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
  readonly rightsGrantId: RightsGrantId;
  readonly consentGrantId: ConsentGrantId;
  readonly purposeCode: HumanEconomyPurposeCode;
  readonly purposeId: PurposeAuthorizationId;
  readonly serviceRef: string;
  readonly occurredAt: UtcInstant;
  readonly computationQueryRef: string;
  readonly resultEvidenceRef: string;
  readonly policyVersion: string;
  readonly rightsCommitmentDigest: string;
  readonly rawSensitivePayload: false;
};

export type OffChainRecordReference = {
  readonly schemaVersion: HumanEconomySchemaVersion;
  readonly recordRefId: OffChainRecordRefId;
  readonly commitment: string;
  readonly classification: HumanDataClassification;
  readonly deletedAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
};

export type HumanEconomyDenialCode =
  | 'CONSENT_MISSING'
  | 'CONSENT_EXPIRED'
  | 'CONSENT_REVOKED'
  | 'PURPOSE_NOT_AUTHORIZED'
  | 'PURPOSE_IMPLIED_NOT_PERMITTED'
  | 'SCOPE_MISMATCH'
  | 'RECIPIENT_MISMATCH'
  | 'RAW_DATA_NOT_CONTRIBUTION'
  | 'CLASSIFICATION_TOO_SENSITIVE'
  | 'MINIMUM_NECESSARY_PROOF_MISSING'
  | 'OFF_CHAIN_RECORD_DELETED_FOR_FUTURE_USE';

export type HumanEconomyEvaluationRequest = {
  readonly humanConsent: HumanEconomyConsentGrant | null;
  readonly rightsGrant: import('../rights/types.ts').RightsGrant;
  readonly requestedPurpose: HumanEconomyPurposeCode;
  readonly authorizedPurpose: HumanEconomyPurposeCode;
  readonly scopeLabels: readonly string[];
  readonly recipientSystemRef: string;
  readonly at: UtcInstant;
  readonly revocations?: readonly RightsRevocation[];
  readonly contributionClass?: string;
  readonly minimumNecessaryProof?: MinimumNecessaryProof;
  readonly historicalEvaluation?: boolean;
};

export type HumanEconomyEvaluationAllow = {
  readonly decision: 'ALLOW';
  readonly purpose: PurposeAuthorization;
  readonly rightsCommitment: RightsCommitment;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
};

export type HumanEconomyEvaluationDeny = {
  readonly decision: 'DENY';
  readonly reasonCode: HumanEconomyDenialCode;
  readonly message: string;
};

export type HumanEconomyEvaluationResult = HumanEconomyEvaluationAllow | HumanEconomyEvaluationDeny;

export type HistoricalAuthorizationProof = {
  readonly executionAt: UtcInstant;
  readonly evaluatedAt: UtcInstant;
  readonly rightsCommitment: RightsCommitment;
  readonly humanConsentGrantId: HumanEconomyConsentGrantId;
  readonly validAtExecutionTime: true;
  readonly blockedForFutureUse: boolean;
  readonly revocationRef: RightsRevocationId | null;
};
