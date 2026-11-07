/**
 * Research-model registry — ML graph outputs stay blocked until they beat deterministic baselines.
 */

import type { SupplyChainBaselineMethod, SupplyChainResearchModelKind } from './taxonomy.ts';

export type SupplyChainModelEvaluation = {
  readonly modelKind: SupplyChainResearchModelKind;
  readonly baselineMethod: SupplyChainBaselineMethod;
  readonly baselineScoreMilli: number;
  readonly modelScoreMilli: number;
  readonly promoted: boolean;
  readonly message: string;
};

export type ResearchModelScoreInput = {
  readonly modelKind: SupplyChainResearchModelKind;
  readonly baselineMethod: SupplyChainBaselineMethod;
  readonly baselineScoreMilli: number;
  /** Fixture or holdout score from the research model (simulation-only). */
  readonly modelScoreMilli: number;
};

/**
 * Promotion requires strictly higher score on the same metric; ties keep the baseline authoritative.
 */
export function evaluateResearchModelPromotion(input: ResearchModelScoreInput): SupplyChainModelEvaluation {
  const promoted = input.modelScoreMilli > input.baselineScoreMilli;
  const message = promoted
    ? `${input.modelKind} outperforms ${input.baselineMethod} baseline`
    : `${input.modelKind} did not beat ${input.baselineMethod}; baseline remains authoritative`;
  return Object.freeze({
    modelKind: input.modelKind,
    baselineMethod: input.baselineMethod,
    baselineScoreMilli: input.baselineScoreMilli,
    modelScoreMilli: input.modelScoreMilli,
    promoted,
    message,
  });
}

export function researchModelCatalog(): readonly SupplyChainResearchModelKind[] {
  return Object.freeze([
    'DIRECTION_SENSITIVE_GNN',
    'HETEROGENEOUS_GRAPH_ATTENTION',
    'TEMPORAL_GNN',
    'GRAPH_PATCH_TRANSFORMER',
  ]);
}
