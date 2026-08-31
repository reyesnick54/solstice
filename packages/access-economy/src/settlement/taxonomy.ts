/**
 * ACCESS Wave 3 Prompt 35 — Fiat settlement orchestration taxonomy.
 *
 * Payment rails, capabilities, strategies, and normalized settlement statuses.
 * Provider-agnostic; no vendor is domain authority.
 */

export const ACCESS_SETTLEMENT_ORCHESTRATION_SCHEMA = 'sunrey.access.settlement-orchestration.v1' as const;
export const ACCESS_SETTLEMENT_ORCHESTRATION_CHUNK = 'ACCESS-35' as const;

/** Normalized settlement lifecycle statuses. */
export const ACCESS_SETTLEMENT_ORCHESTRATION_STATUSES = [
  'PENDING',
  'FUNDING_RESERVED',
  'USER_AUTHORIZED',
  'PROVIDER_AUTHORIZED',
  'AUTHORIZED',
  'CAPTURE_PENDING',
  'CAPTURED',
  'VOID_PENDING',
  'VOIDED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'RECONCILIATION_REQUIRED',
] as const;
export type AccessSettlementOrchestrationStatus =
  (typeof ACCESS_SETTLEMENT_ORCHESTRATION_STATUSES)[number];

/** Future payment rail kinds. No vendor is canonical. */
export const ACCESS_PAYMENT_RAIL_KINDS = [
  'VIRTUAL_CARD',
  'DIRECT_PROVIDER_API',
  'BANK_TRANSFER',
  'ACH',
  'INVOICE',
  'WALLET',
  'PROVIDER_CREDIT',
  'SIMULATED',
] as const;
export type AccessPaymentRailKind = (typeof ACCESS_PAYMENT_RAIL_KINDS)[number];

/** Capability declarations — rails implement only what they support. */
export const ACCESS_PAYMENT_RAIL_CAPABILITIES = [
  'AUTHORIZE',
  'CAPTURE',
  'VOID',
  'REFUND',
  'PARTIAL_REFUND',
  'STATUS',
  'RECONCILE',
  'RESTRICTED_CARD',
  'PAYOUT',
] as const;
export type AccessPaymentRailCapability = (typeof ACCESS_PAYMENT_RAIL_CAPABILITIES)[number];

/** Provider/rail-specific settlement ordering strategies. */
export const ACCESS_SETTLEMENT_STRATEGIES = [
  'AUTHORIZE_THEN_BOOK_THEN_CAPTURE',
  'RESERVE_BOOK_CAPTURE',
  'BOOK_THEN_PAY',
  'PAY_THEN_BOOK',
  'INVOICE_AFTER_FULFILLMENT',
] as const;
export type AccessSettlementStrategy = (typeof ACCESS_SETTLEMENT_STRATEGIES)[number];

/** Normalized remote payment statuses from rails. */
export const ACCESS_PAYMENT_REMOTE_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'VOIDED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'FAILED',
  'UNKNOWN',
] as const;
export type AccessPaymentRemoteStatus = (typeof ACCESS_PAYMENT_REMOTE_STATUSES)[number];

/** Settlement operations subject to idempotency. */
export const ACCESS_SETTLEMENT_OPERATIONS = [
  'PREPARE',
  'RESERVE',
  'AUTHORIZE',
  'CAPTURE',
  'VOID',
  'REFUND',
  'PARTIAL_REFUND',
  'RECONCILE',
] as const;
export type AccessSettlementOperation = (typeof ACCESS_SETTLEMENT_OPERATIONS)[number];

/** At launch token conversion is always zero. */
export const LAUNCH_TOKEN_CONVERSION_CONTRIBUTION = 0n as const;

export function isAccessSettlementOrchestrationStatus(
  value: string,
): value is AccessSettlementOrchestrationStatus {
  return (ACCESS_SETTLEMENT_ORCHESTRATION_STATUSES as readonly string[]).includes(value);
}

export function isAccessPaymentRailKind(value: string): value is AccessPaymentRailKind {
  return (ACCESS_PAYMENT_RAIL_KINDS as readonly string[]).includes(value);
}

export function railSupportsCapability(
  capabilities: readonly AccessPaymentRailCapability[],
  capability: AccessPaymentRailCapability,
): boolean {
  return capabilities.includes(capability);
}
