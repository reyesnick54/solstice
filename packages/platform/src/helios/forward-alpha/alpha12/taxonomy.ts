/**
 * HELIOS FORWARD ALPHA — ALPHA12 strategy capacity and scalability engine.
 */

export const ALPHA12_CAPACITY_ENGINE_SCHEMA = 'sunrey.helios.forward-alpha.alpha12.v1' as const;

export const ALPHA12_CAPACITY_ENGINE_MODULE = 'packages/platform/src/helios/forward-alpha/alpha12' as const;

export const HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED = 'HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED' as const;

export const HELIOS_ALPHA12_CAPACITY_ENGINE_BLOCKED = 'HELIOS_ALPHA12_CAPACITY_ENGINE_BLOCKED' as const;

/** Capital multipliers relative to campaign shadow capital (liquidity permitting). */
export const ALPHA12_CAPITAL_SCALE_MULTIPLIERS = Object.freeze([1, 2, 5, 10, 25, 50] as const);

export type Alpha12CapitalScaleMultiplier = (typeof ALPHA12_CAPITAL_SCALE_MULTIPLIERS)[number];

export const ALPHA12_IMPACT_MODEL_VERSION = 'helios-alpha12-impact-sqrt-v1' as const;

export const ALPHA12_CAPACITY_CLASSIFICATIONS = Object.freeze([
  'MICRO_SCALABLE',
  'SMALL_SCALE_VIABLE',
  'MID_SCALE_VIABLE',
  'INSTITUTIONAL_SCALE_VIABLE',
  'ECONOMICALLY_IMPOSSIBLE_AT_SCALE',
  'INSUFFICIENT_LIQUIDITY_DATA',
] as const);

export type Alpha12CapacityClassification = (typeof ALPHA12_CAPACITY_CLASSIFICATIONS)[number];
