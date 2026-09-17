/**
 * H24 — Exit / reinvest / withdraw / reconcile lifecycle vocabulary.
 * Orchestration and projection only. Not a second ledger or Execution Authority.
 */

export const EXIT_TYPES = ['FULL_CLOSE', 'PARTIAL_CLOSE'] as const;
export type ExitType = (typeof EXIT_TYPES)[number];

export const EXIT_REASONS = [
  'USER_REQUEST',
  'STRATEGY_EXIT',
  'STRATEGY_INVALIDATED',
  'RISK_REDUCTION',
  'MANDATE_CHANGE',
  'EXPIRY',
  'PROVIDER_RESTRICTION',
  'SYSTEM_CLOSE_POLICY',
  'OTHER',
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

export const CAPITAL_LIFECYCLE_STAGES = [
  'REQUESTED',
  'AUTHORIZED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'FILLED',
  'SETTLED',
  'RECONCILED',
  'AVAILABLE',
  'FAILED',
  'CANCELLED',
  'ACTION_REQUIRED',
  'UNKNOWN',
] as const;
export type CapitalLifecycleStage = (typeof CAPITAL_LIFECYCLE_STAGES)[number];

export const WITHDRAWAL_STATES = [
  'REQUESTED',
  'AUTHORIZED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PROCESSING',
  'SETTLED',
  'RECONCILED',
  'AVAILABLE',
  'COMPLETED',
  'FAILED',
  'RETURNED',
  'REVERSED',
  'ACTION_REQUIRED',
  'UNKNOWN',
] as const;
export type WithdrawalState = (typeof WITHDRAWAL_STATES)[number];

export const RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'MISMATCH',
  'PENDING',
  'UNKNOWN',
  'REVIEW_REQUIRED',
] as const;
export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[number];

export const MISMATCH_KINDS = [
  'QUANTITY_MISMATCH',
  'FEE_MISMATCH',
  'MISSING_FILL',
  'PROVIDER_POSITION_MISMATCH',
  'CASH_DISCREPANCY',
  'DUPLICATE_EVENT',
  'SETTLEMENT_DISCREPANCY',
  'WITHDRAWAL_DISCREPANCY',
] as const;
export type MismatchKind = (typeof MISMATCH_KINDS)[number];

export const REINVESTMENT_REFUSAL_CODES = [
  'UNSETTLED_PROCEEDS',
  'UNRECONCILED',
  'MANDATE_INACTIVE',
  'GROW_PAUSED',
  'LIQUIDITY_REQUIREMENT',
  'RISK_BLOCKED',
  'CASH_RESERVED',
  'WITHDRAWAL_PENDING',
  'POLICY_REFUSED',
  'AUTHORITY_REQUIRED',
] as const;
export type ReinvestmentRefusalCode = (typeof REINVESTMENT_REFUSAL_CODES)[number];

export const CAPITAL_RESERVATION_KINDS = ['REINVESTMENT', 'WITHDRAWAL'] as const;
export type CapitalReservationKind = (typeof CAPITAL_RESERVATION_KINDS)[number];
