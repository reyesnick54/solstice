/**
 * HELIOS EVOL09 — StrategyDiscoveryEvidence builder.
 */

import {
  benjaminiHochbergFdr,
  buildMultipleTestingState,
  buildSelectionBiasAssessment,
  computeEffectiveIndependentTrials,
  computeEvol09DeflatedSharpe,
  computeEvol09Pbo,
  computeProbabilisticSharpeRatio,
  maxAndMeanPairwiseBehavioralCorrelation,
  maxAndMeanPairwiseReturnCorrelation,
  nearDuplicateGenomeRate,
} from './stats.ts';
import { evaluateFamilyWiseBudget } from './budget.ts';
import { createSealedHoldoutVault } from './holdout.ts';
import {
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED,
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED,
  HELIOS_EVOL09_SCHEMA,
} from './taxonomy.ts';
import type {
  EvolutionTrialRecord,
  FamilyWiseResearchBudget,
  ResearchFdrConfig,
  ResearchFdrResult,
  SealedHoldoutSegment,
  StrategyDiscoveryEvidence,
} from './types.ts';

const DEFAULT_SEGMENT: SealedHoldoutSegment = Object.freeze({
  segmentId: 'evol09:sealed-holdout:v1',
  reservedForHoldout: true as const,
});

export function buildStrategyDiscoveryEvidence(input: {
  readonly trials: readonly EvolutionTrialRecord[];
  readonly budget: FamilyWiseResearchBudget;
  readonly featureFdr?: ResearchFdrConfig | null;
  readonly holdoutSegment?: SealedHoldoutSegment;
}): StrategyDiscoveryEvidence {
  const { maxAbs: maxReturnAbs } = maxAndMeanPairwiseReturnCorrelation(input.trials);
  const { maxAbs: maxBehaviorAbs } = maxAndMeanPairwiseBehavioralCorrelation(input.trials);
  const dupRate = nearDuplicateGenomeRate(input.trials);

  const effectiveIndependentTrials = computeEffectiveIndependentTrials({
    totalTrials: input.trials.length,
    maxAbsReturnCorrelation: maxReturnAbs,
    maxAbsBehavioralCorrelation: maxBehaviorAbs,
    nearDuplicateGenomeRate: dupRate,
  });

  const multipleTesting = buildMultipleTestingState({
    trials: input.trials,
    effectiveIndependentTrials,
  });

  const selectionBias = buildSelectionBiasAssessment({
    trials: input.trials,
    effectiveIndependentTrials,
  });

  const familyBudgetViolations = evaluateFamilyWiseBudget({
    trials: input.trials,
    budget: input.budget,
  });

  const trialAdjustment = Math.max(1, Math.round(effectiveIndependentTrials));
  const deflatedSharpeRatio = computeEvol09DeflatedSharpe({
    trials: input.trials,
    trialCountForAdjustment: trialAdjustment,
  });

  const lengths = input.trials.map((t) => t.researchReturns.length);
  const stackedLen = lengths.length > 0 ? Math.min(...lengths) : 0;
  let aggregated: number[] = [];
  if (stackedLen > 0) {
    aggregated = new Array<number>(stackedLen).fill(0);
    for (const t of input.trials) {
      const r = t.researchReturns;
      const start = r.length - stackedLen;
      for (let i = 0; i < stackedLen; i += 1) {
        aggregated[i]! += r[start + i]! / input.trials.length;
      }
    }
  }
  const probabilisticSharpeRatio =
    aggregated.length > 0
      ? computeProbabilisticSharpeRatio({ returns: aggregated, trialsAdjusted: trialAdjustment })
      : null;

  const probabilityOfBacktestOverfitting = computeEvol09Pbo(input.trials);

  let fdrScreen: ResearchFdrResult | null = null;
  if (input.featureFdr && input.featureFdr.rawPValues.length > 0) {
    const fdr = benjaminiHochbergFdr({
      pValues: input.featureFdr.rawPValues,
      q: input.featureFdr.fdrLevel,
    });
    fdrScreen = Object.freeze({
      featureScreenIds: Object.freeze([...input.featureFdr.featureScreenIds]),
      adjustedPValues: fdr.adjustedPValues,
      rejectedNullHypothesis: fdr.rejected,
      fdrLevel: input.featureFdr.fdrLevel,
      applicable: fdr.applicable,
    });
  }

  const holdoutVault = createSealedHoldoutVault(input.holdoutSegment ?? DEFAULT_SEGMENT);

  const budgetOk = familyBudgetViolations.length === 0;
  const dsrOk = deflatedSharpeRatio === null || deflatedSharpeRatio > 0;
  const pboOk =
    probabilityOfBacktestOverfitting === null || probabilityOfBacktestOverfitting <= 0.5 + 1e-6;
  const trackOk = selectionBias.meetsMinimumTrackRecord;

  const qualified = budgetOk && dsrOk && pboOk && trackOk;

  return Object.freeze({
    schema: HELIOS_EVOL09_SCHEMA,
    qualificationMarker: qualified
      ? HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED
      : HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED,
    multipleTesting,
    selectionBias,
    familyBudgetViolations: Object.freeze([...familyBudgetViolations]),
    deflatedSharpeRatio,
    probabilisticSharpeRatio,
    probabilityOfBacktestOverfitting,
    fdrScreen,
    holdoutVault,
    holdoutStillSealed: holdoutVault.state === 'RESEARCH_ACTIVE',
  });
}
