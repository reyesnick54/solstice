/**
 * H12 — Qualified S3M-Finance serving taxonomy.
 * Explicit lifecycle semantics; HTTP 200 alone does not imply qualification.
 */

export const S3M_FINANCE_QUALIFICATION_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED',
  'SERVING_UNVERIFIED',
  'QUALIFICATION_PENDING',
  'QUALIFIED_SANDBOX',
  'QUALIFIED_PRIVATE_CONTEXT',
  'DEGRADED',
  'DISABLED',
  'REVOKED',
] as const;
export type S3mFinanceQualificationState = (typeof S3M_FINANCE_QUALIFICATION_STATES)[number];

export const S3M_AVAILABILITY_STATUSES = [
  'S3M_CONTRACT_READY',
  'S3M_EXTERNAL_DEPLOYMENT_QUALIFICATION_PENDING',
] as const;
export type S3mAvailabilityStatus = (typeof S3M_AVAILABILITY_STATUSES)[number];

export const S3M_FINANCE_HEALTH_STATES = ['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN'] as const;
export type S3mFinanceHealthState = (typeof S3M_FINANCE_HEALTH_STATES)[number];

export const S3M_PRIVACY_CLASSIFICATIONS = [
  'PUBLIC_RESEARCH',
  'INTERNAL',
  'CUSTOMER_PRIVATE',
  'RESTRICTED_SENSITIVE',
] as const;
export type S3mPrivacyClassification = (typeof S3M_PRIVACY_CLASSIFICATIONS)[number];

export const S3M_AUTHORIZED_CONTEXT_CLASSES = [
  'PEG_POSITION_SUMMARY',
  'PEG_GOAL_SUMMARY',
  'MARKET_OBSERVATION',
  'WORK_ORDER_SCOPE',
  'MANDATE_CONSTRAINT',
  'PUBLIC_RESEARCH',
] as const;
export type S3mAuthorizedContextClass = (typeof S3M_AUTHORIZED_CONTEXT_CLASSES)[number];

export const S3M_REASONING_NEXT_STATES = [
  'INVESTIGATE',
  'PROPOSE_CANDIDATE',
  'WAIT',
  'ABANDON',
  'NO_ACTION',
] as const;
export type S3mReasoningNextState = (typeof S3M_REASONING_NEXT_STATES)[number];

export const S3M_FALLBACK_POLICIES = [
  'WAIT',
  'DEGRADE_TO_PUBLIC_RESEARCH',
  'ABANDON',
  'REQUIRE_REVIEW',
] as const;
export type S3mFallbackPolicy = (typeof S3M_FALLBACK_POLICIES)[number];

export const S3M_SAFETY_STATUSES = ['ACCEPTED', 'REFUSED', 'DEGRADED', 'ERROR'] as const;
export type S3mSafetyStatus = (typeof S3M_SAFETY_STATUSES)[number];

/** Privacy classes requiring QUALIFIED_PRIVATE_CONTEXT deployment qualification. */
export const S3M_PRIVATE_CONTEXT_CLASSIFICATIONS = new Set<S3mPrivacyClassification>([
  'CUSTOMER_PRIVATE',
  'RESTRICTED_SENSITIVE',
]);

/** Qualification states that permit any inference dispatch. */
export const S3M_SERVING_ELIGIBLE_STATES = new Set<S3mFinanceQualificationState>([
  'QUALIFIED_SANDBOX',
  'QUALIFIED_PRIVATE_CONTEXT',
]);

/** Qualification states that permit private-context dispatch. */
export const S3M_PRIVATE_CONTEXT_ELIGIBLE_STATES = new Set<S3mFinanceQualificationState>([
  'QUALIFIED_PRIVATE_CONTEXT',
]);

export function s3mPrivacyRequiresPrivateQualification(
  classification: S3mPrivacyClassification,
): boolean {
  return S3M_PRIVATE_CONTEXT_CLASSIFICATIONS.has(classification);
}

export function s3mQualificationPermitsServing(state: S3mFinanceQualificationState): boolean {
  return S3M_SERVING_ELIGIBLE_STATES.has(state);
}

export function s3mQualificationPermitsPrivateContext(state: S3mFinanceQualificationState): boolean {
  return S3M_PRIVATE_CONTEXT_ELIGIBLE_STATES.has(state);
}
