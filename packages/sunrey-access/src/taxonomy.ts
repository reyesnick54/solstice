/**
 * Allocation mechanisms supported by the Access Fabric.
 * Mechanism selection is policy/configuration driven, not hard-coded.
 */
export const ALLOCATION_MECHANISMS = [
  'ENTITLEMENT',
  'QUEUE',
  'LOTTERY',
  'FIXED_ACCESS_RATE',
  'AUCTION',
  'RFQ',
  'MARKET',
  'PRIORITY_POLICY',
] as const;

export type AllocationMechanism = (typeof ALLOCATION_MECHANISMS)[number];

/**
 * Conceptual access regime hints. Not normative law — jurisdiction/product
 * configuration and the Regulatory Digital Twin determine availability.
 */
export const ACCESS_REGIME_HINTS = [
  'ESSENTIAL',
  'ABUNDANT_DISCRETIONARY',
  'SCARCE_PREMIUM',
] as const;

export type AccessRegimeHint = (typeof ACCESS_REGIME_HINTS)[number];

export const SCARCITY_BANDS = [
  'ABUNDANT',
  'BALANCED',
  'CONSTRAINED',
  'CRITICAL',
  'UNAVAILABLE',
] as const;

export type ScarcityBand = (typeof SCARCITY_BANDS)[number];

export const INPUT_CLASSES = ['MARKET', 'POLICY', 'VERIFIED_EVIDENCE'] as const;
export type InputClass = (typeof INPUT_CLASSES)[number];

/**
 * Inputs that must never influence scarcity or allocation.
 */
export const FORBIDDEN_SCARCITY_INPUTS = [
  'HUMAN_WORTH',
  'WEALTH',
  'SOCIAL_STATUS',
  'POLITICAL_BELIEF',
  'PSYCHOLOGICAL_PROFILE',
  'PERSONAL_DESIRABILITY',
] as const;

export type ForbiddenScarcityInput = (typeof FORBIDDEN_SCARCITY_INPUTS)[number];

export const ALLOCATION_OUTCOMES = [
  'GRANTED',
  'QUEUED',
  'LOTTERY_ELIGIBLE',
  'RATE_LIMITED',
  'MARKET_QUOTED',
  'RFQ_REQUIRED',
  'AUCTION_ELIGIBLE',
  'DENIED',
  'DEFERRED',
] as const;

export type AllocationOutcomeKind = (typeof ALLOCATION_OUTCOMES)[number];

export const CAPACITY_REFUSAL_CODES = [
  'CAPACITY_MISSING',
  'CAPACITY_STALE',
  'CAPACITY_ZERO',
  'CAPACITY_UNVERIFIED',
  'CAPACITY_EVIDENCE_MISSING',
] as const;

export type CapacityRefusalCode = (typeof CAPACITY_REFUSAL_CODES)[number];

export const SCARCITY_REFUSAL_CODES = [
  'FORBIDDEN_INPUT_PRESENT',
  'MODEL_VERSION_UNKNOWN',
  'POLICY_DENIAL',
  'RESOURCE_UNAVAILABLE',
  'CONFIGURATION_INVALID',
] as const;

export type ScarcityRefusalCode = (typeof SCARCITY_REFUSAL_CODES)[number];
