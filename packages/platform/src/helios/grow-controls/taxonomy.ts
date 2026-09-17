/**
 * HELIOS H27 — consumer operational control contract for Grow.
 * Pause does not erase in-flight financial operations.
 */

export const GROW_PAUSE_STATES = [
  'ACTIVE',
  'PAUSE_REQUESTED',
  'PAUSED',
  'PAUSE_PARTIAL',
  'RESUME_ELIGIBLE',
  'BLOCKED',
] as const;

export type GrowPauseState = (typeof GROW_PAUSE_STATES)[number];

export const GROW_CLOSE_MODES = ['CLOSE_ALL_ELIGIBLE', 'CLOSE_SELECTED'] as const;

export type GrowCloseMode = (typeof GROW_CLOSE_MODES)[number];

export const GROW_CLOSE_STATUSES = [
  'REQUESTED',
  'AUTHORIZED',
  'SUBMITTED',
  'PARTIALLY_CLOSED',
  'CLOSED',
  'SETTLING',
  'RECONCILING',
  'COMPLETED',
  'ACTION_REQUIRED',
  'FAILED',
  'UNKNOWN',
] as const;

export type GrowCloseStatus = (typeof GROW_CLOSE_STATUSES)[number];

export const GROW_WITHDRAWAL_STATUSES = [
  'REQUESTED',
  'VALIDATING',
  'AUTHORIZED',
  'SUBMITTED',
  'SETTLING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
] as const;

export type GrowWithdrawalStatus = (typeof GROW_WITHDRAWAL_STATUSES)[number];

export const GROW_OPERATIONAL_DEGRADED_CODES = [
  'MARKET_DATA_DEGRADED',
  'RESEARCH_PROVIDER_DEGRADED',
  'S3M_UNAVAILABLE',
  'PROVIDER_EXECUTION_DEGRADED',
  'PROVIDER_ACCOUNT_ACTION_REQUIRED',
  'RECONCILIATION_PENDING',
  'RECONCILIATION_MISMATCH',
  'SETTLEMENT_DELAYED',
  'VALUATION_STALE',
  'CAPABILITY_REVIEW_REQUIRED',
  'REGULATORY_RESTRICTION',
  'STRATEGY_REVIEW_REQUIRED',
  'SYSTEM_MAINTENANCE',
] as const;

export type GrowOperationalDegradedCode = (typeof GROW_OPERATIONAL_DEGRADED_CODES)[number];

export const DEGRADED_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;

export type DegradedSeverity = (typeof DEGRADED_SEVERITIES)[number];

export const GROW_CONTROL_NOTIFICATION_KINDS = [
  'PAUSE_CONFIRMED',
  'CLOSE_REQUESTED',
  'CLOSE_COMPLETED',
  'SETTLEMENT_DELAYED',
  'WITHDRAWAL_SUBMITTED',
  'WITHDRAWAL_COMPLETED',
  'CUSTOMER_ACTION_REQUIRED',
  'PROVIDER_DEGRADED',
  'RECONCILIATION_PROBLEM',
  'MANDATE_CHANGE_APPLIED',
  'RESUME_CONFIRMED',
] as const;

export type GrowControlNotificationKind = (typeof GROW_CONTROL_NOTIFICATION_KINDS)[number];
