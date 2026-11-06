/**
 * HELIOS EVOL14 — Strategy Genome self-evolution V1 qualification (marker only).
 */

import { LIVE_TRADING_ENABLED } from '@solstice/config';

import {
  HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED,
  HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED,
} from './taxonomy.ts';
import { runStrategyEvolutionSimulation } from './simulation.ts';

export { HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED, HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED } from './taxonomy.ts';

export type EvolutionQualificationBlocker =
  | 'LIVE_TRADING_ENABLED_NOT_FALSE'
  | 'OVERFIT_NOT_REJECTED'
  | 'MODERATE_NOT_PREFERRED'
  | 'TRIAL_LEDGER_INCOMPLETE';

export type EvolutionQualificationResult = {
  readonly qualified: boolean;
  readonly marker: typeof HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED | typeof HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED;
  readonly blockers: readonly EvolutionQualificationBlocker[];
  readonly simulation: ReturnType<typeof runStrategyEvolutionSimulation>;
};

export function evaluateStrategyGenomeSelfEvolutionQualification(input: {
  readonly evaluatedAt: import('@solstice/domain').UtcInstant;
  readonly gitSha: string;
}): EvolutionQualificationResult {
  const simulation = runStrategyEvolutionSimulation({
    evaluatedAt: input.evaluatedAt,
    gitSha: input.gitSha,
  });
  const blockers: EvolutionQualificationBlocker[] = [];

  if (LIVE_TRADING_ENABLED !== false) {
    blockers.push('LIVE_TRADING_ENABLED_NOT_FALSE');
  }
  if (!simulation.overfitCandidateRejected) {
    blockers.push('OVERFIT_NOT_REJECTED');
  }
  if (!simulation.moderateCandidatePreferred) {
    blockers.push('MODERATE_NOT_PREFERRED');
  }
  const expectedPhases: import('./types.ts').EvolutionPhase[] = [
    'SEED',
    'POPULATION_INIT',
    'POPULATION_SCHEDULING',
    'VALIDATION_REJECT',
    'AAF_PIT_DATASET',
    'INNER_TRAIN_VAL',
    'MUTATION_CROSSOVER',
    'CMA_ES',
    'MAP_ELITES_UPDATE',
    'NOVELTY',
    'FALSIFICATION',
    'FREEZE',
    'HOLDOUT_OPEN',
    'DSR_PBO',
    'CHALLENGER_SELECT',
    'FORWARD_SHADOW',
    'EXECUTION_TWIN_PAPER',
    'CHAMPION_COMPARE',
    'RESEARCH_PROMOTION',
    'EVIDENCE_SEAL',
  ];
  const phasesSeen = new Set(simulation.trials.map((t) => t.phase));
  if (!expectedPhases.every((p) => phasesSeen.has(p))) {
    blockers.push('TRIAL_LEDGER_INCOMPLETE');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified ? HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED : HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED,
    blockers: Object.freeze(blockers),
    simulation,
  });
}
