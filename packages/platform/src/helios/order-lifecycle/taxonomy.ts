/**
 * HELIOS H23 — Provider-backed order / fill / settlement lifecycle taxonomies.
 * Canonical financial lifecycle states. Not a second ledger or Execution Authority.
 */

export const HELIOS_ORDER_STATUSES = [
  'PROPOSED',
  'AUTHORIZED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PARTIALLY_FILLED',
  'FILLED',
  'SETTLED',
  'RECONCILED',
  'AVAILABLE',
  'REJECTED',
  'CANCEL_PENDING',
  'CANCELLED',
  'PARTIALLY_FILLED_THEN_CANCELLED',
  'EXPIRED',
  'FAILED',
  'UNKNOWN',
  'RECONCILIATION_REQUIRED',
] as const;
export type HeliosOrderStatus = (typeof HELIOS_ORDER_STATUSES)[number];

export const HELIOS_CANCEL_STATUSES = [
  'CANCEL_REQUESTED',
  'CANCEL_SUBMITTED',
  'CANCEL_ACKNOWLEDGED',
  'CANCELLED',
  'PARTIALLY_FILLED_THEN_CANCELLED',
  'CANCEL_REJECTED',
  'UNKNOWN',
] as const;
export type HeliosCancelStatus = (typeof HELIOS_CANCEL_STATUSES)[number];

export const HELIOS_SETTLEMENT_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'SETTLED',
  'FAILED',
  'DISCREPANCY',
  'UNKNOWN',
] as const;
export type HeliosSettlementStatus = (typeof HELIOS_SETTLEMENT_STATUSES)[number];

export const HELIOS_RECONCILIATION_STATUSES = [
  'PENDING',
  'MATCHED',
  'DISCREPANCY',
  'UNKNOWN',
  'INVESTIGATION_REQUIRED',
] as const;
export type HeliosReconciliationStatus = (typeof HELIOS_RECONCILIATION_STATUSES)[number];

export const HELIOS_ORDER_SIDES = ['BUY', 'SELL'] as const;
export type HeliosOrderSide = (typeof HELIOS_ORDER_SIDES)[number];

export const HELIOS_ORDER_TYPES = ['MARKET', 'LIMIT'] as const;
export type HeliosOrderType = (typeof HELIOS_ORDER_TYPES)[number];

export const HELIOS_TIME_IN_FORCE = ['DAY', 'GTC', 'IOC', 'FOK'] as const;
export type HeliosTimeInForce = (typeof HELIOS_TIME_IN_FORCE)[number];

export const HELIOS_ORDER_ENVIRONMENTS = ['SIMULATION', 'SANDBOX', 'PAPER'] as const;
export type HeliosOrderEnvironment = (typeof HELIOS_ORDER_ENVIRONMENTS)[number];

export const HELIOS_PROVIDER_OUTCOME_KINDS = [
  'ACKNOWLEDGED',
  'REJECTED',
  'PARTIAL_FILL',
  'FILL',
  'CANCELLED',
  'CANCEL_REJECTED',
  'PENDING',
  'TIMEOUT',
  'UNKNOWN',
  'SETTLED',
] as const;
export type HeliosProviderOutcomeKind = (typeof HELIOS_PROVIDER_OUTCOME_KINDS)[number];

export const HELIOS_WEBHOOK_VERIFICATION = ['VERIFIED', 'INVALID_SIGNATURE', 'REPLAY_REJECTED', 'MALFORMED'] as const;
export type HeliosWebhookVerification = (typeof HELIOS_WEBHOOK_VERIFICATION)[number];

export const HELIOS_ORDER_POLICY_VERSION = 'helios-order-lifecycle-v1' as const;

export const LEGAL_HELIOS_ORDER_TRANSITIONS: Readonly<
  Record<HeliosOrderStatus, readonly HeliosOrderStatus[]>
> = Object.freeze({
  PROPOSED: Object.freeze(['AUTHORIZED', 'REJECTED', 'EXPIRED', 'FAILED'] as const),
  AUTHORIZED: Object.freeze(['SUBMITTED', 'REJECTED', 'EXPIRED', 'FAILED'] as const),
  SUBMITTED: Object.freeze(['ACKNOWLEDGED', 'REJECTED', 'FAILED', 'UNKNOWN', 'RECONCILIATION_REQUIRED'] as const),
  ACKNOWLEDGED: Object.freeze([
    'PARTIALLY_FILLED',
    'FILLED',
    'REJECTED',
    'CANCEL_PENDING',
    'FAILED',
    'UNKNOWN',
    'RECONCILIATION_REQUIRED',
  ] as const),
  PARTIALLY_FILLED: Object.freeze([
    'FILLED',
    'PARTIALLY_FILLED_THEN_CANCELLED',
    'CANCEL_PENDING',
    'FAILED',
    'UNKNOWN',
    'RECONCILIATION_REQUIRED',
  ] as const),
  FILLED: Object.freeze(['SETTLED', 'FAILED', 'UNKNOWN', 'RECONCILIATION_REQUIRED'] as const),
  SETTLED: Object.freeze(['RECONCILED', 'FAILED', 'UNKNOWN', 'RECONCILIATION_REQUIRED'] as const),
  RECONCILED: Object.freeze(['AVAILABLE', 'RECONCILIATION_REQUIRED'] as const),
  AVAILABLE: Object.freeze([] as const),
  REJECTED: Object.freeze([] as const),
  CANCEL_PENDING: Object.freeze([
    'ACKNOWLEDGED',
    'CANCELLED',
    'PARTIALLY_FILLED_THEN_CANCELLED',
    'PARTIALLY_FILLED',
    'FILLED',
    'FAILED',
    'UNKNOWN',
  ] as const),
  CANCELLED: Object.freeze([] as const),
  PARTIALLY_FILLED_THEN_CANCELLED: Object.freeze(['SETTLED', 'RECONCILED', 'AVAILABLE'] as const),
  EXPIRED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
  UNKNOWN: Object.freeze([
    'ACKNOWLEDGED',
    'PARTIALLY_FILLED',
    'FILLED',
    'REJECTED',
    'CANCELLED',
    'FAILED',
    'RECONCILIATION_REQUIRED',
  ] as const),
  RECONCILIATION_REQUIRED: Object.freeze([
    'ACKNOWLEDGED',
    'PARTIALLY_FILLED',
    'FILLED',
    'SETTLED',
    'RECONCILED',
    'AVAILABLE',
    'REJECTED',
    'CANCELLED',
    'FAILED',
    'UNKNOWN',
  ] as const),
});

export function canTransitionHeliosOrder(from: HeliosOrderStatus, to: HeliosOrderStatus): boolean {
  return LEGAL_HELIOS_ORDER_TRANSITIONS[from].includes(to);
}

export function isTerminalHeliosOrderStatus(status: HeliosOrderStatus): boolean {
  return (
    status === 'AVAILABLE' ||
    status === 'REJECTED' ||
    status === 'CANCELLED' ||
    status === 'EXPIRED' ||
    status === 'FAILED'
  );
}

export function acknowledgementIsNotFill(status: HeliosOrderStatus): boolean {
  return status === 'ACKNOWLEDGED' || status === 'SUBMITTED';
}

export function fillIsNotSettlement(status: HeliosOrderStatus): boolean {
  return status === 'FILLED' || status === 'PARTIALLY_FILLED' || status === 'PARTIALLY_FILLED_THEN_CANCELLED';
}

export function filledIsNotAvailable(status: HeliosOrderStatus): boolean {
  return status !== 'AVAILABLE';
}
