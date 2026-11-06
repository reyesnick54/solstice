import { err, ok, type Result } from '@solstice/domain';
import type { StrategyFailure } from './types.ts';

/**
 * H18 controlled progression + HELIOS EVOL11 champion–challenger research states.
 * Champions and challengers remain simulation / research tracks only (`isLiveEligibleState` is always false).
 */
export const STRATEGY_PROMOTION_STATES = [
  'CANDIDATE',
  'EVALUATION_ELIGIBLE',
  'EVALUATED',
  'QUALIFIED_CHALLENGER',
  'SHADOW_ELIGIBLE',
  'SHADOW_ACTIVE',
  'SHADOW_CHALLENGER',
  'PAPER_ELIGIBLE',
  'PAPER_ACTIVE',
  'PAPER_CHALLENGER',
  'NICHE_CHAMPION',
  'GLOBAL_RESEARCH_CHAMPION',
  'DEGRADED',
  'DEMOTED',
  'PAUSED',
  'REVIEW_REQUIRED',
  'RETIRED',
] as const;

export type StrategyPromotionState = (typeof STRATEGY_PROMOTION_STATES)[number];

export const PROMOTION_DECISION_KINDS = [
  'PROMOTION_RECOMMENDED',
  'PROMOTED_TO_SHADOW',
  'PROMOTED_TO_PAPER',
  'QUALIFIED_AS_CHALLENGER',
  'CHAMPION_NAMED',
  'DEGRADATION_DETECTED',
  'DEMOTED',
  'REQUALIFICATION_REQUIRED',
  'GATE_PASSED',
  'GATE_FAILED',
] as const;

export type PromotionDecisionKind = (typeof PROMOTION_DECISION_KINDS)[number];

export const AUTHORITATIVE_PROMOTION_KINDS = [
  'PROMOTED_TO_SHADOW',
  'PROMOTED_TO_PAPER',
  'QUALIFIED_AS_CHALLENGER',
  'CHAMPION_NAMED',
  'DEGRADATION_DETECTED',
  'DEMOTED',
] as const;

export type AuthoritativePromotionKind = (typeof AUTHORITATIVE_PROMOTION_KINDS)[number];

export const RECOMMENDATION_ONLY_KINDS = ['PROMOTION_RECOMMENDED'] as const;

export const LEGAL_PROMOTION_TRANSITIONS: Readonly<
  Record<StrategyPromotionState, readonly StrategyPromotionState[]>
> = Object.freeze({
  CANDIDATE: Object.freeze(['EVALUATION_ELIGIBLE', 'RETIRED'] as const),
  EVALUATION_ELIGIBLE: Object.freeze(['EVALUATED', 'REVIEW_REQUIRED', 'CANDIDATE', 'RETIRED'] as const),
  EVALUATED: Object.freeze([
    'QUALIFIED_CHALLENGER',
    'SHADOW_ELIGIBLE',
    'REVIEW_REQUIRED',
    'RETIRED',
  ] as const),
  QUALIFIED_CHALLENGER: Object.freeze([
    'SHADOW_ELIGIBLE',
    'REVIEW_REQUIRED',
    'DEGRADED',
    'RETIRED',
  ] as const),
  SHADOW_ELIGIBLE: Object.freeze([
    'SHADOW_ACTIVE',
    'SHADOW_CHALLENGER',
    'REVIEW_REQUIRED',
    'RETIRED',
  ] as const),
  SHADOW_ACTIVE: Object.freeze([
    'PAPER_ELIGIBLE',
    'PAUSED',
    'REVIEW_REQUIRED',
    'DEGRADED',
    'RETIRED',
  ] as const),
  SHADOW_CHALLENGER: Object.freeze([
    'PAPER_ELIGIBLE',
    'PAPER_CHALLENGER',
    'PAUSED',
    'REVIEW_REQUIRED',
    'DEGRADED',
    'RETIRED',
  ] as const),
  PAPER_ELIGIBLE: Object.freeze([
    'PAPER_ACTIVE',
    'PAPER_CHALLENGER',
    'PAUSED',
    'REVIEW_REQUIRED',
    'RETIRED',
  ] as const),
  PAPER_ACTIVE: Object.freeze([
    'NICHE_CHAMPION',
    'GLOBAL_RESEARCH_CHAMPION',
    'PAUSED',
    'REVIEW_REQUIRED',
    'DEGRADED',
    'RETIRED',
  ] as const),
  PAPER_CHALLENGER: Object.freeze([
    'NICHE_CHAMPION',
    'GLOBAL_RESEARCH_CHAMPION',
    'PAUSED',
    'REVIEW_REQUIRED',
    'DEGRADED',
    'RETIRED',
  ] as const),
  NICHE_CHAMPION: Object.freeze([
    'DEGRADED',
    'SHADOW_CHALLENGER',
    'SHADOW_ELIGIBLE',
    'REVIEW_REQUIRED',
    'RETIRED',
  ] as const),
  GLOBAL_RESEARCH_CHAMPION: Object.freeze([
    'DEGRADED',
    'SHADOW_CHALLENGER',
    'SHADOW_ELIGIBLE',
    'REVIEW_REQUIRED',
    'RETIRED',
  ] as const),
  DEGRADED: Object.freeze(['SHADOW_CHALLENGER', 'SHADOW_ELIGIBLE', 'REVIEW_REQUIRED', 'RETIRED'] as const),
  DEMOTED: Object.freeze(['REVIEW_REQUIRED', 'CANDIDATE', 'RETIRED'] as const),
  PAUSED: Object.freeze(['REVIEW_REQUIRED', 'CANDIDATE', 'RETIRED'] as const),
  REVIEW_REQUIRED: Object.freeze(['CANDIDATE', 'EVALUATION_ELIGIBLE', 'RETIRED'] as const),
  RETIRED: Object.freeze([] as const),
});

export function transitionPromotionState(
  from: StrategyPromotionState,
  to: StrategyPromotionState,
): Result<StrategyPromotionState, StrategyFailure> {
  if (from === to) {
    return ok(from);
  }
  if (!LEGAL_PROMOTION_TRANSITIONS[from].includes(to)) {
    return err({
      code: 'INVALID_TRANSITION',
      message: `cannot move promotion state ${from} to ${to}`,
    });
  }
  return ok(to);
}

export function isLiveEligibleState(_state: StrategyPromotionState): false {
  return false;
}

/** @deprecated Use `CANDIDATE` — kept for call sites migrating to EVOL11. */
export const LEGACY_RESEARCH_PROMOTION_STATE = 'CANDIDATE' as const satisfies StrategyPromotionState;

export function normalizeLegacyPromotionState(value: string): StrategyPromotionState | null {
  if (value === 'RESEARCH') {
    return 'CANDIDATE';
  }
  return (STRATEGY_PROMOTION_STATES as readonly string[]).includes(value)
    ? (value as StrategyPromotionState)
    : null;
}
