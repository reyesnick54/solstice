/**
 * Canonical rail taxonomy for simulation connectivity.
 *
 * These names describe engineering rail *classes*, not production network
 * membership. Solstice does not claim ACH, FedNow, RTP, SWIFT, SEPA,
 * Saudi Central Bank, or UAE payment-infrastructure access.
 *
 * Provider and network remain separate: rail = INTERNATIONAL_CORRESPONDENT,
 * provider = SIMULATED_PROVIDER_GCC.
 */

export const RAIL_CLASSES = [
  'US_BATCH',
  'US_INSTANT',
  'EU_SEPA',
  'EU_SEPA_INSTANT',
  'UK_FASTER_PAYMENT',
  'INTERNATIONAL_CORRESPONDENT',
  'SA_DOMESTIC',
  'AE_DOMESTIC',
] as const;
export type RailClass = (typeof RAIL_CLASSES)[number];

export const PROVIDER_IDS = [
  'SIMULATED_PROVIDER_US_BATCH',
  'SIMULATED_PROVIDER_US_INSTANT',
  'SIMULATED_PROVIDER_SEPA',
  'SIMULATED_PROVIDER_SEPA_INSTANT',
  'SIMULATED_PROVIDER_UK',
  'SIMULATED_PROVIDER_CORRESPONDENT',
  'SIMULATED_PROVIDER_GCC',
  'SIMULATED_PROVIDER_SA',
  'SIMULATED_PROVIDER_AE',
  'SIMULATED_PROVIDER_BLOCKED',
] as const;
export type SimulatedProviderName = (typeof PROVIDER_IDS)[number];

export const CANONICAL_RAIL_STATUSES = [
  'ACCEPTED',
  'REJECTED',
  'PENDING',
  'PROCESSING',
  'SETTLED',
  'RETURNED',
  'CANCELLED',
  'UNKNOWN',
  'SUBMISSION_UNKNOWN',
] as const;
export type CanonicalRailStatus = (typeof CANONICAL_RAIL_STATUSES)[number];

export const RAIL_HEALTH_STATES = ['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'MAINTENANCE'] as const;
export type RailHealthState = (typeof RAIL_HEALTH_STATES)[number];

export const RAIL_RETRY_CLASSES = [
  'SAFE_TO_RETRY',
  'SAFE_WITH_IDEMPOTENCY',
  'DO_NOT_RETRY_WITHOUT_QUERY',
  'PERMANENT_FAILURE',
] as const;
export type RailRetryClass = (typeof RAIL_RETRY_CLASSES)[number];

export const REJECTION_CLASSES = [
  'PRE_SUBMISSION_REJECTION',
  'PROVIDER_REJECTION',
  'POST_SETTLEMENT_RETURN',
] as const;
export type RejectionClass = (typeof REJECTION_CLASSES)[number];

export const RETURN_REASON_CODES = [
  'BENEFICIARY_ACCOUNT_CLOSED',
  'BENEFICIARY_ACCOUNT_INVALID',
  'INSUFFICIENT_INFORMATION',
  'COMPLIANCE_RETURN',
  'DUPLICATE_PAYMENT',
  'CUSTOMER_REQUESTED',
  'PROVIDER_UNSPECIFIED',
] as const;
export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

export const SETTLEMENT_CLASSES = ['BATCH', 'INSTANT', 'CORRESPONDENT'] as const;
export type SettlementClass = (typeof SETTLEMENT_CLASSES)[number];

export const RAIL_DIRECTIONS = ['OUTBOUND', 'INBOUND', 'BOTH'] as const;
export type RailDirection = (typeof RAIL_DIRECTIONS)[number];

export const CONNECTIVITY_MODES = ['SIMULATION', 'SANDBOX', 'LIVE'] as const;
export type ConnectivityMode = (typeof CONNECTIVITY_MODES)[number];

export const CANCELLATION_OUTCOMES = [
  'CANCELLED',
  'CANCELLATION_NOT_SUPPORTED',
  'CANCELLATION_TOO_LATE',
  'CANCELLATION_UNKNOWN',
] as const;
export type CancellationOutcome = (typeof CANCELLATION_OUTCOMES)[number];

export function isRailClass(value: string): value is RailClass {
  return (RAIL_CLASSES as readonly string[]).includes(value);
}

export function isCanonicalRailStatus(value: string): value is CanonicalRailStatus {
  return (CANONICAL_RAIL_STATUSES as readonly string[]).includes(value);
}

/**
 * Map a provider-specific status string. Callers outside an adapter must
 * never see the raw provider string — only the canonical result.
 */
export function normalizeProviderStatus(providerStatus: string): CanonicalRailStatus {
  const key = providerStatus.trim().toUpperCase().replace(/[\s-]+/g, '_');
  switch (key) {
    case 'ACCEPTED':
    case 'ACK':
    case 'ACKNOWLEDGED':
      return 'ACCEPTED';
    case 'REJECTED':
    case 'DECLINED':
    case 'NACK':
      return 'REJECTED';
    case 'PENDING':
    case 'QUEUED':
      return 'PENDING';
    case 'PROCESSING':
    case 'IN_FLIGHT':
      return 'PROCESSING';
    case 'SETTLED':
    case 'COMPLETED':
    case 'SUCCESS':
      return 'SETTLED';
    case 'RETURNED':
    case 'RETURN':
      return 'RETURNED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    case 'SUBMISSION_UNKNOWN':
    case 'UNKNOWN_SUBMISSION':
      return 'SUBMISSION_UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

export function retryClassFor(status: CanonicalRailStatus, operation: 'SUBMIT' | 'QUERY' | 'CANCEL' | 'CALLBACK'): RailRetryClass {
  if (status === 'SUBMISSION_UNKNOWN' && operation === 'SUBMIT') {
    return 'DO_NOT_RETRY_WITHOUT_QUERY';
  }
  if (status === 'REJECTED' || status === 'SETTLED' || status === 'RETURNED' || status === 'CANCELLED') {
    return 'PERMANENT_FAILURE';
  }
  if (operation === 'SUBMIT') {
    return 'SAFE_WITH_IDEMPOTENCY';
  }
  if (operation === 'QUERY') {
    return 'SAFE_TO_RETRY';
  }
  if (operation === 'CANCEL') {
    return 'SAFE_WITH_IDEMPOTENCY';
  }
  return 'SAFE_WITH_IDEMPOTENCY';
}
