/**
 * Versioned SunRey Human Access Economy taxonomy.
 *
 * Access tiers are classifications only. They do not encode political benefit
 * policy, guaranteed entitlement, or settlement authority.
 */

export const ACCESS_ECONOMY_TAXONOMY_ID = 'sunrey-human-access-economy-taxonomy' as const;
export const ACCESS_ECONOMY_TAXONOMY_VERSION = '1' as const;
export const ACCESS_ECONOMY_SCHEMA_VERSION = 1 as const;

export const ACCESS_TIERS = ['ESSENTIAL', 'ABUNDANT_DISCRETIONARY', 'SCARCE_PREMIUM'] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

export const ACCESS_BASIS_KINDS = [
  'TIME',
  'QUANTITY',
  'USAGE',
  'LOCATION',
  'CAPACITY',
  'QUALITY_CLASS',
  'AVAILABILITY_WINDOW',
  'PURPOSE',
  'JURISDICTION',
  'RIGHTS_RESTRICTION',
] as const;
export type AccessBasisKind = (typeof ACCESS_BASIS_KINDS)[number];

export const SERVICE_CLASSES = [
  'STANDARD',
  'ECONOMY',
  'PREMIUM',
  'BUSINESS',
  'FIRST',
  'EXECUTIVE',
  'GENERAL_ADMISSION',
  'RESERVED_SEATING',
  'INDUSTRIAL_BASELINE',
  'OTHER_GOVERNED_CLASS',
] as const;
export type ServiceClass = (typeof SERVICE_CLASSES)[number];

export const USAGE_METER_KINDS = [
  'OCCURRENCE',
  'DURATION',
  'ENERGY',
  'COMPUTE',
  'THROUGHPUT',
  'OCCUPANCY',
  'DELIVERY',
  'OTHER_GOVERNED_METER',
] as const;
export type UsageMeterKind = (typeof USAGE_METER_KINDS)[number];

export const LOCATION_PRECISIONS = ['REGION', 'VENUE', 'SITE', 'COORDINATE_COMMITMENT'] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const ACCESS_INTENT_STATES = [
  'DRAFT',
  'PROPOSED',
  'AUTHORIZED',
  'FULFILLED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type AccessIntentState = (typeof ACCESS_INTENT_STATES)[number];

export const ACCESS_RIGHT_STATES = ['PROPOSED', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'SUPERSEDED'] as const;
export type AccessRightState = (typeof ACCESS_RIGHT_STATES)[number];

export const ACCESS_ENTITLEMENT_STATES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'EXHAUSTED', 'REVOKED', 'EXPIRED'] as const;
export type AccessEntitlementState = (typeof ACCESS_ENTITLEMENT_STATES)[number];

export const PERSONAL_ACCESS_ENVELOPE_STATES = ['OPEN', 'SEALED', 'ARCHIVED'] as const;
export type PersonalAccessEnvelopeState = (typeof PERSONAL_ACCESS_ENVELOPE_STATES)[number];

export const CAPACITY_OFFER_STATES = ['DRAFT', 'PUBLISHED', 'WITHDRAWN', 'EXPIRED'] as const;
export type CapacityOfferState = (typeof CAPACITY_OFFER_STATES)[number];

export const CAPACITY_RESERVATION_STATES = [
  'REQUESTED',
  'HELD',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'DISPUTED',
] as const;
export type CapacityReservationState = (typeof CAPACITY_RESERVATION_STATES)[number];

export const ACCESS_QUOTE_STATES = ['DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export type AccessQuoteState = (typeof ACCESS_QUOTE_STATES)[number];

export const ALLOCATION_POLICY_STATES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;
export type AllocationPolicyState = (typeof ALLOCATION_POLICY_STATES)[number];

export const ALLOCATION_DECISION_STATES = ['PENDING', 'GRANTED', 'DENIED', 'DEFERRED', 'EXPIRED'] as const;
export type AllocationDecisionState = (typeof ALLOCATION_DECISION_STATES)[number];

export const EXPERIENCE_BUNDLE_STATES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;
export type ExperienceBundleState = (typeof EXPERIENCE_BUNDLE_STATES)[number];

export const USAGE_EVENT_STATES = ['RECORDED', 'ATTESTED', 'DISPUTED', 'VOIDED'] as const;
export type UsageEventState = (typeof USAGE_EVENT_STATES)[number];

export const USAGE_PROOF_STATES = ['PROPOSED', 'VERIFIED', 'REJECTED', 'EXPIRED'] as const;
export type UsageProofState = (typeof USAGE_PROOF_STATES)[number];

export const DELIVERY_CLAIM_STATES = ['SUBMITTED', 'ACKNOWLEDGED', 'FULFILLED', 'DISPUTED', 'REJECTED'] as const;
export type DeliveryClaimState = (typeof DELIVERY_CLAIM_STATES)[number];

export const ACCESS_ECONOMY_LEGAL_STATUS = Object.freeze({
  status: 'RESEARCH_REQUIRED' as const,
  counselConfirmed: false,
  productionActivated: false,
  politicalBenefitPolicyEncoded: false,
  guaranteedEntitlementClaim: false,
  pricingAuthority: false,
  settlementAuthority: false,
  note: 'Simulation Human Access Economy domain model. Access tiers are classifications only. Not legal advice.',
});

export const PRODUCTION_ACTIVE = false as const;
