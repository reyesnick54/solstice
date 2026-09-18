/**
 * HELIOS H29 — regulatory evidence and reporting lifecycle taxonomy.
 * Submission states are truthful: generation does not imply filing.
 */

export const HELIOS_H28_REPORTING_POLICY_VERSION = 'helios-reporting-policy-v1-approved-fixture' as const;

export const REPORTING_TRIGGER_CATEGORIES = [
  'TRANSACTION_EVENT',
  'SUSPICIOUS_COMPLIANCE_EVENT',
  'ORDER_TRADING_EVENT',
  'CUSTOMER_STATUS_EVENT',
  'PROVIDER_ACCOUNT_EVENT',
  'ALGORITHM_MODEL_EVENT',
  'THRESHOLD_REPORTABLE_ACTIVITY',
] as const;

export type ReportingTriggerCategory = (typeof REPORTING_TRIGGER_CATEGORIES)[number];

export const REPORTABILITY_DETERMINATIONS = [
  'NOT_REPORTABLE',
  'POTENTIALLY_REPORTABLE',
  'REPORTABLE',
  'LEGAL_REVIEW_REQUIRED',
  'UNMAPPED',
] as const;

export type ReportabilityDetermination = (typeof REPORTABILITY_DETERMINATIONS)[number];

export const RESPONSIBLE_FILER_STATES = [
  'SUNREY_RESPONSIBLE',
  'PARTNER_RESPONSIBLE',
  'PROVIDER_RESPONSIBLE',
  'JOINT_WORKFLOW',
  'UNRESOLVED',
] as const;

export type ResponsibleFilerState = (typeof RESPONSIBLE_FILER_STATES)[number];

export const SUBMISSION_LIFECYCLE_STATES = [
  'NOT_REQUIRED',
  'POTENTIALLY_REQUIRED',
  'PREPARATION_REQUIRED',
  'DRAFT',
  'VALIDATION_REQUIRED',
  'READY_FOR_AUTHORIZED_SUBMISSION',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'REJECTED',
  'CORRECTION_REQUIRED',
  'CORRECTED',
  'CLOSED',
  'UNKNOWN',
] as const;

export type SubmissionLifecycleState = (typeof SUBMISSION_LIFECYCLE_STATES)[number];

export const OBLIGATION_STATUSES = [
  'OPEN',
  'PREPARING',
  'VALIDATING',
  'READY',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'REJECTED',
  'CORRECTION_REQUIRED',
  'CORRECTED',
  'CLOSED',
  'LEGAL_REVIEW_REQUIRED',
  'UNMAPPED',
] as const;

export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export const RETENTION_CLASSES = [
  'REGULATORY_STANDARD',
  'LEGAL_HOLD',
  'EXTENDED_REVIEW',
  'UNMAPPED',
] as const;

export type RetentionClass = (typeof RETENTION_CLASSES)[number];

export const REGULATORY_ACCESS_ROLES = [
  'COMPLIANCE',
  'LEGAL',
  'AUDIT',
  'AUTHORIZED_ADMIN',
] as const;

export type RegulatoryAccessRole = (typeof REGULATORY_ACCESS_ROLES)[number];

export const VALIDATION_FAILURE_CODES = [
  'MISSING_REQUIRED_FIELD',
  'OBLIGATION_VERSION_UNKNOWN',
  'RESPONSIBLE_FILER_UNRESOLVED',
  'EVIDENCE_INCOMPLETE',
  'FINANCIAL_RECONCILIATION_MISMATCH',
  'POLICY_VERSION_MISSING',
  'CRITICAL_MISMATCH',
] as const;

export type ValidationFailureCode = (typeof VALIDATION_FAILURE_CODES)[number];

export const DUE_RULE_KINDS = [
  'APPROVED_POLICY_OFFSET',
  'LEGAL_REVIEW_REQUIRED',
  'UNMAPPED',
] as const;

export type DueRuleKind = (typeof DUE_RULE_KINDS)[number];

export function canTransitionSubmission(from: SubmissionLifecycleState, to: SubmissionLifecycleState): boolean {
  if (from === to) {
    return true;
  }
  const allowed: Record<SubmissionLifecycleState, readonly SubmissionLifecycleState[]> = {
    NOT_REQUIRED: ['NOT_REQUIRED', 'POTENTIALLY_REQUIRED', 'CLOSED'],
    POTENTIALLY_REQUIRED: ['PREPARATION_REQUIRED', 'NOT_REQUIRED', 'LEGAL_REVIEW_REQUIRED' as SubmissionLifecycleState, 'UNKNOWN'],
    PREPARATION_REQUIRED: ['DRAFT', 'VALIDATION_REQUIRED', 'NOT_REQUIRED'],
    DRAFT: ['VALIDATION_REQUIRED', 'PREPARATION_REQUIRED'],
    VALIDATION_REQUIRED: ['READY_FOR_AUTHORIZED_SUBMISSION', 'DRAFT', 'CORRECTION_REQUIRED'],
    READY_FOR_AUTHORIZED_SUBMISSION: ['SUBMITTED', 'VALIDATION_REQUIRED', 'CORRECTION_REQUIRED'],
    SUBMITTED: ['ACKNOWLEDGED', 'REJECTED', 'CORRECTION_REQUIRED'],
    ACKNOWLEDGED: ['CLOSED', 'CORRECTION_REQUIRED'],
    REJECTED: ['CORRECTION_REQUIRED', 'DRAFT', 'CLOSED'],
    CORRECTION_REQUIRED: ['DRAFT', 'VALIDATION_REQUIRED', 'CORRECTED'],
    CORRECTED: ['VALIDATION_REQUIRED', 'READY_FOR_AUTHORIZED_SUBMISSION', 'SUBMITTED'],
    CLOSED: ['CLOSED'],
    UNKNOWN: ['LEGAL_REVIEW_REQUIRED' as SubmissionLifecycleState, 'PREPARATION_REQUIRED', 'UNKNOWN'],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function generationIsNotSubmission(state: SubmissionLifecycleState): boolean {
  return state !== 'SUBMITTED' && state !== 'ACKNOWLEDGED' && state !== 'CLOSED';
}
