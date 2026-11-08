/**
 * HELIOS Forward Alpha — shared taxonomy (ALPHA work packages).
 */

export const HELIOS_FORWARD_ALPHA_SCHEMA = 'sunrey.helios.forward-alpha.v1' as const;

export const ALPHA_WORK_PACKAGES = Object.freeze(['ALPHA02', 'ALPHA06', 'ALPHA08', 'ALPHA11', 'ALPHA18'] as const);
export type AlphaWorkPackageId = (typeof ALPHA_WORK_PACKAGES)[number];

export const FORWARD_ALPHA_RETURN_LANES = Object.freeze([
  'SIGNAL_ONLY_RETURN',
  'IMPLEMENTABLE_RETURN',
] as const);
export type ForwardAlphaReturnLane = (typeof FORWARD_ALPHA_RETURN_LANES)[number];

export const FORWARD_STRATEGY_TYPES = Object.freeze([
  'EQUITY_SPOT',
  'CRYPTO_SPOT',
  'PERPETUAL_FUNDING',
] as const);
export type ForwardStrategyType = (typeof FORWARD_STRATEGY_TYPES)[number];

export const ALPHA06_PROMOTION_OUTCOMES = Object.freeze([
  'PROMOTE_PAPER',
  'HOLD_REVIEW',
  'REJECT_DECAY',
] as const);
export type Alpha06PromotionOutcome = (typeof ALPHA06_PROMOTION_OUTCOMES)[number];
