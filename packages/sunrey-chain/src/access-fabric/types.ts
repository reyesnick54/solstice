/**
 * ACCESS-10 foundation + ACCESS-11 completion/evidence types.
 *
 * Canonical access lifecycle: reservation → activation → metering →
 * delivery/usage proof → completion → settlement proposal.
 *
 * UsageProof and DeliveryClaim carry source/evidence quality and
 * provenance. Provider self-report alone is insufficient when policy
 * or existing verification architecture requires independent evidence.
 */

export const ACCESS_FABRIC_SCHEMA_VERSION = 1 as const;
export const ACCESS_FABRIC_POLICY_VERSION = 1 as const;

export const ACCESS_SERVICE_DOMAINS = [
  'VEHICLE_RENTAL',
  'HOSPITALITY',
  'COMPUTE',
  'ENERGY',
  'FOOD_DELIVERY',
  'GENERIC_SERVICE',
] as const;
export type AccessServiceDomain = (typeof ACCESS_SERVICE_DOMAINS)[number];

export const ACCESS_WORKFLOW_EVENTS = [
  'SERVICE_STARTED',
  'ACCESS_ACTIVATED',
  'USAGE_MEASURED',
  'PARTIAL_USAGE',
  'CAPACITY_DELIVERED',
  'CAPACITY_NOT_DELIVERED',
  'SERVICE_COMPLETED',
  'RETURN_COMPLETED',
  'OVERAGE',
  'EARLY_TERMINATION',
  'DISPUTE',
  'REFUND_ADJUSTMENT_PROPOSAL',
] as const;
export type AccessWorkflowEvent = (typeof ACCESS_WORKFLOW_EVENTS)[number];

export const ACCESS_SESSION_STATUSES = [
  'RESERVED',
  'ACTIVATED',
  'IN_USE',
  'COMPLETING',
  'COMPLETED',
  'DISPUTED',
  'TERMINATED',
  'REVOKED',
] as const;
export type AccessSessionStatus = (typeof ACCESS_SESSION_STATUSES)[number];

export const EVIDENCE_SOURCE_CLASSES = [
  'ORACLE_NETWORK',
  'CORROBORATED_INDEPENDENT',
  'PROVIDER_ATTESTED',
  'PROVIDER_SELF_REPORT',
] as const;
export type EvidenceSourceClass = (typeof EVIDENCE_SOURCE_CLASSES)[number];

export const EVIDENCE_QUALITY_LEVELS = [
  'INDEPENDENT_ORACLE',
  'CORROBORATED',
  'PROVIDER_ATTESTED',
  'SELF_REPORT_UNVERIFIED',
] as const;
export type EvidenceQualityLevel = (typeof EVIDENCE_QUALITY_LEVELS)[number];

export const DELIVERY_CLAIM_STATUSES = [
  'FULL',
  'PARTIAL',
  'FAILED',
  'NOT_DELIVERED',
] as const;
export type DeliveryClaimStatus = (typeof DELIVERY_CLAIM_STATUSES)[number];

export const DISPUTE_REASONS = [
  'DELIVERY_MISMATCH',
  'METER_CONFLICT',
  'ORACLE_CONFLICT',
  'CAPACITY_SHORTFALL',
  'OVERAGE_DISAGREEMENT',
  'EARLY_TERMINATION_DISPUTE',
  'FRAUDULENT_PROOF',
  'PROVIDER_REVOKED',
] as const;
export type AccessDisputeReason = (typeof DISPUTE_REASONS)[number];

export const ACCESS_REJECTION_CODES = [
  'SESSION_NOT_FOUND',
  'INVALID_STATE_TRANSITION',
  'PROVIDER_REVOKED',
  'PROOF_REPLAY',
  'PROOF_NONCE_REUSED',
  'SELF_REPORT_INSUFFICIENT',
  'ORACLE_CONFLICT',
  'METER_INCONSISTENT',
  'PROVENANCE_REQUIRED',
  'PROVENANCE_MISMATCH',
  'EVIDENCE_QUALITY_INSUFFICIENT',
  'DELIVERY_EXCEEDS_RESERVATION',
  'DISPUTE_ALREADY_OPEN',
  'SETTLEMENT_NOT_ROUTED',
  'FORBIDDEN_PRIVATE_DATA',
  'CONSIDERATION_REFERENCE_REQUIRED',
] as const;
export type AccessRejectionCode = (typeof ACCESS_REJECTION_CODES)[number];

export type IntegerQuantity = bigint;

/** ACCESS-10: what was reserved and why access may be granted. */
export type AccessReservation = {
  readonly schemaVersion: typeof ACCESS_FABRIC_SCHEMA_VERSION;
  readonly policyVersion: typeof ACCESS_FABRIC_POLICY_VERSION;
  readonly reservationId: string;
  readonly sessionId: string;
  readonly subjectRef: string;
  readonly providerRef: string;
  readonly serviceDomain: AccessServiceDomain;
  readonly reservedQuantity: IntegerQuantity;
  readonly unit: string;
  readonly reservedFromUtc: string;
  readonly reservedUntilUtc: string;
  readonly policyRef: string;
  readonly purpose: string;
};

/** ACCESS-10: why access was granted and what consideration was exchanged. */
export type AccessGrantRecord = {
  readonly schemaVersion: typeof ACCESS_FABRIC_SCHEMA_VERSION;
  readonly policyVersion: typeof ACCESS_FABRIC_POLICY_VERSION;
  readonly grantId: string;
  readonly reservationId: string;
  readonly sessionId: string;
  readonly grantedAtUtc: string;
  readonly policyRef: string;
  readonly purpose: string;
  readonly considerationRef: string;
  readonly considerationMinorUnits: IntegerQuantity;
  readonly considerationCurrency: string;
};

export type EvidenceProvenance = {
  readonly provenanceDigest: string;
  readonly contentCommitment: string;
  readonly sourceSystem: string;
  readonly sourceClass: EvidenceSourceClass;
  readonly oracleFactRefs: readonly string[];
  readonly observedAtUtc: string;
};

export type UsageProof = {
  readonly schemaVersion: typeof ACCESS_FABRIC_SCHEMA_VERSION;
  readonly policyVersion: typeof ACCESS_FABRIC_POLICY_VERSION;
  readonly proofId: string;
  readonly sessionId: string;
  readonly measuredQuantity: IntegerQuantity;
  readonly unit: string;
  readonly measuredAtUtc: string;
  readonly evidenceQuality: EvidenceQualityLevel;
  readonly provenance: EvidenceProvenance;
  readonly nonce: string;
  readonly finalized: boolean;
};

export type DeliveryClaim = {
  readonly schemaVersion: typeof ACCESS_FABRIC_SCHEMA_VERSION;
  readonly policyVersion: typeof ACCESS_FABRIC_POLICY_VERSION;
  readonly claimId: string;
  readonly sessionId: string;
  readonly deliveredQuantity: IntegerQuantity;
  readonly reservedQuantity: IntegerQuantity;
  readonly unit: string;
  readonly claimStatus: DeliveryClaimStatus;
  readonly claimedAtUtc: string;
  readonly evidenceQuality: EvidenceQualityLevel;
  readonly provenance: EvidenceProvenance;
  readonly nonce: string;
};

export type AccessWorkflowRecord = {
  readonly recordId: string;
  readonly sessionId: string;
  readonly event: AccessWorkflowEvent;
  readonly occurredAtUtc: string;
  readonly evidenceVaultRef: string;
  readonly chainCommitment: string;
  readonly usageProofId: string | null;
  readonly deliveryClaimId: string | null;
};

export type AccessSession = {
  readonly sessionId: string;
  readonly reservation: AccessReservation;
  readonly grant: AccessGrantRecord;
  readonly status: AccessSessionStatus;
  readonly providerRevoked: boolean;
  readonly serviceStartedAtUtc: string | null;
  readonly activatedAtUtc: string | null;
  readonly completedAtUtc: string | null;
  readonly cumulativeUsage: IntegerQuantity;
  readonly usageProofIds: readonly string[];
  readonly deliveryClaimIds: readonly string[];
  readonly workflowRecordIds: readonly string[];
};

export type AccessDispute = {
  readonly disputeId: string;
  readonly sessionId: string;
  readonly reason: AccessDisputeReason;
  readonly openedAtUtc: string;
  readonly openedBy: string;
  readonly evidenceVaultRef: string;
  readonly chainCommitment: string;
  readonly status: 'OPEN' | 'RESOLVED';
};

/** Routes through canonical financial authority — not a direct ledger post. */
export type RefundAdjustmentProposal = {
  readonly schemaVersion: typeof ACCESS_FABRIC_SCHEMA_VERSION;
  readonly policyVersion: typeof ACCESS_FABRIC_POLICY_VERSION;
  readonly proposalId: string;
  readonly sessionId: string;
  readonly disputeId: string | null;
  readonly adjustmentMinorUnits: IntegerQuantity;
  readonly currency: string;
  readonly reason: string;
  readonly proposedAtUtc: string;
  readonly considerationRef: string;
  readonly requiresKernelReview: true;
  readonly routedToFinancialAuthority: true;
  readonly evidenceVaultRef: string;
  readonly chainCommitment: string;
};

export type AccessRejection = {
  readonly ok: false;
  readonly code: AccessRejectionCode;
  readonly message: string;
  readonly sessionId: string | null;
};

export type AccessCompletionSummary = {
  readonly sessionId: string;
  readonly whyAccessGranted: string;
  readonly whatWasReserved: string;
  readonly whatWasDelivered: string;
  readonly howMuchUsed: string;
  readonly policyAllowed: string;
  readonly considerationExchanged: string;
  readonly completionEvidenceRefs: readonly string[];
};

export type VerifiedAccessOracleFact = {
  readonly factId: string;
  readonly sessionId: string;
  readonly quantity: IntegerQuantity;
  readonly unit: string;
  readonly source: 'ORACLE_NETWORK' | 'PROVIDER_SELF_REPORT';
  readonly finalized: boolean;
  readonly conflicted: boolean;
  readonly oracleRefs: readonly string[];
};
