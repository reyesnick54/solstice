/**
 * HELIOS H20 — Strategy Capsule taxonomies (minimal surface for H21 validity).
 * Capsules describe qualified strategy intent; they do not grant financial authority.
 */

export const STRATEGY_CAPSULE_PROMOTION_STATES = [
  'CANDIDATE',
  'PROMOTED',
  'REVOKED',
  'EXPIRED',
] as const;

export type StrategyCapsulePromotionState = (typeof STRATEGY_CAPSULE_PROMOTION_STATES)[number];

export const STRATEGY_CAPSULE_QUALIFICATION_STATES = [
  'QUALIFIED',
  'UNQUALIFIED',
  'PENDING_REVIEW',
] as const;

export type StrategyCapsuleQualificationState =
  (typeof STRATEGY_CAPSULE_QUALIFICATION_STATES)[number];
