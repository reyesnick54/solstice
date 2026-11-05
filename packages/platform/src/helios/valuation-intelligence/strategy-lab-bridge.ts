/**
 * Strategy Lab research binding — portable ref without platform→strategy-lab imports.
 */

import type { UtcInstant } from '@solstice/domain';
import type { StrategyLabResearchBinding } from './input-manifest.ts';

export type StrategyLabValuationResearchRef = {
  readonly strategyEvaluationId: string;
  readonly qualificationRef: string;
  readonly genomeId: string | null;
  readonly evaluatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export function toStrategyLabValuationResearchRef(input: {
  readonly strategyEvaluationId: string;
  readonly qualificationRef: string;
  readonly genomeId?: string | null;
  readonly evaluatedAt: UtcInstant;
}): StrategyLabValuationResearchRef {
  return Object.freeze({
    strategyEvaluationId: input.strategyEvaluationId,
    qualificationRef: input.qualificationRef,
    genomeId: input.genomeId ?? null,
    evaluatedAt: input.evaluatedAt,
    grantsExecutionAuthority: false,
  });
}

export function bindStrategyLabResearch(input: {
  readonly ref: StrategyLabValuationResearchRef;
  readonly knowableAt: UtcInstant;
}): StrategyLabResearchBinding {
  return Object.freeze({
    source: 'strategy_lab_research',
    strategyEvaluationId: input.ref.strategyEvaluationId,
    qualificationRef: input.ref.qualificationRef,
    knowableAt: input.knowableAt,
    grantsExecutionAuthority: false,
  });
}
