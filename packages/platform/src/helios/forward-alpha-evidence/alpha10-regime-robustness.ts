/**
 * ALPHA10 — regime robustness requirements for forward evidence promotion.
 */

export const HELIOS_ALPHA10_REGIME_ROBUSTNESS = 'HELIOS_ALPHA10_REGIME_ROBUSTNESS' as const;

export const REQUIRED_FORWARD_REGIMES = Object.freeze([
  'LIQUID_NORMAL',
  'ELEVATED_VOL',
  'STRESSED_LIQUIDITY',
] as const);

export type ForwardRegimeId = (typeof REQUIRED_FORWARD_REGIMES)[number];

export function countSatisfiedRegimes(observed: ReadonlySet<ForwardRegimeId>): number {
  return REQUIRED_FORWARD_REGIMES.filter((id) => observed.has(id)).length;
}

export function regimeRobustnessSatisfied(observed: ReadonlySet<ForwardRegimeId>): boolean {
  return countSatisfiedRegimes(observed) >= REQUIRED_FORWARD_REGIMES.length;
}
