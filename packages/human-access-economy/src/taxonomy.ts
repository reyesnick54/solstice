/**
 * Human Access Economy presentation taxonomy.
 * Category labels are consumer-facing metadata only.
 * Canonical productive taxonomy remains owned by packages/sunrey-chain.
 */

export const ACCESS_CATEGORIES = [
  'MOBILITY',
  'TRAVEL',
  'STAY_HOUSING',
  'FOOD',
  'EXPERIENCES',
  'COMPUTE_AI',
  'ROBOTS_SERVICES',
  'ENERGY',
  'GOODS',
] as const;
export type AccessCategory = (typeof ACCESS_CATEGORIES)[number];

export const ACCESS_CATEGORY_LABELS: Readonly<Record<AccessCategory, string>> = Object.freeze({
  MOBILITY: 'Mobility',
  TRAVEL: 'Travel',
  STAY_HOUSING: 'Stay & housing',
  FOOD: 'Food',
  EXPERIENCES: 'Experiences',
  COMPUTE_AI: 'Compute & AI',
  ROBOTS_SERVICES: 'Robots & services',
  ENERGY: 'Energy',
  GOODS: 'Goods',
});

export const ACCESS_ENTITLEMENT_STATUSES = [
  'ACTIVE',
  'PENDING',
  'EXPIRED',
  'SUSPENDED',
  'REVOKED',
] as const;
export type AccessEntitlementStatus = (typeof ACCESS_ENTITLEMENT_STATUSES)[number];

export const ACCESS_RESERVATION_STATUSES = [
  'DRAFT',
  'QUOTED',
  'HELD',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type AccessReservationStatus = (typeof ACCESS_RESERVATION_STATUSES)[number];

export const ACCESS_EXPERIENCE_STATUSES = [
  'QUOTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type AccessExperienceStatus = (typeof ACCESS_EXPERIENCE_STATUSES)[number];

export const ACCESS_INTENT_STATUSES = [
  'SUBMITTED',
  'MATCHING',
  'QUOTED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type AccessIntentStatus = (typeof ACCESS_INTENT_STATUSES)[number];

export const ACCESS_AVAILABILITY_STATES = [
  'UNKNOWN',
  'CHECK_REQUIRED',
  'LIMITED',
  'AVAILABLE_SIMULATION',
  'UNAVAILABLE',
  'DISABLED',
] as const;
export type AccessAvailabilityState = (typeof ACCESS_AVAILABILITY_STATES)[number];

export const ACCESS_ACTIVITY_KINDS = [
  'INTENT_CREATED',
  'AVAILABILITY_CHECKED',
  'QUOTE_CREATED',
  'RESERVATION_CREATED',
  'RESERVATION_CONFIRMED',
  'RESERVATION_CANCELLED',
  'EXPERIENCE_QUOTED',
  'EXPERIENCE_CONFIRMED',
] as const;
export type AccessActivityKind = (typeof ACCESS_ACTIVITY_KINDS)[number];

export const ACCESS_POSTURE = Object.freeze({
  productionReady: false as const,
  productionActive: false as const,
  liveConnectivityEnabled: false as const,
});
