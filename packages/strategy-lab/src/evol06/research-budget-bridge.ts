import type { ResearchBudgetSnapshot, ResearchValueInput } from '@solstice/platform';
import { evaluateResearchValue, researchSpendFromAssessment } from '@solstice/platform';
import type { ConfidenceState, EvidenceQualityLevel } from '@solstice/platform';

import type { EvolutionWorkerState, ResearchBudgetAllocation } from './types.ts';
import type { PopulationSchedulerConfig } from './types.ts';

function evidenceFromUncertainty(
  worker: EvolutionWorkerState,
): EvidenceQualityLevel {
  const n = worker.uncertainty.sampleCount;
  if (n === 0) return 'INSUFFICIENT';
  if (n >= 5) return 'HIGH';
  if (n >= 2) return 'MEDIUM';
  return 'LOW';
}

function confidenceFromUncertainty(
  worker: EvolutionWorkerState,
  cfg: PopulationSchedulerConfig,
): ConfidenceState {
  if (worker.uncertainty.sampleCount === 0) return 'UNKNOWN';
  if (worker.uncertainty.confidenceHalfWidth >= cfg.highUncertaintyHalfWidth) return 'LOW_CONFIDENCE';
  return 'CALIBRATED';
}

function unresolvedFromUncertainty(
  worker: EvolutionWorkerState,
  cfg: PopulationSchedulerConfig,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (worker.uncertainty.confidenceHalfWidth >= cfg.highUncertaintyHalfWidth) return 'HIGH';
  if (worker.uncertainty.confidenceHalfWidth >= cfg.highUncertaintyHalfWidth / 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Maps EVOL06 population signals into H20 `ResearchValueInput` — research compute only.
 */
export function buildResearchValueInputForWorker(
  worker: EvolutionWorkerState,
  cfg: PopulationSchedulerConfig,
  options: {
    readonly estimatedOpportunitySizeMinor: string;
    readonly opportunityHalfLifeHours: number;
    readonly timeRemainingHours: number;
    readonly nicheScarcity: number;
    readonly populationUncertainty: number;
    readonly historicalMutationProductivity: number;
  },
): ResearchValueInput {
  const evidenceQuality = evidenceFromUncertainty(worker);
  const confidenceState = confidenceFromUncertainty(worker, cfg);
  const unresolvedUncertainty = unresolvedFromUncertainty(worker, cfg);

  const specialistDisagreement =
    (options.nicheScarcity > 0.5 || options.populationUncertainty >= cfg.highUncertaintyHalfWidth) &&
    worker.uncertainty.sampleCount >= 2;

  const calibratedProbabilityBps =
    worker.uncertainty.sampleCount > 0
      ? Math.round(Math.max(0, Math.min(10_000, worker.uncertainty.meanFitness * 100)))
      : null;

  return Object.freeze({
    evidenceQuality,
    unresolvedUncertainty,
    specialistDisagreement,
    estimatedOpportunitySizeMinor: options.estimatedOpportunitySizeMinor,
    confidenceState,
    calibratedProbabilityBps,
    estimatedResearchCostMinor: cfg.estimatedResearchCostMinor,
    opportunityHalfLifeHours: options.opportunityHalfLifeHours,
    timeRemainingHours: options.timeRemainingHours,
    dataAvailable: worker.evaluationPhase !== 'STALLED',
    accountSizeFeasible: true,
  });
}

export function allocateResearchBudgetForWorker(
  worker: EvolutionWorkerState,
  budget: ResearchBudgetSnapshot,
  cfg: PopulationSchedulerConfig,
  options: {
    readonly estimatedOpportunitySizeMinor: string;
    readonly opportunityHalfLifeHours: number;
    readonly timeRemainingHours: number;
    readonly nicheScarcity: number;
    readonly populationUncertainty: number;
    readonly historicalMutationProductivity: number;
    readonly computeCostMinor: string;
  },
): ResearchBudgetAllocation {
  const researchValueInput = buildResearchValueInputForWorker(worker, cfg, options);
  const assessment = evaluateResearchValue(researchValueInput, budget, null);
  const spend = researchSpendFromAssessment(assessment, researchValueInput, budget);

  const currency = budget.currency ?? cfg.currency;

  return Object.freeze({
    workerId: worker.workerId,
    expectedInformationValueTier: assessment.informationValueTier,
    researchValueInput,
    maxResearchSpendMinor: spend.maxSpendMinor,
    currency,
    populationUncertainty: options.populationUncertainty,
    nicheScarcity: options.nicheScarcity,
    historicalMutationProductivity: options.historicalMutationProductivity,
    computeCostMinor: options.computeCostMinor,
    grantsInvestmentCapital: false,
    reasonCodes: [...assessment.reasonCodes],
  });
}
