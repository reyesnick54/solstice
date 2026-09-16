export const WORK_ORDER_STATES = [
  'DRAFT',
  'AWAITING_AUTHORITY',
  'ACTIVE',
  'PAUSED',
  'BLOCKED',
  'BLOCKED_BUDGET',
  'BLOCKED_AUTHORITY',
  'REQUIRES_REVIEW',
  'REVOKED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
] as const;

export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];

export const OBJECTIVE_CLASSES = [
  'RESEARCH',
  'ANALYSIS',
  'FINANCIAL_PROPOSAL',
  'EXECUTION_PREP',
] as const;

export type ObjectiveClass = (typeof OBJECTIVE_CLASSES)[number];

export const ACTIVITY_CLASSES = [
  'RESEARCH',
  'DATA_ACCESS',
  'TOOL_USE',
  'FINANCIAL_PROPOSAL',
  'EXECUTION_PREP',
] as const;

export type ActivityClass = (typeof ACTIVITY_CLASSES)[number];

export const PRODUCT_CLASSES = [
  'CASH',
  'EQUITIES',
  'ETF',
  'BONDS',
  'CRYPTO',
  'DERIVATIVES',
  'FX',
] as const;

export type ProductClass = (typeof PRODUCT_CLASSES)[number];

export const APPROVAL_CLASSES = [
  'NONE',
  'INFORMED',
  'EXPLICIT_STEP_UP',
  'COMPLIANCE_REVIEW',
] as const;

export type ApprovalClass = (typeof APPROVAL_CLASSES)[number];

export const BINDING_DECISION_OUTCOMES = [
  'ALLOWED',
  'NARROWED',
  'BLOCKED',
  'REQUIRES_REVIEW',
] as const;

export type BindingDecisionOutcome = (typeof BINDING_DECISION_OUTCOMES)[number];

export const BINDING_REASON_CODES = [
  'OK',
  'MANDATE_NOT_ACTIVE',
  'MANDATE_EXPIRED',
  'MANDATE_REVOKED',
  'MANDATE_CUSTOMER_MISMATCH',
  'MANDATE_SCOPE_EXCEEDED',
  'CAPITAL_CEILING_EXCEEDED',
  'PRODUCT_CLASS_NOT_PERMITTED',
  'ACTIVITY_CLASS_NOT_PERMITTED',
  'OBJECTIVE_CLASS_NOT_PERMITTED',
  'CAPABILITY_UNKNOWN',
  'CAPABILITY_DISABLED',
  'CAPABILITY_RESTRICTED',
  'CAPABILITY_REVIEW_REQUIRED',
  'APPROVAL_REQUIRED',
  'APPROVAL_MISSING',
  'APPROVAL_CUSTOMER_MISMATCH',
  'APPROVAL_SCOPE_MISMATCH',
  'APPROVAL_EXPIRED',
  'APPROVAL_INVALIDATED',
  'AGENT_CANNOT_APPROVE',
  'MATERIAL_SCOPE_CHANGE',
  'AUTHORITY_REVOKED',
  'PLATFORM_CAPABILITY_UNAVAILABLE',
  'JURISDICTION_NOT_PERMITTED',
  'WORK_ORDER_CUSTOMER_MISMATCH',
  'CACHE_STALE',
] as const;

export type BindingReasonCode = (typeof BINDING_REASON_CODES)[number];

export const BINDING_CHECKPOINTS = [
  'CREATION',
  'ACTIVATION',
  'TASK_DISPATCH',
  'RESUME',
  'AMENDMENT',
  'FINANCIAL_PROPOSAL',
  'AUTHORITY_CHANGE',
] as const;

export type BindingCheckpoint = (typeof BINDING_CHECKPOINTS)[number];

export const CAPABILITY_RESOLUTION_STATES = [
  'ENABLED',
  'DISABLED',
  'UNKNOWN',
  'RESTRICTED',
  'REVIEW_REQUIRED',
  'EXPIRED',
] as const;

export type CapabilityResolutionState = (typeof CAPABILITY_RESOLUTION_STATES)[number];

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
