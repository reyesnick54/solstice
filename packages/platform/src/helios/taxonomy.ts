export const WORK_ORDER_STATES = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'BLOCKED_BUDGET',
  'BLOCKED_AUTHORITY',
  'CANCELLED',
  'COMPLETED',
] as const;

export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];

export const TASK_STATES = [
  'QUEUED',
  'CLAIMABLE',
  'RUNNING',
  'WAITING',
  'RETRYABLE_FAILURE',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
  'PERMANENTLY_FAILED',
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export const TASK_FAILURE_CATEGORIES = [
  'TRANSIENT_DEPENDENCY',
  'RATE_LIMIT',
  'PROVIDER_UNAVAILABLE',
  'INVALID_INPUT',
  'AUTHORIZATION_CHANGED',
  'CAPABILITY_DISABLED',
  'BUDGET_EXHAUSTED',
  'PERMANENT_VALIDATION',
  'CANCELLED_REVOKED',
] as const;

export type TaskFailureCategory = (typeof TASK_FAILURE_CATEGORIES)[number];

export const BUDGET_UNIT_KINDS = [
  'MONETARY_MINOR',
  'INPUT_TOKENS',
  'OUTPUT_TOKENS',
  'INFERENCE_CALLS',
  'TOOL_CALLS',
  'DATA_QUERIES',
  'COMPUTE_DURATION_MS',
  'PROVIDER_METERED',
] as const;

export type BudgetUnitKind = (typeof BUDGET_UNIT_KINDS)[number];

export const SPEND_COST_STATUS = ['ACTUAL', 'ESTIMATED', 'UNKNOWN'] as const;
export type SpendCostStatus = (typeof SPEND_COST_STATUS)[number];

export const AUTHORITY_REVALIDATION = [
  'VALID',
  'REVOKED',
  'PAUSED',
  'CAPABILITY_DISABLED',
  'STALE_MANDATE',
] as const;

export type AuthorityRevalidationState = (typeof AUTHORITY_REVALIDATION)[number];

export const HELIOS_TASK_TYPES = [
  'RESEARCH_QUERY',
  'ANALYSIS',
  'EVIDENCE_GATHER',
  'SYNTHESIS',
  'NO_OP_CHECKPOINT',
] as const;

export type HeliosTaskType = (typeof HELIOS_TASK_TYPES)[number];

export const HELIOS_AUDIT_EVENT_KINDS = [
  'work_order_created',
  'task_created',
  'task_claimed',
  'lease_expired',
  'task_retried',
  'task_cancelled',
  'task_completed',
  'task_failed',
  'budget_reserved',
  'spend_recorded',
  'reservation_reconciled',
  'work_order_blocked_budget',
  'work_order_blocked_authority',
  'authority_revoked',
] as const;

export type HeliosAuditEventKind = (typeof HELIOS_AUDIT_EVENT_KINDS)[number];

export const HELIOS_CAPABILITIES = [
  'HELIOS_RESEARCH',
  'HELIOS_ANALYSIS',
  'HELIOS_EVIDENCE',
] as const;

export type HeliosCapability = (typeof HELIOS_CAPABILITIES)[number];

export const MODEL_CLASSES = ['SIMULATION', 'SANDBOX', 'PRODUCTION_CANDIDATE'] as const;
export type ModelClass = (typeof MODEL_CLASSES)[number];
