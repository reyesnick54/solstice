/**
 * ACCESS Wave 1 Prompt 30 — Funding and solvency taxonomy.
 *
 * Domain subledger for Access entitlements and fiat funding pools.
 * Not the canonical financial ledger; reconcilable with it via evidence refs.
 */

export const ACCESS_FUNDING_SOLVENCY_SCHEMA = 'sunrey.access.funding-solvency.v1' as const;
export const ACCESS_FUNDING_SOLVENCY_CHUNK = 'ACCESS-30' as const;

/** Immutable entitlement ledger entry kinds. */
export const ENTITLEMENT_LEDGER_ENTRY_TYPES = [
  'ALLOCATION',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'REDEMPTION',
  'REVERSAL',
  'EXPIRATION',
  'MANUAL_ADJUSTMENT',
] as const;
export type EntitlementLedgerEntryType = (typeof ENTITLEMENT_LEDGER_ENTRY_TYPES)[number];

export const ENTITLEMENT_DIRECTIONS = ['CREDIT', 'DEBIT'] as const;
export type EntitlementDirection = (typeof ENTITLEMENT_DIRECTIONS)[number];

/** Immutable funding ledger entry kinds. */
export const FUNDING_LEDGER_ENTRY_TYPES = [
  'FUNDING_RECEIVED',
  'FUNDING_COMMITTED',
  'FUNDING_RELEASED',
  'SETTLEMENT_RESERVED',
  'SETTLEMENT_RELEASED',
  'SETTLEMENT_CAPTURED',
  'REFUND_RECEIVED',
  'RESERVE_ALLOCATED',
  'RESERVE_RELEASED',
  'ADJUSTMENT',
] as const;
export type FundingLedgerEntryType = (typeof FUNDING_LEDGER_ENTRY_TYPES)[number];

export const FUNDING_DIRECTIONS = ['CREDIT', 'DEBIT'] as const;
export type FundingDirection = (typeof FUNDING_DIRECTIONS)[number];

export const FUNDING_SOURCE_TYPES = [
  'TREASURY',
  'SUBSCRIPTION',
  'PROVIDER_DISCOUNT',
  'COMMISSION',
  'SPONSOR',
  'EMPLOYER',
  'GOVERNMENT_PROGRAM',
  'PROMOTIONAL_BUDGET',
  'OTHER',
] as const;
export type AccessFundingSourceType = (typeof FUNDING_SOURCE_TYPES)[number];

/** How provider discount value is represented — not unrestricted cash. */
export const FUNDING_VALUE_KINDS = [
  'CASH_FUNDED',
  'DISCOUNT_CAPACITY',
  'PROVIDER_CONTRIBUTED_CAPACITY',
] as const;
export type FundingValueKind = (typeof FUNDING_VALUE_KINDS)[number];

export const FUNDING_POOL_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
export type AccessFundingPoolStatus = (typeof FUNDING_POOL_STATUSES)[number];

export const FUNDING_SOURCE_STATUSES = ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CLOSED'] as const;
export type AccessFundingSourceStatus = (typeof FUNDING_SOURCE_STATUSES)[number];

export const FUNDING_RESERVATION_STATUSES = [
  'PENDING',
  'RESERVED',
  'RELEASED',
  'CONSUMED',
  'EXPIRED',
  'FAILED',
] as const;
export type AccessFundingReservationStatus = (typeof FUNDING_RESERVATION_STATUSES)[number];

export const ENTITLEMENT_RESERVATION_STATUSES = [
  'PENDING',
  'RESERVED',
  'RELEASED',
  'CONSUMED',
  'EXPIRED',
  'FAILED',
] as const;
export type AccessEntitlementReservationStatus = (typeof ENTITLEMENT_RESERVATION_STATUSES)[number];

export const SOLVENCY_STATUSES = ['HEALTHY', 'LIMITED', 'EXHAUSTED', 'SUSPENDED'] as const;
export type SolvencyStatus = (typeof SOLVENCY_STATUSES)[number];

export const FUNDING_CATEGORY_POLICIES = ['STRICT_CATEGORY', 'SHARED_POOL'] as const;
export type FundingCategoryPolicy = (typeof FUNDING_CATEGORY_POLICIES)[number];

export const FUNDED_CAPACITY_STATES = [
  'FUNDED',
  'PARTIALLY_FUNDED',
  'PROVIDER_CONTRIBUTED',
  'UNFUNDED',
] as const;
export type FundedCapacityState = (typeof FUNDED_CAPACITY_STATES)[number];

/** Token conversion contribution is always zero at Access launch. */
export const TOKEN_CONVERSION_CONTRIBUTION = 0n as const;

export function isCashFundedSource(sourceType: AccessFundingSourceType): boolean {
  return (
    sourceType === 'TREASURY' ||
    sourceType === 'SUBSCRIPTION' ||
    sourceType === 'COMMISSION' ||
    sourceType === 'SPONSOR' ||
    sourceType === 'EMPLOYER' ||
    sourceType === 'GOVERNMENT_PROGRAM' ||
    sourceType === 'PROMOTIONAL_BUDGET' ||
    sourceType === 'OTHER'
  );
}

export function isDiscountSource(sourceType: AccessFundingSourceType): boolean {
  return sourceType === 'PROVIDER_DISCOUNT';
}

export function fundingValueKindForSource(sourceType: AccessFundingSourceType): FundingValueKind {
  if (sourceType === 'PROVIDER_DISCOUNT') {
    return 'DISCOUNT_CAPACITY';
  }
  return 'CASH_FUNDED';
}
