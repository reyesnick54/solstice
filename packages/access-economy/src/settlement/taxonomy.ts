/**
 * ACCESS Wave 3 / Prompt 36 — Restricted virtual-card settlement rail taxonomy.
 */

export const ACCESS_SETTLEMENT_RAIL_SCHEMA_VERSION = 1 as const;
export const ACCESS_SETTLEMENT_RAIL_TAXONOMY_ID = 'sunrey-access-virtual-card-rail' as const;
export const ACCESS_SETTLEMENT_RAIL_TAXONOMY_VERSION = '1' as const;

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
  'STATUS',
  'RECONCILE',
  'RESTRICTED_CARD',
] as const;
export type AccessPaymentRailCapability = (typeof ACCESS_PAYMENT_RAIL_CAPABILITIES)[number];

export const ACCESS_PAYMENT_RAIL_STATUSES = [
  'READY',
  'SANDBOX',
  'BLOCKED_PENDING_PROVIDER',
] as const;
export type AccessPaymentRailStatus = (typeof ACCESS_PAYMENT_RAIL_STATUSES)[number];

export const ACCESS_VIRTUAL_CARD_STATUSES = [
  'PENDING_FUNDING',
  'PENDING_ISSUANCE',
  'ACTIVE',
  'AUTHORIZED',
  'CAPTURED',
  'DISABLED',
  'CLOSED',
  'FAILED',
] as const;
export type AccessVirtualCardStatus = (typeof ACCESS_VIRTUAL_CARD_STATUSES)[number];

export const ACCESS_CARD_LIFECYCLE_EVENTS = [
  'CARD_CREATED',
  'AUTHORIZATION_PENDING',
  'AUTHORIZATION_APPROVED',
  'AUTHORIZATION_DECLINED',
  'CAPTURED',
  'REVERSED',
  'REFUNDED',
  'CARD_DISABLED',
] as const;
export type AccessCardLifecycleEvent = (typeof ACCESS_CARD_LIFECYCLE_EVENTS)[number];

export const ACCESS_CARD_CONTROL_KINDS = [
  'MAXIMUM_AMOUNT',
  'SINGLE_TRANSACTION',
  'SINGLE_USE',
  'EXPIRATION',
  'MERCHANT_ID',
  'MERCHANT_CATEGORY',
  'COUNTRY',
  'CURRENCY',
  'ALLOWED_MERCHANT',
  'BLOCKED_MERCHANT_CATEGORIES',
] as const;
export type AccessCardControlKind = (typeof ACCESS_CARD_CONTROL_KINDS)[number];

export const ACCESS_SETTLEMENT_RAIL_FAILURE_CODES = [
  'FUNDING_NOT_RESERVED',
  'CARD_ISSUANCE_FAILED',
  'PROVIDER_BLOCKED',
  'UNSUPPORTED_ACCESS_PAYMENT_CONFIGURATION',
  'AMOUNT_EXCEEDS_LIMIT',
  'MERCHANT_NOT_ALLOWED',
  'MCC_NOT_ALLOWED',
  'COUNTRY_NOT_ALLOWED',
  'CARD_DISABLED',
  'CARD_EXPIRED',
  'CARD_SINGLE_USE_EXHAUSTED',
  'INCREMENTAL_AUTH_EXCEEDS_MAX',
  'SECURITY_DEPOSIT_NOT_FUNDED',
  'ISSUER_TIMEOUT',
  'WEBHOOK_SIGNATURE_INVALID',
  'DUPLICATE_WEBHOOK',
  'PCI_BOUNDARY_VIOLATION',
  'TOKEN_FUNDING_FORBIDDEN',
] as const;
export type AccessSettlementRailFailureCode = (typeof ACCESS_SETTLEMENT_RAIL_FAILURE_CODES)[number];

export const ACCESS_VIRTUAL_CARD_PURPOSES = [
  'PROVIDER_SETTLEMENT',
  'MERCHANT_CHECKOUT',
] as const;
export type AccessVirtualCardPurpose = (typeof ACCESS_VIRTUAL_CARD_PURPOSES)[number];

export const RESTRICTED_CARD_RAIL_ID = 'RESTRICTED_VIRTUAL_CARD' as const;
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
