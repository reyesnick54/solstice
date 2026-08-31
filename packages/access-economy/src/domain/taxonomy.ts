/**
 * ACCESS Wave 1 / Prompt 28 — canonical Access domain taxonomy.
 *
 * Access is a governed right to use productive capacity. It is not a third
 * currency, bank balance, or guaranteed fiat redemption instrument.
 */

export const ACCESS_DOMAIN_SCHEMA_VERSION = 1 as const;
export const ACCESS_DOMAIN_TAXONOMY_ID = 'sunrey-access-domain-wave1' as const;
export const ACCESS_DOMAIN_TAXONOMY_VERSION = '1' as const;

/** Governed productive-capacity categories. Extend by appending; do not renumber. */
export const ACCESS_CATEGORIES = [
  'MOBILITY',
  'LODGING',
  'EXPERIENCES',
  'FOOD',
  'AI_COMPUTE',
  'ENERGY',
  'TRANSPORTATION',
  'ROBOTICS',
  'OTHER',
] as const;
export type AccessCategoryId = (typeof ACCESS_CATEGORIES)[number];

/** Canonical access units. Every entitlement quantity must name one of these. */
export const ACCESS_UNITS = [
  'VEHICLE_HOUR',
  'VEHICLE_DAY',
  'ROOM_NIGHT',
  'ADMISSION',
  'MEAL',
  'FOOD_BASKET',
  'GPU_HOUR',
  'INFERENCE_UNIT',
  'KWH',
  'ROBOT_HOUR',
  'RIDE',
  'TRIP',
  'OTHER',
] as const;
export type AccessUnit = (typeof ACCESS_UNITS)[number];

export const ACCESS_CAPACITY_SOURCES = [
  'TREASURY_FUNDED',
  'PROVIDER_CONTRIBUTED',
  'SPONSORED',
  'EMPLOYER_FUNDED',
  'GOVERNMENT_FUNDED',
  'NATIVE_PRODUCTIVE_CAPACITY',
] as const;
export type AccessCapacitySource = (typeof ACCESS_CAPACITY_SOURCES)[number];

export const ACCESS_CAPACITY_STATUSES = [
  'DRAFT',
  'AVAILABLE',
  'PARTIALLY_RESERVED',
  'FULLY_RESERVED',
  'EXHAUSTED',
  'CLOSED',
] as const;
export type AccessCapacityStatus = (typeof ACCESS_CAPACITY_STATUSES)[number];

export const ACCESS_ENTITLEMENT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'PARTIALLY_USED',
  'EXHAUSTED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type AccessDomainEntitlementStatus = (typeof ACCESS_ENTITLEMENT_STATUSES)[number];

export const ACCESS_QUOTE_STATUSES = [
  'DRAFT',
  'ISSUED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
] as const;
export type AccessDomainQuoteStatus = (typeof ACCESS_QUOTE_STATUSES)[number];

export const ACCESS_RESERVATION_STATUSES = [
  'PENDING',
  'ENTITLEMENT_RESERVED',
  'PROVIDER_RESERVED',
  'CONFIRMED',
  'EXPIRED',
  'RELEASED',
  'FAILED',
] as const;
export type AccessDomainReservationStatus = (typeof ACCESS_RESERVATION_STATUSES)[number];

export const ACCESS_REDEMPTION_STATUSES = [
  'PENDING',
  'RESERVED',
  'FULFILLED',
  'REVERSED',
  'FAILED',
] as const;
export type AccessDomainRedemptionStatus = (typeof ACCESS_REDEMPTION_STATUSES)[number];

export const ACCESS_SETTLEMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'VOIDED',
  'FAILED',
] as const;
export type AccessDomainSettlementStatus = (typeof ACCESS_SETTLEMENT_STATUSES)[number];

export const ACCESS_TRANSACTION_STATUSES = [
  'CREATED',
  'DISCOVERED',
  'QUOTED',
  'REQUOTE_REQUIRED',
  'ELIGIBLE',
  'ELIGIBILITY_APPROVED',
  'ENTITLEMENT_RESERVED',
  'FUNDING_RESERVED',
  'RESERVED',
  'USER_PAYMENT_AUTHORIZED',
  'PROVIDER_RESERVED',
  'PROVIDER_PAYMENT_AUTHORIZED',
  'BOOKING_PENDING',
  'BOOKED',
  'FULFILLMENT_PENDING',
  'FULFILLED',
  'SETTLEMENT_PENDING',
  'SETTLED',
  'CANCEL_PENDING',
  'CANCELLED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'RECONCILIATION_REQUIRED',
  'REVIEW_REQUIRED',
  'FAILED',
  'DISPUTED',
] as const;
export type AccessDomainTransactionStatus = (typeof ACCESS_TRANSACTION_STATUSES)[number];

/** Default unit per category for catalog bootstrap. Not an allocation formula. */
export const DEFAULT_CATEGORY_UNITS: Readonly<Record<AccessCategoryId, AccessUnit>> = Object.freeze({
  MOBILITY: 'VEHICLE_DAY',
  LODGING: 'ROOM_NIGHT',
  EXPERIENCES: 'ADMISSION',
  FOOD: 'MEAL',
  AI_COMPUTE: 'GPU_HOUR',
  ENERGY: 'KWH',
  TRANSPORTATION: 'RIDE',
  ROBOTICS: 'ROBOT_HOUR',
  OTHER: 'OTHER',
});

export function isAccessCategoryId(value: string): value is AccessCategoryId {
  return (ACCESS_CATEGORIES as readonly string[]).includes(value);
}

export function isAccessUnit(value: string): value is AccessUnit {
  return (ACCESS_UNITS as readonly string[]).includes(value);
}

export function isAccessCapacitySource(value: string): value is AccessCapacitySource {
  return (ACCESS_CAPACITY_SOURCES as readonly string[]).includes(value);
}
