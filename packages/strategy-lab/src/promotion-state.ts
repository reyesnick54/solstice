import { err, ok, type Result } from '../../domain/src/result.ts';
import type { StrategyFailure } from './types.ts';

/** H18 controlled promotion progression: RESEARCH → EVALUATED → SHADOW → PAPER. */
export const STRATEGY_PROMOTION_STATES = [
  'RESEARCH',
  'EVALUATION_ELIGIBLE',
  'EVALUATED',
  'SHADOW_ELIGIBLE',
  'SHADOW_ACTIVE',
  'PAPER_ELIGIBLE',
  'PAPER_ACTIVE',
  'PAUSED',
  'REVIEW_REQUIRED',
  'RETIRED',
] as const;

export type StrategyPromotionState = (typeof STRATEGY_PROMOTION_STATES)[number];

export const PROMOTION_DECISION_KINDS = [
  'PROMOTION_RECOMMENDED',
  'PROMOTED_TO_SHADOW',
  'PROMOTED_TO_PAPER',
  'DEMOTED',
  'REQUALIFICATION_REQUIRED',
  'GATE_PASSED',
  'GATE_FAILED',
] as const;

export type PromotionDecisionKind = (typeof PROMOTION_DECISION_KINDS)[number];

export const AUTHORITATIVE_PROMOTION_KINDS = [
  'PROMOTED_TO_SHADOW',
  'PROMOTED_TO_PAPER',
  'DEMOTED',
] as const;

export type AuthoritativePromotionKind = (typeof AUTHORITATIVE_PROMOTION_KINDS)[number];

export const RECOMMENDATION_ONLY_KINDS = ['PROMOTION_RECOMMENDED'] as const;

export const LEGAL_PROMOTION_TRANSITIONS: Readonly<
  Record<StrategyPromotionState, readonly StrategyPromotionState[]>
> = Object.freeze({
  RESEARCH: Object.freeze(['EVALUATION_ELIGIBLE', 'RETIRED'] as const),
  EVALUATION_ELIGIBLE: Object.freeze(['EVALUATED', 'REVIEW_REQUIRED', 'RESEARCH', 'RETIRED'] as const),
  EVALUATED: Object.freeze(['SHADOW_ELIGIBLE', 'REVIEW_REQUIRED', 'RETIRED'] as const),
  SHADOW_ELIGIBLE: Object.freeze(['SHADOW_ACTIVE', 'REVIEW_REQUIRED', 'RETIRED'] as const),
  SHADOW_ACTIVE: Object.freeze(['PAPER_ELIGIBLE', 'PAUSED', 'REVIEW_REQUIRED', 'RETIRED'] as const),
  PAPER_ELIGIBLE: Object.freeze(['PAPER_ACTIVE', 'PAUSED', 'REVIEW_REQUIRED', 'RETIRED'] as const),
  PAPER_ACTIVE: Object.freeze(['PAUSED', 'REVIEW_REQUIRED', 'RETIRED'] as const),
  PAUSED: Object.freeze(['REVIEW_REQUIRED', 'RESEARCH', 'RETIRED'] as const),
  REVIEW_REQUIRED: Object.freeze(['RESEARCH', 'EVALUATION_ELIGIBLE', 'RETIRED'] as const),
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
