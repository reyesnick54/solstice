/**
 * HELIOS H04 Economic Work Order taxonomies.
 * Coordination envelope only. Not a ledger, Kernel, or Execution Authority.
 */

export const WORK_ORDER_STATES = [
  'CREATED',
  'READY',
  'ACTIVE',
  'PAUSED',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
] as const;
export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];

export const TERMINAL_WORK_ORDER_STATES = [
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
] as const;
export type TerminalWorkOrderState = (typeof TERMINAL_WORK_ORDER_STATES)[number];

export const WORK_ORDER_OBJECTIVE_TYPES = [
  'GROWTH_ALLOCATION',
  'DEBT_REDUCTION',
  'LIQUIDITY_MANAGEMENT',
  'OPPORTUNITY_INVESTIGATION',
  'PORTFOLIO_REBALANCE',
  'RECURRING_CONTRIBUTION',
  'GENERAL_ECONOMIC_WORK',
] as const;
export type WorkOrderObjectiveType = (typeof WORK_ORDER_OBJECTIVE_TYPES)[number];

export const WORK_ORDER_DISPOSITIONS = [
  'INVESTIGATE',
  'PROPOSE',
  'WAIT',
  'ABANDON',
  'NO_ACTION',
] as const;
export type WorkOrderDisposition = (typeof WORK_ORDER_DISPOSITIONS)[number];

export const RESEARCH_TOOL_CLASSES = [
  'MARKET_DATA_READ',
  'PEG_QUERY',
  'OPPORTUNITY_SCAN',
  'SCENARIO_MODEL',
  'POLICY_LOOKUP',
] as const;
export type ResearchToolClass = (typeof RESEARCH_TOOL_CLASSES)[number];

export const RESEARCH_MODEL_CLASSES = [
  'DETERMINISTIC',
  'STATISTICAL',
  'SIMULATION',
  'LLM_ASSISTED',
] as const;
export type ResearchModelClass = (typeof RESEARCH_MODEL_CLASSES)[number];

export const PERMITTED_ACTION_CATEGORIES = [
  'RESEARCH',
  'OPPORTUNITY_DISCOVERY',
  'PROPOSAL_GENERATION',
  'MONITORING',
  'RECONCILIATION',
] as const;
export type PermittedActionCategory = (typeof PERMITTED_ACTION_CATEGORIES)[number];

export const WORK_ORDER_BLOCK_REASONS = [
  'MANDATE_INACTIVE',
  'CAPABILITY_RESTRICTED',
  'COMPLIANCE_HOLD',
  'EXTERNAL_DEPENDENCY',
  'POLICY_DEFERRAL',
  'MANUAL_REVIEW',
] as const;
export type WorkOrderBlockReason = (typeof WORK_ORDER_BLOCK_REASONS)[number];

export const WORK_ORDER_FAILURE_CODES = [
  'WORK_ORDER_NOT_FOUND',
  'CUSTOMER_MISMATCH',
  'MANDATE_REFERENCE_REQUIRED',
  'INVALID_TRANSITION',
  'TERMINAL_STATE',
  'IDEMPOTENCY_CONFLICT',
  'ENVELOPE_WIDENING_FORBIDDEN',
  'EXPIRED',
  'CAPITAL_ENVELOPE_INVALID',
  'ACTOR_UNAUTHORIZED',
  'DUPLICATE_TRANSITION',
] as const;
export type WorkOrderFailureCode = (typeof WORK_ORDER_FAILURE_CODES)[number];
