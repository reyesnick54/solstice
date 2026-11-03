import { err, ok, type Result } from '@solstice/domain';
import { LIVE_STRATEGY_EXECUTION } from '../types.ts';
import { materializeNative06CapsuleCandidate, type Native06StrategyCapsuleCandidate } from './materialize.ts';
import type { Native06GenomeFailure, Native06StrategyGenome } from './types.ts';
import { validateNative06StrategyGenome } from './validate.ts';

export const NATIVE06_COMPILER_STAGES = Object.freeze([
  'VALIDATE',
  'MATERIALIZE_CAPSULE_CANDIDATE',
  'HISTORICAL',
  'HOLDOUT',
  'WALK_FORWARD',
  'SHADOW',
  'PAPER',
] as const);

export type Native06CompilerStage = (typeof NATIVE06_COMPILER_STAGES)[number];

export const NATIVE06_COMPILER_FORBIDDEN_STAGES = Object.freeze(['LIVE_EXECUTION'] as const);

export type Native06CompilerForbiddenStage = (typeof NATIVE06_COMPILER_FORBIDDEN_STAGES)[number];

export type Native06StrategyCompilerPlan = {
  readonly genomeId: Native06StrategyGenome['genomeId'];
  readonly genomeVersion: Native06StrategyGenome['version'];
  readonly genomeHash: string;
  readonly stages: readonly Native06CompilerStage[];
  readonly forbiddenStages: readonly Native06CompilerForbiddenStage[];
  readonly liveExecutionPermitted: false;
  readonly capsuleCandidate: Native06StrategyCapsuleCandidate | null;
  readonly qualificationStagesPassed: readonly Native06CompilerStage[];
};

export type Native06CompilerTargetStage = Native06CompilerStage | Native06CompilerForbiddenStage;

export function compileNative06StrategyGenome(
  genome: Native06StrategyGenome,
  targetStage: Native06CompilerTargetStage = 'MATERIALIZE_CAPSULE_CANDIDATE',
): Result<Native06StrategyCompilerPlan, Native06GenomeFailure> {
  if ((NATIVE06_COMPILER_FORBIDDEN_STAGES as readonly string[]).includes(targetStage)) {
    return err({
      code: 'LIVE_EXECUTION_FORBIDDEN',
      message: 'Native06 StrategyGenome must never compile to live execution',
    });
  }
  if (LIVE_STRATEGY_EXECUTION) {
    return err({
      code: 'LIVE_EXECUTION_FORBIDDEN',
      message: 'LIVE_STRATEGY_EXECUTION flag is false; genome compiler is simulation-only',
    });
  }

  const validated = validateNative06StrategyGenome(genome);
  if (!validated.ok) {
    return validated;
  }

  let capsuleCandidate: Native06StrategyCapsuleCandidate | null = null;
  if (
    targetStage === 'MATERIALIZE_CAPSULE_CANDIDATE' ||
    targetStage === 'HISTORICAL' ||
    targetStage === 'HOLDOUT' ||
    targetStage === 'WALK_FORWARD' ||
    targetStage === 'SHADOW' ||
    targetStage === 'PAPER'
  ) {
    const materialized = materializeNative06CapsuleCandidate(validated.value);
    if (!materialized.ok) {
      return materialized;
    }
    capsuleCandidate = materialized.value;
  }

  const stageIndex = NATIVE06_COMPILER_STAGES.indexOf(targetStage as Native06CompilerStage);
  const stages =
    stageIndex >= 0
      ? Object.freeze(NATIVE06_COMPILER_STAGES.slice(0, stageIndex + 1))
      : Object.freeze(['VALIDATE'] as const);

  return ok(
    Object.freeze({
      genomeId: validated.value.genomeId,
      genomeVersion: validated.value.version,
      genomeHash: validated.value.lineage.genomeHash,
      stages,
      forbiddenStages: NATIVE06_COMPILER_FORBIDDEN_STAGES,
      liveExecutionPermitted: false,
      capsuleCandidate,
      qualificationStagesPassed: stages,
    }),
  );
}
