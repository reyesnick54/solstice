/**
 * HELIOS EVOL09 — family-wise research budget gates.
 */

import type { EvolutionTrialRecord, FamilyWiseBudgetViolation, FamilyWiseResearchBudget } from './types.ts';

export function evaluateFamilyWiseBudget(input: {
  readonly trials: readonly EvolutionTrialRecord[];
  readonly budget: FamilyWiseResearchBudget;
}): FamilyWiseBudgetViolation[] {
  const violations: FamilyWiseBudgetViolation[] = [];
  const strat: Record<string, number> = {};
  const feat: Record<string, number> = {};

  for (const t of input.trials) {
    strat[t.strategyFamilyId] = (strat[t.strategyFamilyId] ?? 0) + 1;
    feat[t.featureFamilyId] = (feat[t.featureFamilyId] ?? 0) + 1;
  }

  if (input.trials.length > input.budget.maxTotalTrials) {
    violations.push({
      kind: 'TOTAL',
      limit: input.budget.maxTotalTrials,
      observed: input.trials.length,
    });
  }

  if (input.trials.length > input.budget.maxParameterTrials) {
    violations.push({
      kind: 'PARAMETER',
      limit: input.budget.maxParameterTrials,
      observed: input.trials.length,
    });
  }

  for (const [familyId, observed] of Object.entries(strat)) {
    if (observed > input.budget.maxTrialsPerStrategyFamily) {
      violations.push({
        kind: 'STRATEGY_FAMILY',
        limit: input.budget.maxTrialsPerStrategyFamily,
        observed,
        familyId,
      });
    }
  }

  for (const [familyId, observed] of Object.entries(feat)) {
    if (observed > input.budget.maxTrialsPerFeatureFamily) {
      violations.push({
        kind: 'FEATURE_FAMILY',
        limit: input.budget.maxTrialsPerFeatureFamily,
        observed,
        familyId,
      });
    }
  }

  return Object.freeze([...violations]);
}
