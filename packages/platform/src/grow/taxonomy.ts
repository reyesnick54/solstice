/**
 * Phase E Grow My Money taxonomies.
 * Planning and command generation only. Not a second ledger, Kernel, or mint.
 */

export const FINANCIAL_PROPOSAL_TYPES = [
  'CASH_TRANSFER',
  'FX_CONVERSION',
  'INVESTMENT_BUY',
  'INVESTMENT_SELL',
  'EXCHANGE_ACTION',
  'RECURRING_CONTRIBUTION',
] as const;
export type FinancialProposalType = (typeof FINANCIAL_PROPOSAL_TYPES)[number];

export const FINANCIAL_PROPOSAL_STATES = [
  'DRAFT',
  'AWAITING_APPROVAL',
  'AWAITING_STEP_UP',
  'APPROVED',
  'SUPERSEDED',
  'EXPIRED',
  'REJECTED',
  'CANCELLED',
] as const;
export type FinancialProposalState = (typeof FINANCIAL_PROPOSAL_STATES)[number];

export const GROW_EXECUTION_STATES = [
  'AUTHORIZED',
  'QUEUED',
  'SUBMITTED',
  'PROCESSING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REVERSED',
  'REQUIRES_REVIEW',
] as const;
export type GrowExecutionState = (typeof GROW_EXECUTION_STATES)[number];

export const GROW_EXECUTION_DOMAINS = [
  'PAYMENTS',
  'FX',
  'INVESTMENT_EXECUTION',
  'SUNREY_EXCHANGE',
] as const;
export type GrowExecutionDomain = (typeof GROW_EXECUTION_DOMAINS)[number];

export const SCENARIO_RESULT_KINDS = ['PROJECTION', 'ESTIMATE', 'ASSUMPTION', 'ACTUAL_RESULT'] as const;
export type ScenarioResultKind = (typeof SCENARIO_RESULT_KINDS)[number];

export const SUITABILITY_OUTCOMES = [
  'SUITABLE',
  'UNSUITABLE',
  'INSUFFICIENT_PROFILE',
  'JURISDICTION_BLOCKED',
  'KYC_INCOMPLETE',
  'ACCOUNT_RESTRICTED',
] as const;
export type SuitabilityOutcome = (typeof SUITABILITY_OUTCOMES)[number];

export const ACTIVATED_PLAN_LIFECYCLES = [
  'ACCEPTED',
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
] as const;
export type ActivatedPlanLifecycle = (typeof ACTIVATED_PLAN_LIFECYCLES)[number];

export const PLAN_COMPONENT_STATES = [
  'PENDING',
  'FUNDED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type PlanComponentState = (typeof PLAN_COMPONENT_STATES)[number];

export const RECURRING_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const RECURRING_MANDATE_STATES = [
  'ACTIVE',
  'PAUSED',
  'REVOKED',
  'EXPIRED',
] as const;
export type RecurringMandateState = (typeof RECURRING_MANDATE_STATES)[number];

export const AUTHENTICATION_ASSURANCE_LEVELS = [
  'AAL1',
  'AAL2',
  'STEP_UP_SATISFIED',
] as const;
export type AuthenticationAssuranceLevel = (typeof AUTHENTICATION_ASSURANCE_LEVELS)[number];

export const GROW_FAILURE_CODES = [
  'PROPOSAL_NOT_FOUND',
  'PROPOSAL_EXPIRED',
  'PROPOSAL_SUPERSEDED',
  'PROPOSAL_NOT_APPROVED',
  'PROPOSAL_FORGED',
  'APPROVAL_INVALID',
  'STEP_UP_REQUIRED',
  'AUTH_ASSURANCE_INSUFFICIENT',
  'SUITABILITY_MISMATCH',
  'KYC_INCOMPLETE',
  'WRONG_JURISDICTION',
  'ACCOUNT_RESTRICTED',
  'USER_INELIGIBLE',
  'INSUFFICIENT_FUNDS',
  'PRODUCT_UNAVAILABLE',
  'PROVIDER_UNAVAILABLE',
  'MARKET_UNAVAILABLE',
  'QUOTE_EXPIRED',
  'REFRESH_PROPOSAL_REQUIRED',
  'DUPLICATE_EXECUTION',
  'AGENT_CANNOT_SELF_APPROVE',
  'AGENT_CANNOT_EXECUTE',
  'AMOUNT_EXCEEDS_MANDATE',
  'RECURRING_REVOKED',
  'PLAN_NOT_FOUND',
  'MATERIAL_STATE_CHANGED',
  'PARTIAL_FILL',
  'SETTLEMENT_FAILURE',
  'PROVIDER_PENDING',
  'PROVIDER_UNKNOWN',
  'PROVIDER_REJECTION',
] as const;
export type GrowFailureCode = (typeof GROW_FAILURE_CODES)[number];
