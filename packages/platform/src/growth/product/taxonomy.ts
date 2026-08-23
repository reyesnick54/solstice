/**
 * Phase E customer-facing Growth Plan / Financial Proposal vocabularies.
 * Extends the Growth Orchestrator. Not a second planning owner.
 *
 * Product proposal statuses map onto Phase B ApprovalState.
 * SUPERSEDED is a product overlay; the approval machine records CANCELLED.
 */

export const PRODUCT_GROWTH_PLAN_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'ACTIVE',
  'PAUSED',
  'SUPERSEDED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProductGrowthPlanStatus = (typeof PRODUCT_GROWTH_PLAN_STATUSES)[number];

export const GROW_PLAN_COMPONENT_KINDS = [
  'CASH_RESERVE_TARGET',
  'RECURRING_SAVINGS',
  'ELIGIBLE_INVESTMENT_ALLOCATION',
  'REBALANCE_ACTION',
  'CURRENCY_ACTION',
  'GOAL_CONTRIBUTION',
] as const;
export type GrowPlanComponentKind = (typeof GROW_PLAN_COMPONENT_KINDS)[number];

export const GROW_RISK_PROFILES = ['CONSERVATIVE', 'BALANCED', 'GROWTH'] as const;
export type GrowRiskProfile = (typeof GROW_RISK_PROFILES)[number];

export const SCENARIO_KINDS = ['CONSERVATIVE', 'BASE', 'UPSIDE'] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export const ASSUMPTION_AVAILABILITY = ['AVAILABLE', 'UNAVAILABLE'] as const;
export type AssumptionAvailability = (typeof ASSUMPTION_AVAILABILITY)[number];

export const FINANCIAL_PROPOSAL_ACTION_TYPES = [
  'KEEP_CASH',
  'RECURRING_SAVINGS',
  'ALLOCATE_TO_CASH_RESERVE',
  'ALLOCATE_TO_ELIGIBLE_INVESTMENT',
  'REBALANCE',
  'CURRENCY_MOVE',
  'GOAL_CONTRIBUTION',
  'DEFER',
] as const;
export type FinancialProposalActionType = (typeof FINANCIAL_PROPOSAL_ACTION_TYPES)[number];

/**
 * Customer-facing proposal statuses. Authority-facing state is Phase B
 * ApprovalState on the same record.
 */
export const FINANCIAL_PROPOSAL_STATUSES = [
  'DRAFT',
  'READY',
  'PRESENTED',
  'AWAITING_APPROVAL',
  'AWAITING_STEP_UP',
  'AWAITING_COMPLIANCE',
  'APPROVED',
  'EXECUTING',
  'EXECUTED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
  'SUPERSEDED',
] as const;
export type FinancialProposalStatus = (typeof FINANCIAL_PROPOSAL_STATUSES)[number];

export const FEE_CERTAINTY = ['KNOWN', 'ESTIMATE'] as const;
export type FeeCertainty = (typeof FEE_CERTAINTY)[number];

export const ALTERNATIVE_KINDS = [
  'KEEP_CASH',
  'MOVE_PARTIAL',
  'LOWER_RISK',
  'DEFER',
] as const;
export type AlternativeKind = (typeof ALTERNATIVE_KINDS)[number];

export const SUITABILITY_DECISIONS = [
  'SUITABLE_SIMULATION',
  'UNSUITABLE',
  'REVALIDATION_REQUIRED',
  'INSUFFICIENT_DATA',
] as const;
export type SuitabilityDecision = (typeof SUITABILITY_DECISIONS)[number];

export const POLICY_DECISIONS = ['ALLOW', 'DENY', 'REVIEW'] as const;
export type GrowPolicyDecision = (typeof POLICY_DECISIONS)[number];

export const GROW_EXECUTION_METHODS = [
  'INFORMATION_ONLY',
  'PROPOSAL_ONLY',
  'USER_CONFIRMATION_REQUIRED',
  'KERNEL_AUTHORIZATION_REQUIRED',
] as const;
export type GrowExecutionMethod = (typeof GROW_EXECUTION_METHODS)[number];

export const REQUIRED_APPROVALS = [
  'CUSTOMER_CONFIRMATION',
  'STEP_UP_AUTH',
  'COMPLIANCE_REVIEW',
] as const;
export type GrowRequiredApproval = (typeof REQUIRED_APPROVALS)[number];

export const ILLUSTRATION_DISCLAIMER =
  'Illustrated only. Not a promise, forecast, or guaranteed outcome. Not a yield or growth-rate claim.';

export function isProductGrowthPlanStatus(value: unknown): value is ProductGrowthPlanStatus {
  return typeof value === 'string' && (PRODUCT_GROWTH_PLAN_STATUSES as readonly string[]).includes(value);
}

export function isFinancialProposalStatus(value: unknown): value is FinancialProposalStatus {
  return typeof value === 'string' && (FINANCIAL_PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export function isGrowRiskProfile(value: unknown): value is GrowRiskProfile {
  return typeof value === 'string' && (GROW_RISK_PROFILES as readonly string[]).includes(value);
}
