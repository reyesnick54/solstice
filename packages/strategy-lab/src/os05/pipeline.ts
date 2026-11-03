import { err, ok, type Result } from '@solstice/domain';
import { LIVE_STRATEGY_EXECUTION } from '../types.ts';
import { materializeStrategyCapsuleCandidate, type StrategyGenomeCapsuleCandidate } from './materialize.ts';
import type { StrategyGenome, StrategyGenomeFailure } from './types.ts';
import { validateStrategyGenome } from './validate.ts';

export const GENOME_COMPILER_STAGES = Object.freeze([
  'VALIDATE',
  'MATERIALIZE_CAPSULE_CANDIDATE',
  'STRATEGY_LAB_EVALUATION',
  'SHADOW',
  'PAPER',
] as const);

export type GenomeCompilerStage = (typeof GENOME_COMPILER_STAGES)[number];

export const GENOME_COMPILER_FORBIDDEN_STAGES = Object.freeze(['LIVE_EXECUTION'] as const);

export type GenomeCompilerForbiddenStage = (typeof GENOME_COMPILER_FORBIDDEN_STAGES)[number];

export type StrategyGenomeCompilerPlan = {
  readonly genomeId: StrategyGenome['genomeId'];
  readonly genomeVersion: StrategyGenome['version'];
  readonly genomeHash: string;
  readonly stages: readonly GenomeCompilerStage[];
  readonly forbiddenStages: readonly GenomeCompilerForbiddenStage[];
  readonly liveExecutionPermitted: false;
  readonly capsuleCandidate: StrategyGenomeCapsuleCandidate | null;
};

export type GenomeCompilerTargetStage = GenomeCompilerStage | GenomeCompilerForbiddenStage;

export function compileStrategyGenome(
  genome: StrategyGenome,
  targetStage: GenomeCompilerTargetStage = 'MATERIALIZE_CAPSULE_CANDIDATE',
): Result<StrategyGenomeCompilerPlan, StrategyGenomeFailure> {
  if ((GENOME_COMPILER_FORBIDDEN_STAGES as readonly string[]).includes(targetStage)) {
    return err({
      code: 'LIVE_EXECUTION_FORBIDDEN',
      message: 'StrategyGenome must never compile to live execution',
    });
  }
  if (LIVE_STRATEGY_EXECUTION) {
    return err({
      code: 'LIVE_EXECUTION_FORBIDDEN',
      message: 'LIVE_STRATEGY_EXECUTION flag is false; genome compiler is simulation-only',
    });
  }

  const validated = validateStrategyGenome(genome);
  if (!validated.ok) {
    return validated;
  }

  let capsuleCandidate: StrategyGenomeCapsuleCandidate | null = null;
  if (
    targetStage === 'MATERIALIZE_CAPSULE_CANDIDATE' ||
    targetStage === 'STRATEGY_LAB_EVALUATION' ||
    targetStage === 'SHADOW' ||
    targetStage === 'PAPER'
  ) {
    const materialized = materializeStrategyCapsuleCandidate(validated.value);
    if (!materialized.ok) {
      return materialized;
    }
    capsuleCandidate = materialized.value;
  }

  const stageIndex = GENOME_COMPILER_STAGES.indexOf(targetStage as GenomeCompilerStage);
  const stages =
    stageIndex >= 0
      ? Object.freeze(GENOME_COMPILER_STAGES.slice(0, stageIndex + 1))
      : Object.freeze(['VALIDATE'] as const);

  return ok(
    Object.freeze({
      genomeId: validated.value.genomeId,
      genomeVersion: validated.value.version,
      genomeHash: validated.value.lineage.genomeHash,
      stages,
      forbiddenStages: GENOME_COMPILER_FORBIDDEN_STAGES,
      liveExecutionPermitted: false,
      capsuleCandidate,
    }),
  );
}
