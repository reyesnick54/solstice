export const INFERENCE_CANCELLATION_STATES = [
  'CANCEL_REQUESTED',
  'CANCELLED',
  'COMPLETED_BEFORE_CANCEL',
  'PROVIDER_CANNOT_CANCEL',
  'UNKNOWN',
] as const;
export type InferenceCancellationState = (typeof INFERENCE_CANCELLATION_STATES)[number];

export const INFERENCE_EXTERNAL_PRIVACY_CLASSES = [
  'PUBLIC',
  'SUNREY_INTERNAL',
  'CUSTOMER_PRIVATE',
  'RESTRICTED_SENSITIVE',
  'PROVIDER_PROHIBITED',
] as const;
export type InferenceExternalPrivacyClass = (typeof INFERENCE_EXTERNAL_PRIVACY_CLASSES)[number];

export const INFERENCE_COST_STATUS = ['ACTUAL', 'ESTIMATED', 'UNKNOWN'] as const;
export type InferenceCostStatus = (typeof INFERENCE_COST_STATUS)[number];

export const INFERENCE_TIMEOUT_KINDS = [
  'CONNECTION',
  'PROVIDER_PROCESSING',
  'TASK_DEADLINE',
  'WORK_ORDER_HORIZON',
] as const;
export type InferenceTimeoutKind = (typeof INFERENCE_TIMEOUT_KINDS)[number];

export const MODEL_QUALIFICATION_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED',
  'QUALIFICATION_PENDING',
  'QUALIFIED_SANDBOX',
  'DEGRADED',
  'UNAVAILABLE',
  'DISABLED',
] as const;
export type ModelQualificationState = (typeof MODEL_QUALIFICATION_STATES)[number];

export const INFERENCE_JOB_STATES = [
  'QUEUED',
  'DISPATCHING',
  'IN_FLIGHT',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
  'PROVIDER_UNAVAILABLE',
] as const;
export type InferenceJobState = (typeof INFERENCE_JOB_STATES)[number];

export const INFERENCE_RETRY_CATEGORIES = ['RETRYABLE', 'NON_RETRYABLE'] as const;
export type InferenceRetryCategory = (typeof INFERENCE_RETRY_CATEGORIES)[number];
