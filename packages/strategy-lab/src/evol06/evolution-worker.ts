import { brandAs, type Brand } from '@solstice/domain';

import { attachGenomeHash } from '../os05/hash.ts';
import { STRATEGY_GENOME_SCHEMA, asStrategyGenomeVersion } from '../os05/ids.ts';
import type { StrategyGenome, StrategyGenomeLineage } from '../os05/types.ts';
import type {
  CreateEvolutionWorkerInput,
  EvaluationPhase,
  EvolutionWorkerState,
  FitnessObservation,
  FitnessUncertainty,
} from './types.ts';

export type WorkerId = Brand<string, 'Evol06WorkerId'>;

export function asEvol06WorkerId(value: string): WorkerId {
  if (!value.startsWith('evw_')) {
    throw new TypeError('Evol06 workerId must start with evw_');
  }
  return brandAs<string, 'Evol06WorkerId'>(value);
}

function parseMinor(s: string): bigint {
  return BigInt(s);
}

function formatMinor(n: bigint): string {
  return n.toString();
}

function emptyUncertainty(): FitnessUncertainty {
  return Object.freeze({
    meanFitness: 0,
    confidenceHalfWidth: Number.POSITIVE_INFINITY,
    sampleCount: 0,
  });
}

/** Update mean and approximate 95% CI half-width using Welford variance. */
export function recomputeUncertaintyFromTrajectory(
  trajectory: readonly FitnessObservation[],
): FitnessUncertainty {
  if (trajectory.length === 0) {
    return emptyUncertainty();
  }
  let mean = 0;
  let m2 = 0;
  for (let i = 0; i < trajectory.length; i += 1) {
    const obs = trajectory[i]!;
    const x = obs.fitness;
    const n = i + 1;
    const delta = x - mean;
    mean += delta / n;
    const delta2 = x - mean;
    m2 += delta * delta2;
  }
  const n = trajectory.length;
  const variance = n > 1 ? m2 / (n - 1) : 0;
  const std = Math.sqrt(Math.max(variance, 0));
  const z = 1.96;
  const halfWidth = n >= 2 ? (z * std) / Math.sqrt(n) : std > 0 ? z * std : 1;

  return Object.freeze({
    meanFitness: mean,
    confidenceHalfWidth: halfWidth,
    sampleCount: n,
  });
}

/**
 * Bootstrap a new research evolution worker with zero fitness history (unknown uncertainty).
 */
export function createEvolutionWorker(input: CreateEvolutionWorkerInput): EvolutionWorkerState {
  const baseLineage: Omit<StrategyGenomeLineage, 'genomeHash'> = {
    parentGenomeIds: Object.freeze(input.parentGenomeIds ?? []),
    mutationReason: input.genomeMutationReason,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    featureManifestVersion: input.featureManifestVersion,
    nodeCatalogVersion: input.nodeCatalogVersion,
  };

  const genome: StrategyGenome = attachGenomeHash({
    schema: STRATEGY_GENOME_SCHEMA,
    genomeId: input.genomeId,
    version: input.genomeVersion,
    name: input.name,
    hypothesis: input.hypothesis,
    nodes: input.nodes,
    parameters: input.parameters,
    lineage: baseLineage,
  });

  const worker: EvolutionWorkerState = {
    workerId: input.workerId,
    currentGenome: genome,
    niche: input.niche,
    evaluationPhase: 'PENDING',
    researchBudgetSpentMinor: '0',
    evaluationAge: 0,
    fitnessTrajectory: Object.freeze([]),
    uncertainty: emptyUncertainty(),
    lineage: Object.freeze({
      workerId: input.workerId,
      island: input.niche.island,
      parentWorkerIds: Object.freeze([]),
      generation: 0,
      createdAt: input.createdAt,
    }),
    migrationGeneration: 0,
  };

  return Object.freeze(worker);
}

export function recordFitnessObservation(
  worker: EvolutionWorkerState,
  observation: Omit<FitnessObservation, 'step'>,
): EvolutionWorkerState {
  const step = worker.evaluationAge + 1;
  const nextTrajectory = [
    ...worker.fitnessTrajectory,
    Object.freeze({ ...observation, step }),
  ];
  const uncertainty = recomputeUncertaintyFromTrajectory(nextTrajectory);

  return Object.freeze({
    ...worker,
    fitnessTrajectory: Object.freeze(nextTrajectory),
    evaluationAge: step,
    uncertainty,
    evaluationPhase: 'EVALUATING',
  });
}

export function markEvaluationComplete(worker: EvolutionWorkerState): EvolutionWorkerState {
  return Object.freeze({
    ...worker,
    evaluationPhase: 'COMPLETE',
  });
}

export function incrementResearchSpend(
  worker: EvolutionWorkerState,
  deltaMinor: string,
): EvolutionWorkerState {
  const next = parseMinor(worker.researchBudgetSpentMinor) + parseMinor(deltaMinor);
  return Object.freeze({
    ...worker,
    researchBudgetSpentMinor: formatMinor(next),
  });
}

export function withNewGenome(
  worker: EvolutionWorkerState,
  genome: StrategyGenome,
  opts: {
    readonly parentWorkerIds: readonly string[];
    readonly generationDelta: number;
    readonly mutationReason: string;
    readonly migrationGenerationDelta?: number;
  },
): EvolutionWorkerState {
  return Object.freeze({
    ...worker,
    currentGenome: genome,
    fitnessTrajectory: Object.freeze([]),
    evaluationAge: 0,
    uncertainty: emptyUncertainty(),
    evaluationPhase: 'PENDING',
    lineage: Object.freeze({
      ...worker.lineage,
      parentWorkerIds: Object.freeze(opts.parentWorkerIds),
      generation: worker.lineage.generation + opts.generationDelta,
      createdAt: worker.lineage.createdAt,
    }),
    migrationGeneration:
      worker.migrationGeneration + (opts.migrationGenerationDelta ?? 0),
  });
}

export function nextGenomeVersion(version: StrategyGenome['version']): StrategyGenome['version'] {
  const raw = String(version);
  const match = raw.match(/^(.+)\.ev(\d+)$/);
  if (match) {
    const n = Number(match[2]) + 1;
    return asStrategyGenomeVersion(`${match[1]}.ev${n}`);
  }
  return asStrategyGenomeVersion(`${raw}.ev2`);
}
