/**
 * Typed proposal actions the Personal Economy Agent may emit.
 * A proposal is NOT an ActionIntent. Conversion exists only in the
 * control-plane ProposalGate after capability-token validation.
 */
export const PROPOSAL_ACTION_TYPES = [
  'INVESTMENT_SWEEP',
  'ALLOCATE_TO_RESERVE',
  'PAY_HIGH_COST_DEBT',
  'HOLD_LIQUIDITY',
  'CANCEL_SUBSCRIPTION',
  'SELECT_MERCHANT_BID',
  'ENROLL_OPPORTUNITY',
  'ROUTE_REWARD',
  'TRANSFER_REALIZED_GAINS_TO_SAVINGS',
  'REINVEST_REALIZED_GAINS',
  'SHOW_RESEARCH_OPPORTUNITY',
  'ALLOCATE_TO_GOAL',
  'PERMITTED_ALLOCATION',
] as const;

export type ProposalActionType = (typeof PROPOSAL_ACTION_TYPES)[number];

export function isProposalActionType(value: unknown): value is ProposalActionType {
  return (
    typeof value === 'string' &&
    (PROPOSAL_ACTION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Actions the capability token may explicitly forbid.
 * Enforced in infrastructure (ProposalGate), never by prompt text.
 */
export const FORBIDDEN_ACTIONS = [
  'EXECUTE_TRANSFER',
  'CONSTRUCT_EXECUTION_AUTHORITY',
  'POST_JOURNAL',
  'MUTATE_EXTERNAL_SUBSCRIPTION',
  'LIVE_MONEY_MOVEMENT',
  'WIDEN_OWN_AUTHORITY',
  'READ_FORBIDDEN_DATA',
  'CALL_EXTERNAL_LLM_FOR_ENFORCEMENT',
] as const;

export type ForbiddenAction = (typeof FORBIDDEN_ACTIONS)[number];

export const DATA_CATEGORIES = [
  'BALANCES',
  'TRANSACTIONS',
  'RECURRING_PATTERNS',
  'ACCOUNT_CLASSES',
  'PII_FULL_NAME',
  'TAX_ID',
  'AUTHENTICATION_SECRETS',
  'RAW_CARD_PAN',
  'HEALTH',
  'PRECISE_GEOLOCATION',
] as const;

export type DataCategory = (typeof DATA_CATEGORIES)[number];

export const REASON_CODES = [
  'RESERVE_BELOW_TARGET',
  'NEAR_TERM_OBLIGATION',
  'HIGH_COST_DEBT_OUTSTANDING',
  'LIQUIDITY_BELOW_MANDATE',
  'SURPLUS_CASH_INVESTABLE',
  'USER_GOAL_FUNDING',
  'PERMITTED_REST_ALLOCATION',
  'SUBSCRIPTION_REDUNDANT',
  'SUBSCRIPTION_UNUSED',
  'SUBSCRIPTION_PRICE_INCREASED',
  'SUBSCRIPTION_TRIAL_ENDING',
  'MERCHANT_BID_SELECTED',
  'OPPORTUNITY_ELIGIBLE',
  'REWARD_METHOD_SUPERIOR',
  'REALIZED_GAINS_REINVEST',
  'REALIZED_GAINS_TO_SAVINGS',
  'RESEARCH_PAY_ABOVE_FLOOR',
  'PROTECTED_DEPOSIT_SWEEP_REQUESTED',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];
