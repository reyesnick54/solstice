/**
 * Chunk 121 — Governed MoonRey cross-domain attribution constitution.
 *
 * Attribution decides eligibility shares for claims bound to the same or
 * related productive economic events. It is not the Productive Value
 * Function, not a mint, and not final MoonRey quantity.
 *
 * Principles are explicit and may only get stricter in later policy
 * versions. They are not a live production economic model.
 */

export const ATTRIBUTION_CONSTITUTION_VERSION = 1 as const;
export const ATTRIBUTION_DOMAIN = 'SUNREY_MOONREY_ATTRIBUTION_V1' as const;
export const ATTRIBUTION_SHARE_SCALE = 1_000_000n;
export const ATTRIBUTION_PARAMETER_CLASS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;

export const SAME_UNDERLYING_EVENT_CANNOT_RECEIVE_MULTIPLE_FULL_CREDITS = true as const;
export const DISTINCT_REALIZED_SERVICE_MAY_RECEIVE_SEPARATE_ATTRIBUTION = true as const;
export const CAPACITY_IS_NOT_OUTPUT = true as const;
export const OUTPUT_IS_NOT_DELIVERY = true as const;
export const DELIVERY_IS_NOT_AUTOMATICALLY_NEW_PRODUCTION = true as const;
export const GOODS_IDENTITY_IS_NOT_AUTOMATICALLY_NEW_OUTPUT = true as const;
export const MACHINE_ACTIVITY_IS_NOT_AUTOMATICALLY_NEW_OUTPUT = true as const;
export const ATTRIBUTION_DOES_NOT_MINT = true as const;
export const ATTRIBUTION_DOES_NOT_VALUE_ASSET = true as const;
export const ATTRIBUTION_DOES_FINAL_VALUATION = false as const;
export const ATTRIBUTION_AUTHORIZES_MOONREY = false as const;
export const DUPLICATE_FULL_ATTRIBUTION_ALLOWED = false as const;
export const AI_CAN_ACTIVATE_POLICY = false as const;
export const PRODUCTION_ACTIVE = false as const;

export const ATTRIBUTION_CONSTITUTION = Object.freeze({
  version: ATTRIBUTION_CONSTITUTION_VERSION,
  SAME_UNDERLYING_EVENT_CANNOT_RECEIVE_MULTIPLE_FULL_CREDITS,
  DISTINCT_REALIZED_SERVICE_MAY_RECEIVE_SEPARATE_ATTRIBUTION,
  CAPACITY_IS_NOT_OUTPUT,
  OUTPUT_IS_NOT_DELIVERY,
  DELIVERY_IS_NOT_AUTOMATICALLY_NEW_PRODUCTION,
  GOODS_IDENTITY_IS_NOT_AUTOMATICALLY_NEW_OUTPUT,
  MACHINE_ACTIVITY_IS_NOT_AUTOMATICALLY_NEW_OUTPUT,
  ATTRIBUTION_DOES_NOT_MINT,
  ATTRIBUTION_DOES_NOT_VALUE_ASSET,
  ATTRIBUTION_DOES_FINAL_VALUATION,
  ATTRIBUTION_AUTHORIZES_MOONREY,
  DUPLICATE_FULL_ATTRIBUTION_ALLOWED,
  AI_CAN_ACTIVATE_POLICY,
  PRODUCTION_ACTIVE,
} as const);

export type AttributionConstitution = typeof ATTRIBUTION_CONSTITUTION;
