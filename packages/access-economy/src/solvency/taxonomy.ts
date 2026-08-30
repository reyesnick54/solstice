/**
 * ACCESS-16 — Capacity tranche and settlement taxonomy.
 *
 * Each economic source of allocatable capacity is classified explicitly.
 * Tranches are never merged silently.
 */

export const ACCESS_SOLVENCY_SCHEMA = 'sunrey.access.solvency.v1' as const;
export const ACCESS_SOLVENCY_CHUNK = 'ACCESS-16' as const;

/** Capacity source classifications for AccessCapacityPool backing tranches. */
export const CAPACITY_TRANCHE_KINDS = [
  'NATIVE_COMMITTED_CAPACITY',
  'EXTERNAL_FUNDED_CAPACITY',
  'SPONSORED_CAPACITY',
  'EMPLOYER_FUNDED_CAPACITY',
  'GOVERNMENT_FUNDED_CAPACITY',
  'PROMOTIONAL_PROVIDER_CAPACITY',
] as const;
export type CapacityTrancheKind = (typeof CAPACITY_TRANCHE_KINDS)[number];

/** Provider settlement liability lifecycle states. */
export const SETTLEMENT_LIABILITY_STATES = [
  'QUOTED',
  'RESERVED',
  'COMMITTED',
  'CAPTURED',
  'RELEASED',
  'REFUNDED',
  'DEFAULT_REVIEW',
] as const;
export type SettlementLiabilityState = (typeof SETTLEMENT_LIABILITY_STATES)[number];

/** Reserve position states — reference/aggregation only, not authoritative balances. */
export const RESERVE_POSITION_STATES = [
  'AVAILABLE',
  'RESERVED',
  'COMMITTED',
  'CAPTURED',
  'RELEASED',
] as const;
export type ReservePositionState = (typeof RESERVE_POSITION_STATES)[number];

/** Consumer-facing availability posture. No internal treasury detail. */
export const CONSUMER_AVAILABILITY_POSTURES = [
  'AVAILABLE',
  'LIMITED',
  'TEMPORARILY_UNAVAILABLE',
] as const;
export type ConsumerAvailabilityPosture = (typeof CONSUMER_AVAILABILITY_POSTURES)[number];

/** Solvency aggregation dimensions. Denominations are never combined without a quote. */
export const SOLVENCY_DIMENSIONS = [
  'currency',
  'jurisdiction',
  'provider',
  'category',
  'epoch',
] as const;
export type SolvencyDimension = (typeof SOLVENCY_DIMENSIONS)[number];

/** Risk haircut categories — simulation policy only. */
export const RISK_HAIRCUT_KINDS = [
  'PROVIDER_QUOTE_VOLATILITY',
  'FX_EXPOSURE',
  'CANCELLATION_RISK',
  'REFUND_RISK',
  'PROVIDER_FAILURE',
  'SETTLEMENT_DELAY',
] as const;
export type RiskHaircutKind = (typeof RISK_HAIRCUT_KINDS)[number];

export function isExternalFundedTranche(kind: CapacityTrancheKind): boolean {
  return (
    kind === 'EXTERNAL_FUNDED_CAPACITY' ||
    kind === 'SPONSORED_CAPACITY' ||
    kind === 'EMPLOYER_FUNDED_CAPACITY' ||
    kind === 'GOVERNMENT_FUNDED_CAPACITY' ||
    kind === 'PROMOTIONAL_PROVIDER_CAPACITY'
  );
}

export function isNativeTranche(kind: CapacityTrancheKind): boolean {
  return kind === 'NATIVE_COMMITTED_CAPACITY';
}
