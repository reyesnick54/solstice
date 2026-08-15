import type { UtcInstant } from '../../domain/src/time.ts';
import type { AuthenticationAssurance } from '../../identity/src/assurance.ts';
import type { DataCategory, SensitivityClass } from '../../personal-data-vault/src/taxonomy.ts';
import type {
  ConsentDecisionId,
  ConsentGrantId,
  ConsentId,
  ConsentReceiptId,
  ConsentRevocationId,
  ConsentVersion,
  DataScopeId,
  DataUsePermitId,
  PurposeId,
  PurposePolicyId,
  PurposeVersion,
  RecipientId,
} from './ids.ts';
import type {
  ConsentOperation,
  ConsentReasonCode,
  ConsentState,
  DerivationType,
  FirewallDecision,
  LegalHookStatus,
  OnwardSharingState,
  PurposeCategory,
  PurposeCode,
  PurposeStatus,
  RecipientKind,
} from './taxonomy.ts';

export type ConsentScope = {
  readonly scopeId: DataScopeId;
  readonly assetIds: readonly string[];
  readonly categories: readonly DataCategory[];
  readonly fields: readonly string[];
  readonly windowFrom: UtcInstant | null;
  readonly windowTo: UtcInstant | null;
  readonly operations: readonly ConsentOperation[];
  readonly derivationTypes: readonly DerivationType[];
};

export type OnwardSharingRule = {
  readonly state: OnwardSharingState;
  readonly recipientClass: RecipientKind | null;
  readonly purposeId: PurposeId | null;
  readonly purposeVersion: PurposeVersion | null;
  readonly constraints: readonly string[];
};

export type RetentionInstruction = {
  readonly requestedRetentionDays: number | null;
  readonly reference: string;
  readonly statutoryClaim: false;
};

export type ConsentConfirmation = {
  readonly subjectId: string;
  readonly actorId: string;
  readonly authenticationAssurance: AuthenticationAssurance;
  readonly confirmedAt: UtcInstant;
  readonly consentVersion: ConsentVersion;
  readonly consentHash: string;
};

export type ConsentRecord = {
  readonly consentId: ConsentId;
  readonly grantId: ConsentGrantId;
  readonly subjectId: string;
  readonly version: ConsentVersion;
  readonly versionSequence: number;
  readonly recipientId: RecipientId;
  readonly purposeId: PurposeId;
  readonly purposeVersion: PurposeVersion;
  readonly purposeCode: PurposeCode;
  readonly scope: ConsentScope;
  readonly permittedOperations: readonly ConsentOperation[];
  readonly permittedCategories: readonly DataCategory[];
  readonly permittedAssetIds: readonly string[];
  readonly permittedDerivationTypes: readonly DerivationType[];
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly retention: RetentionInstruction;
  readonly onwardSharing: OnwardSharingRule;
  readonly jurisdiction: string | null;
  readonly confirmation: ConsentConfirmation | null;
  readonly createdAt: UtcInstant;
  readonly state: ConsentState;
  readonly supersedes: ConsentVersion | null;
  readonly policyId: PurposePolicyId;
  readonly sourceRef: string;
  readonly evidenceRef: string;
  readonly legalHook: LegalHookStatus;
  readonly revision: number;
};

export type ConsentReceipt = {
  readonly receiptId: ConsentReceiptId;
  readonly consentId: ConsentId;
  readonly version: ConsentVersion;
  readonly subjectId: string;
  readonly recipientId: RecipientId;
  readonly purposeId: PurposeId;
  readonly purposeVersion: PurposeVersion;
  readonly purposeCode: PurposeCode;
  readonly categories: readonly DataCategory[];
  readonly assetIds: readonly string[];
  readonly operations: readonly ConsentOperation[];
  readonly derivationTypes: readonly DerivationType[];
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly onwardSharing: OnwardSharingState;
  readonly confirmedAt: UtcInstant;
  readonly consentHash: string;
  readonly immutable: true;
};

export type ConsentRevocation = {
  readonly revocationId: ConsentRevocationId;
  readonly consentId: ConsentId;
  readonly version: ConsentVersion;
  readonly subjectId: string;
  readonly revokedAt: UtcInstant;
  readonly reason: string;
  readonly downstreamObligation: 'NOTIFY_DEPENDENTS_ONLY';
  readonly erasesDeliveredThirdPartyData: false;
};

export type PurposeRecord = {
  readonly purposeId: PurposeId;
  readonly purposeVersion: PurposeVersion;
  readonly versionNumber: number;
  readonly code: PurposeCode;
  readonly description: string;
  readonly category: PurposeCategory;
  readonly allowedCategories: readonly DataCategory[];
  readonly allowedOperations: readonly ConsentOperation[];
  readonly expectedRecipientKind: RecipientKind;
  readonly retentionExpectationDays: number | null;
  readonly onwardSharing: OnwardSharingState;
  readonly maxSensitivity: SensitivityClass;
  readonly status: PurposeStatus;
  readonly legalHook: LegalHookStatus;
  readonly createdAt: UtcInstant;
};

export type RecipientRecord = {
  readonly recipientId: RecipientId;
  readonly kind: RecipientKind;
  readonly serviceId: string;
  readonly label: string;
  readonly simulationFixture: true;
  readonly liveBuyer: false;
};

export type DataUsePermit = {
  readonly permitId: DataUsePermitId;
  readonly subjectId: string;
  readonly consentId: ConsentId;
  readonly consentVersion: ConsentVersion;
  readonly purposeId: PurposeId;
  readonly purposeVersion: PurposeVersion;
  readonly recipientId: RecipientId;
  readonly permittedAssetIds: readonly string[];
  readonly permittedCategories: readonly DataCategory[];
  readonly allowedOperation: ConsentOperation;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly nonce: string;
  readonly issuer: string;
  readonly signatureHex: string;
  readonly keyId: string;
  readonly keyVersion: number;
};

export type ConsentDecision = {
  readonly decisionId: ConsentDecisionId;
  readonly decision: FirewallDecision;
  readonly reasonCode: ConsentReasonCode;
  readonly reason: string;
  readonly subjectId: string;
  readonly purposeId: PurposeId | null;
  readonly purposeVersion: PurposeVersion | null;
  readonly consentId: ConsentId | null;
  readonly consentVersion: ConsentVersion | null;
  readonly permitId: DataUsePermitId | null;
  readonly actorId: string;
  readonly recipientId: RecipientId | null;
  readonly resourceId: string;
  readonly operation: ConsentOperation | null;
  readonly occurredAt: UtcInstant;
};

export type ConsentLedgerEntry = {
  readonly sequence: number;
  readonly consentId: ConsentId;
  readonly version: ConsentVersion;
  readonly kind:
    | 'DRAFT_CREATED'
    | 'GRANTED'
    | 'REVOKED'
    | 'EXPIRED'
    | 'SUPERSEDED'
    | 'REJECTED'
    | 'PERMIT_ISSUED'
    | 'ACCESS_DENIED'
    | 'PURPOSE_VERSIONED';
  readonly occurredAt: UtcInstant;
  readonly hash: string;
  readonly previousHash: string | null;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
};

export type ConsentStoreSnapshot = {
  readonly records: readonly ConsentRecord[];
  readonly receipts: readonly ConsentReceipt[];
  readonly revocations: readonly ConsentRevocation[];
  readonly decisions: readonly ConsentDecision[];
  readonly permits: readonly DataUsePermit[];
  readonly ledger: readonly ConsentLedgerEntry[];
  readonly purposes: readonly PurposeRecord[];
  readonly recipients: readonly RecipientRecord[];
  readonly grantIdempotency: Readonly<Record<string, string>>;
  readonly revokeIdempotency: Readonly<Record<string, string>>;
};

export type ConsentFailure = {
  readonly code: ConsentReasonCode;
  readonly message: string;
};
