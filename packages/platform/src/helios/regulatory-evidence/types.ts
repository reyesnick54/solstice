import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type {
  RegulatoryEvidencePackageId,
  RegulatoryTraceId,
  ReportPackageId,
  ReportingObligationId,
  SubmissionRecordId,
  TriggerEventId,
} from './ids.ts';
import type {
  ObligationStatus,
  ReportabilityDetermination,
  ReportingTriggerCategory,
  ResponsibleFilerState,
  RetentionClass,
  SubmissionLifecycleState,
  ValidationFailureCode,
  RegulatoryAccessRole,
} from './taxonomy.ts';

export type CustomerContextRef = {
  readonly customerId: CustomerId;
  readonly accountIds: readonly string[];
  readonly customerClass: string;
  readonly jurisdiction: Jurisdiction;
};

export type AuthorityContextRef = {
  readonly mandateRef: string;
  readonly approvalRef: string | null;
  readonly legalEntityRef: string;
  readonly providerId: string | null;
  readonly capabilityPackVersion: string;
  readonly policyVersion: string;
};

export type IntelligenceContextRef = {
  readonly observationRefs: readonly string[];
  readonly observationTimestamps: readonly UtcInstant[];
  readonly provenanceRefs: readonly string[];
  readonly modelVersion: string | null;
  readonly researchResultRef: string | null;
  readonly strategyCapsuleId: string | null;
  readonly strategyCapsuleVersion: string | null;
  readonly quantitativeAssumptionRefs: readonly string[];
};

export type ControlDecisionRef = {
  readonly riskDecisionRef: string | null;
  readonly riskOutcome: string | null;
  readonly kernelDecisionRef: string | null;
  readonly kernelOutcome: string | null;
  readonly reasonCodes: readonly string[];
  readonly envelopeId: string | null;
  readonly executionAuthorityRef: string | null;
};

export type FinancialLifecycleRef = {
  readonly fundingRef: string | null;
  readonly orderId: string | null;
  readonly acknowledgementRef: string | null;
  readonly fillRefs: readonly string[];
  readonly feeRefs: readonly string[];
  readonly settlementRefs: readonly string[];
  readonly reconciliationRef: string | null;
  readonly withdrawalRef: string | null;
  readonly realizedStateRef: string | null;
  readonly unrealizedStateRef: string | null;
};

export type RetentionMetadata = {
  readonly retentionClass: RetentionClass;
  readonly retentionClassRef: string;
  readonly startEventRef: string;
  readonly expiryOrReviewDate: UtcInstant | null;
  readonly holdState: 'NONE' | 'LEGAL_HOLD' | 'REGULATORY_HOLD';
  readonly jurisdiction: Jurisdiction | 'UNMAPPED';
  readonly evidenceRefs: readonly string[];
};

export type RegulatoryEvidencePackage = {
  readonly packageId: RegulatoryEvidencePackageId;
  readonly traceId: RegulatoryTraceId;
  readonly packageVersion: number;
  readonly packageHash: string;
  readonly customerScope: CustomerContextRef;
  readonly actionEventRef: string;
  readonly actionEventKind: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly jurisdiction: Jurisdiction;
  readonly legalEntityRef: string;
  readonly capabilityPolicyVersion: string;
  readonly obligationRefs: readonly ReportingObligationId[];
  readonly evidenceRefs: readonly string[];
  readonly controlDecisions: ControlDecisionRef;
  readonly authorityContext: AuthorityContextRef;
  readonly intelligenceContext: IntelligenceContextRef;
  readonly financialRefs: FinancialLifecycleRef;
  readonly reportabilityDetermination: ReportabilityDetermination;
  readonly reportingStatus: SubmissionLifecycleState;
  readonly vaultEvidenceId: string | null;
  readonly createdAt: UtcInstant;
  readonly supersedesPackageId: RegulatoryEvidencePackageId | null;
  readonly correctionReason: string | null;
};

export type ReportingObligation = {
  readonly obligationId: ReportingObligationId;
  readonly traceId: RegulatoryTraceId;
  readonly packageId: RegulatoryEvidencePackageId;
  readonly policyObligationRef: string;
  readonly policyVersion: string;
  readonly approvedPolicySourceRef: string;
  readonly jurisdiction: Jurisdiction | 'UNMAPPED';
  readonly legalEntityRef: string;
  readonly productActivity: string;
  readonly triggerCategory: ReportingTriggerCategory;
  readonly triggerEventId: TriggerEventId;
  readonly reportType: string;
  readonly responsibleFiler: ResponsibleFilerState;
  readonly dueRuleKind: string;
  readonly dueAt: UtcInstant | null;
  readonly reportingWindowStart: UtcInstant | null;
  readonly reportingWindowEnd: UtcInstant | null;
  readonly evidenceRequirementRefs: readonly string[];
  readonly submissionChannelRef: string | null;
  readonly retention: RetentionMetadata;
  readonly status: ObligationStatus;
  readonly submissionState: SubmissionLifecycleState;
  readonly mappingStatus: 'APPROVED' | 'LEGAL_REVIEW_REQUIRED' | 'UNMAPPED';
  readonly reportPackageId: ReportPackageId | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ReportPackageSection = {
  readonly sectionId: string;
  readonly title: string;
  readonly canonicalEventIds: readonly string[];
  readonly financialRecordRefs: readonly string[];
  readonly complianceDecisionRefs: readonly string[];
  readonly providerEvidenceRefs: readonly string[];
  readonly policyVersion: string;
  readonly capturedAt: UtcInstant;
  readonly narrativeSummary: string | null;
};

export type StructuredReportPackage = {
  readonly reportPackageId: ReportPackageId;
  readonly obligationId: ReportingObligationId;
  readonly packageId: RegulatoryEvidencePackageId;
  readonly traceId: RegulatoryTraceId;
  readonly revision: number;
  readonly reportType: string;
  readonly policyVersion: string;
  readonly responsibleFiler: ResponsibleFilerState;
  readonly sections: readonly ReportPackageSection[];
  readonly validationFailures: readonly ValidationFailureCode[];
  readonly submissionState: SubmissionLifecycleState;
  readonly generatedAt: UtcInstant;
  readonly supersedesReportPackageId: ReportPackageId | null;
  readonly correctionReason: string | null;
  readonly packageHash: string;
};

export type SubmissionAcknowledgement = {
  readonly submissionRecordId: SubmissionRecordId;
  readonly reportPackageId: ReportPackageId;
  readonly obligationId: ReportingObligationId;
  readonly submissionReference: string;
  readonly submittedAt: UtcInstant;
  readonly submitterAuthority: string;
  readonly externalAcknowledgementRef: string | null;
  readonly regulatorProviderReference: string | null;
  readonly responseStatus: 'PENDING' | 'ACKNOWLEDGED' | 'REJECTED';
  readonly acknowledgedAt: UtcInstant | null;
  readonly rejectionReason: string | null;
};

export type TriggerEvent = {
  readonly triggerEventId: TriggerEventId;
  readonly traceId: RegulatoryTraceId;
  readonly sourceEventId: string;
  readonly sourceEventKind: string;
  readonly triggerCategory: ReportingTriggerCategory;
  readonly customerId: CustomerId;
  readonly jurisdiction: Jurisdiction | null;
  readonly productActivity: string;
  readonly detectedAt: UtcInstant;
  readonly idempotencyKey: string;
  readonly metadata: Readonly<Record<string, string>>;
};

export type ConsequentialActionContext = {
  readonly traceId: RegulatoryTraceId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly actionEventRef: string;
  readonly actionEventKind: string;
  readonly customerScope: CustomerContextRef;
  readonly authorityContext: AuthorityContextRef;
  readonly intelligenceContext: IntelligenceContextRef;
  readonly controlDecisions: ControlDecisionRef;
  readonly financialRefs: FinancialLifecycleRef;
  readonly now: UtcInstant;
  readonly idempotencyKey: string;
};

export type TriggerDetectionInput = {
  readonly sourceEventId: string;
  readonly sourceEventKind: string;
  readonly triggerCategory: ReportingTriggerCategory;
  readonly customerId: CustomerId;
  readonly jurisdiction: Jurisdiction | null;
  readonly productActivity: string;
  readonly traceId: RegulatoryTraceId;
  readonly now: UtcInstant;
  readonly idempotencyKey: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type RegulatoryEvidenceStoreSnapshot = {
  readonly packages: readonly RegulatoryEvidencePackage[];
  readonly obligations: readonly ReportingObligation[];
  readonly reportPackages: readonly StructuredReportPackage[];
  readonly submissions: readonly SubmissionAcknowledgement[];
  readonly triggers: readonly TriggerEvent[];
  readonly processedIdempotencyKeys: readonly string[];
};

export type RegulatoryEvidenceFailureCode =
  | 'CUSTOMER_MISMATCH'
  | 'TRACE_NOT_FOUND'
  | 'OBLIGATION_NOT_FOUND'
  | 'REPORT_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'VALIDATION_FAILED'
  | 'ACCESS_DENIED'
  | 'SUBMISSION_NOT_AUTHORIZED'
  | 'DUPLICATE_IDEMPOTENCY'
  | 'PACKAGE_NOT_FOUND';

export type RegulatoryEvidenceFailure = {
  readonly code: RegulatoryEvidenceFailureCode;
  readonly message: string;
};

export type ReconstructionGraph = {
  readonly traceId: RegulatoryTraceId;
  readonly customer: CustomerContextRef;
  readonly jurisdiction: Jurisdiction | 'UNMAPPED';
  readonly mandate: string;
  readonly capabilityPolicy: string;
  readonly evidencePackage: RegulatoryEvidencePackage;
  readonly obligations: readonly ReportingObligation[];
  readonly reportPackages: readonly StructuredReportPackage[];
  readonly submissions: readonly SubmissionAcknowledgement[];
  readonly model: IntelligenceContextRef;
  readonly strategy: { readonly capsuleId: string | null; readonly version: string | null };
  readonly risk: ControlDecisionRef;
  readonly compliance: ControlDecisionRef;
  readonly authorization: string | null;
  readonly execution: FinancialLifecycleRef;
  readonly fill: readonly string[];
  readonly fee: readonly string[];
  readonly settlement: readonly string[];
  readonly reconciliation: string | null;
  readonly result: { readonly realized: string | null; readonly unrealized: string | null };
  readonly reportingObligation: readonly ReportingObligation[];
  readonly reportingStatus: SubmissionLifecycleState;
};

export type RegulatoryAccessContext = {
  readonly actorId: string;
  readonly roles: readonly RegulatoryAccessRole[];
  readonly customerId: CustomerId | null;
};
