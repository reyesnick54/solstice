/**
 * HELIOS Multi-Asset M21 — Universal Multi-Asset Execution Plan taxonomies.
 * Planning constraints only. Not a second order manager or Execution Authority.
 */

export const EXECUTION_PLAN_STATUSES = [
  'DRAFT',
  'RISK_APPROVED',
  'COMPLIANCE_APPROVED',
  'AUTHORIZED',
  'READY_FOR_ROUTING',
  'ROUTED',
  'PARTIALLY_EXECUTED',
  'EXECUTED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
  'RECONCILIATION_REQUIRED',
] as const;
export type ExecutionPlanStatus = (typeof EXECUTION_PLAN_STATUSES)[number];

export const EXECUTION_PLAN_DIRECTIONS = ['LONG', 'SHORT'] as const;
export type ExecutionPlanDirection = (typeof EXECUTION_PLAN_DIRECTIONS)[number];

export const EXECUTION_ASSET_CLASSES = [
  'EQUITY',
  'ETF',
  'INDEX',
  'CRYPTO',
  'COMMODITY',
  'FUTURE',
  'FX',
  'BOND',
  'OTHER',
] as const;
export type ExecutionAssetClass = (typeof EXECUTION_ASSET_CLASSES)[number];

export const ORDER_INTENT_TYPES = [
  'MARKET_ALLOWED',
  'LIMIT_REQUIRED',
  'PASSIVE_PREFERRED',
  'URGENCY_REQUIRED',
  'EXIT_ONLY',
  'EMERGENCY_EXIT',
] as const;
export type OrderIntentType = (typeof ORDER_INTENT_TYPES)[number];

export const LEG_ORDERING_REQUIREMENTS = [
  'SEQUENTIAL',
  'PARALLEL',
  'FIRST_LEG_PRIORITY',
  'HEDGE_AFTER_PRIMARY',
] as const;
export type LegOrderingRequirement = (typeof LEG_ORDERING_REQUIREMENTS)[number];

export const ATOMICITY_PREFERENCES = [
  'NONE',
  'BEST_EFFORT',
  'ALL_OR_NOTHING',
] as const;
export type AtomicityPreference = (typeof ATOMICITY_PREFERENCES)[number];

export const EXECUTION_PLAN_POLICY_VERSION = 'helios.execution-plan.v1' as const;

export const LEGAL_EXECUTION_PLAN_TRANSITIONS: Readonly<
  Record<ExecutionPlanStatus, readonly ExecutionPlanStatus[]>
> = Object.freeze({
  DRAFT: Object.freeze(['RISK_APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  RISK_APPROVED: Object.freeze(['COMPLIANCE_APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  COMPLIANCE_APPROVED: Object.freeze(['AUTHORIZED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  AUTHORIZED: Object.freeze(['READY_FOR_ROUTING', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  READY_FOR_ROUTING: Object.freeze(['ROUTED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  ROUTED: Object.freeze([
    'PARTIALLY_EXECUTED',
    'EXECUTED',
    'RECONCILIATION_REQUIRED',
    'CANCELLED',
    'EXPIRED',
  ]),
  PARTIALLY_EXECUTED: Object.freeze([
    'EXECUTED',
    'RECONCILIATION_REQUIRED',
    'CANCELLED',
    'EXPIRED',
  ]),
  EXECUTED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  REJECTED: Object.freeze([]),
  RECONCILIATION_REQUIRED: Object.freeze(['EXECUTED', 'CANCELLED', 'REJECTED']),
});

export function canTransitionExecutionPlan(from: ExecutionPlanStatus, to: ExecutionPlanStatus): boolean {
  return LEGAL_EXECUTION_PLAN_TRANSITIONS[from].includes(to);
}

export function isTerminalExecutionPlanStatus(status: ExecutionPlanStatus): boolean {
  return LEGAL_EXECUTION_PLAN_TRANSITIONS[status].length === 0;
}

/** Capital lifecycle preserved downstream via H23 order lifecycle. */
export const CAPITAL_LIFECYCLE_ORDER_STATUSES = [
  'PROPOSED',
  'AUTHORIZED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PARTIALLY_FILLED',
  'FILLED',
  'SETTLED',
  'RECONCILED',
  'AVAILABLE',
] as const;
