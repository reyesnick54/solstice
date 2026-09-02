import type { CustomerId } from '../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';
import type {
  HumanEconomicIdentityId,
  IdentityLinkId,
  IdentityRecoveryId,
  IdentityRevocationId,
  SybilSignalId,
  UniquenessProofId,
} from './ids.ts';
import type { IdentityAssuranceLevel } from './assurance.ts';

export const HUMAN_ECONOMIC_IDENTITY_SCHEMA_VERSION = 1 as const;

export const HUMAN_ECONOMIC_IDENTITY_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'COMPROMISED',
  'RECOVERED',
] as const;

export type HumanEconomicIdentityStatus = (typeof HUMAN_ECONOMIC_IDENTITY_STATUSES)[number];

export const IDENTITY_CONTROLLER_KINDS = [
  'WALLET',
  'CUSTOMER_ACCOUNT',
  'SUNREY_IDENTITY',
  'HIN_SUBJECT',
  'CREDENTIAL',
  'EXTERNAL_IDENTITY',
] as const;

export type IdentityControllerKind = (typeof IDENTITY_CONTROLLER_KINDS)[number];

export const IDENTITY_LINK_PURPOSES = [
  'AUTHENTICATION',
  'CONTRIBUTION_ATTRIBUTION',
  'RECOVERY',
  'UNIQUENESS_BINDING',
  'WALLET_CONTROL',
] as const;

export type IdentityLinkPurpose = (typeof IDENTITY_LINK_PURPOSES)[number];

/**
 * Durable pseudonymous economic identity. Legal identity is not stored here.
 * `pseudonymousSubjectRef` is the canonical contribution subject (`subj_`).
 */
export type HumanEconomicIdentity = {
  readonly schemaVersion: typeof HUMAN_ECONOMIC_IDENTITY_SCHEMA_VERSION;
  readonly humanActorId: HumanEconomicIdentityId;
  readonly pseudonymousSubjectRef: SubjectRef;
  readonly assuranceLevel: IdentityAssuranceLevel;
  readonly status: HumanEconomicIdentityStatus;
  readonly jurisdiction: Jurisdiction;
  readonly identityProviderRefs: readonly string[];
  readonly credentialCommitments: readonly string[];
  readonly uniquenessProofRef: UniquenessProofId | null;
  readonly activeRevocationRef: IdentityRevocationId | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly version: number;
};

export type IdentityControllerLink = {
  readonly linkId: IdentityLinkId;
  readonly humanActorId: HumanEconomicIdentityId;
  readonly controllerKind: IdentityControllerKind;
  readonly controllerRef: string;
  readonly purposes: readonly IdentityLinkPurpose[];
  readonly rightsGrantRef: string | null;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly revokedAt: UtcInstant | null;
  readonly createdAt: UtcInstant;
};

export type ProviderIdentityReference = {
  readonly providerRef: string;
  readonly evidenceCommitment: string;
  readonly observedAt: UtcInstant;
};

export type UniquenessProofReceipt = {
  readonly proofId: UniquenessProofId;
  readonly humanActorId: HumanEconomicIdentityId;
  readonly policyId: string;
  readonly providerRef: string;
  readonly providerUniquenessCommitment: string;
  readonly evidenceCommitment: string;
  readonly jurisdiction: Jurisdiction;
  readonly establishedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly rawIdentityDocumentsPublished: false;
};

export type IdentityRecoverySession = {
  readonly recoveryId: IdentityRecoveryId;
  readonly humanActorId: HumanEconomicIdentityId;
  readonly state: 'REQUESTED' | 'EVIDENCE_REQUIRED' | 'UNIQUENESS_REQUIRED' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  readonly targetControllerKind: IdentityControllerKind;
  readonly targetControllerRef: string;
  readonly priorControllerRef: string | null;
  readonly evidenceRefs: readonly string[];
  readonly uniquenessProofRef: UniquenessProofId | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type IdentityRevocationRecord = {
  readonly revocationId: IdentityRevocationId;
  readonly humanActorId: HumanEconomicIdentityId;
  readonly status: 'SUSPENDED' | 'REVOKED' | 'COMPROMISED';
  readonly reasonCode: string;
  readonly evidenceRefs: readonly string[];
  readonly effectiveFrom: UtcInstant;
  readonly futureActionsBlocked: true;
  readonly rewritesHistoricalChain: false;
  readonly createdAt: UtcInstant;
};

export const SYBIL_SIGNAL_KINDS = [
  'DUPLICATE_PROVIDER_UNIQUENESS',
  'REUSED_EXTERNAL_IDENTITY',
  'REUSED_CREDENTIAL',
  'REUSED_USAGE_RECEIPT',
  'DUPLICATE_CONTRIBUTION_PATTERN',
  'MULTI_ACCOUNT_VELOCITY',
  'DEVICE_ABUSE',
  'GRAPH_RELATIONSHIP',
  'AI_PATTERN_SUGGESTION',
] as const;

export type SybilSignalKind = (typeof SYBIL_SIGNAL_KINDS)[number];

export const SYBIL_POLICY_OUTCOMES = ['ALLOW', 'REQUIRE_REVIEW', 'DENY_FUTURE_ACTION'] as const;
export type SybilPolicyOutcome = (typeof SYBIL_POLICY_OUTCOMES)[number];

/**
 * Sybil signal. AI-derived signals may only suggest review — never autonomous ban.
 */
export type SybilControlSignal = {
  readonly signalId: SybilSignalId;
  readonly humanActorId: HumanEconomicIdentityId;
  readonly kind: SybilSignalKind;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly relatedActorIds: readonly HumanEconomicIdentityId[];
  readonly relatedControllerRefs: readonly string[];
  readonly evidenceCommitment: string;
  readonly aiSuggested: boolean;
  readonly autonomousBan: false;
  readonly observedAt: UtcInstant;
};

export type SybilEvaluationResult = {
  readonly humanActorId: HumanEconomicIdentityId;
  readonly signals: readonly SybilControlSignal[];
  readonly policyOutcome: SybilPolicyOutcome;
  readonly autonomousBan: false;
  readonly evaluatedAt: UtcInstant;
};

export type IdentityFailure = {
  readonly code: string;
  readonly message: string;
};

export type RegisterHumanEconomicIdentityInput = {
  readonly humanActorId?: HumanEconomicIdentityId;
  readonly pseudonymousSubjectRef: SubjectRef;
  readonly assuranceLevel?: IdentityAssuranceLevel;
  readonly jurisdiction: Jurisdiction;
  readonly identityProviderRefs?: readonly string[];
  readonly credentialCommitments?: readonly string[];
  readonly createdAt: UtcInstant;
};

export type LinkIdentityControllerInput = {
  readonly humanActorId: HumanEconomicIdentityId;
  readonly controllerKind: IdentityControllerKind;
  readonly controllerRef: string;
  readonly purposes: readonly IdentityLinkPurpose[];
  readonly rightsGrantRef?: string | null;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil?: UtcInstant | null;
};

export type RecordUniquenessProofInput = {
  readonly humanActorId: HumanEconomicIdentityId;
  readonly policyId: string;
  readonly providerRef: string;
  readonly providerSubjectToken: string;
  readonly saltRef: string;
  readonly evidenceCommitment: string;
  readonly jurisdiction: Jurisdiction;
  readonly establishedAt: UtcInstant;
  readonly expiresAt?: UtcInstant | null;
};

export type BeginIdentityRecoveryInput = {
  readonly humanActorId: HumanEconomicIdentityId;
  readonly targetControllerKind: IdentityControllerKind;
  readonly targetControllerRef: string;
  readonly priorControllerRef?: string | null;
  readonly createdAt: UtcInstant;
};

export type CompleteIdentityRecoveryInput = {
  readonly recoveryId: IdentityRecoveryId;
  readonly evidenceRefs: readonly string[];
  readonly uniquenessProofRef?: UniquenessProofId | null;
  readonly completedAt: UtcInstant;
};

export type IdentityFactsForContribution = {
  readonly humanActorId: HumanEconomicIdentityId;
  readonly pseudonymousSubjectRef: SubjectRef;
  readonly assuranceLevel: IdentityAssuranceLevel;
  readonly status: HumanEconomicIdentityStatus;
  readonly operational: boolean;
  readonly identityCommitment: string;
  readonly customerId: CustomerId | null;
};
