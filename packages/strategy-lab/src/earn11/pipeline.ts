import { err, ok, type Result } from '@solstice/domain';

import { LIVE_STRATEGY_EXECUTION } from '../types.ts';
import type { StrategyGenomeCapsuleCandidate } from '../os05/materialize.ts';
import { GENOME_COMPILER_FORBIDDEN_STAGES, type GenomeCompilerStage } from '../os05/pipeline.ts';
import { materializeEarn11CapsuleCandidate } from './materialize.ts';
import type { StrategyGenome, StrategyGenomeFailure } from '../os05/types.ts';
import { gateEarn11ResearchArtifacts, type Earn11ResearchArtifactBundle } from './research-requirements.ts';
import { validateEarn11StrategyGenome } from './validate.ts';

export const EARN11_GENOME_COMPILER_STAGES = Object.freeze([
  'VALIDATE',
  'AAF_V2_CERTIFY',
  'MATERIALIZE_CAPSULE_CANDIDATE',
  'STRATEGY_LAB_EVALUATION',
  'HOLDOUT',
  'WALK_FORWARD',
  'SHADOW',
  'PAPER',
] as const);

export type Earn11GenomeCompilerStage = (typeof EARN11_GENOME_COMPILER_STAGES)[number];

export type Earn11StrategyGenomeCompilerPlan = {
  readonly genomeId: StrategyGenome['genomeId'];
  readonly genomeVersion: StrategyGenome['version'];
  readonly genomeHash: string;
  readonly stages: readonly Earn11GenomeCompilerStage[];
  readonly forbiddenStages: readonly (typeof GENOME_COMPILER_FORBIDDEN_STAGES)[number][];
  readonly liveExecutionPermitted: false;
  readonly capsuleCandidate: StrategyGenomeCapsuleCandidate | null;
  readonly researchArtifactsComplete: boolean;
  readonly artifactBlockers: readonly string[];
};

export type Earn11CompilerTargetStage = Earn11GenomeCompilerStage | 'LIVE_EXECUTION';

export function compileEarn11StrategyGenome(
  genome: StrategyGenome,
  artifacts: Earn11ResearchArtifactBundle | null,
  targetStage: Earn11CompilerTargetStage = 'MATERIALIZE_CAPSULE_CANDIDATE',
): Result<Earn11StrategyGenomeCompilerPlan, StrategyGenomeFailure> {
  if (targetStage === 'LIVE_EXECUTION' || (GENOME_COMPILER_FORBIDDEN_STAGES as readonly string[]).includes(targetStage)) {
    return err({
      code: 'LIVE_EXECUTION_FORBIDDEN',
      message: 'EARN11 StrategyGenome must never compile to live execution',
    });
  }
  if (LIVE_STRATEGY_EXECUTION) {
    return err({
      code: 'LIVE_EXECUTION_FORBIDDEN',
      message: 'LIVE_STRATEGY_EXECUTION flag is false; EARN11 compiler is simulation-only',
    });
  }

  const validated = validateEarn11StrategyGenome(genome);
  if (!validated.ok) {
    return validated;
  }

  const artifactGate = gateEarn11ResearchArtifacts(artifacts);
  const needsArtifacts =
    targetStage === 'AAF_V2_CERTIFY' ||
    targetStage === 'HOLDOUT' ||
    targetStage === 'WALK_FORWARD' ||
    targetStage === 'SHADOW' ||
    targetStage === 'PAPER' ||
    targetStage === 'STRATEGY_LAB_EVALUATION';

  if (needsArtifacts && !artifactGate.complete) {
    return err({
      code: 'MISSING_REQUIRED_NODE',
      message: `EARN11 research artifacts incomplete: ${artifactGate.blockers.join('; ')}`,
    });
  }

  let capsuleCandidate: StrategyGenomeCapsuleCandidate | null = null;
  if (
    targetStage === 'MATERIALIZE_CAPSULE_CANDIDATE' ||
    targetStage === 'STRATEGY_LAB_EVALUATION' ||
    targetStage === 'HOLDOUT' ||
    targetStage === 'WALK_FORWARD' ||
    targetStage === 'SHADOW' ||
    targetStage === 'PAPER'
  ) {
    const materialized = materializeEarn11CapsuleCandidate(validated.value);
    if (!materialized.ok) {
      return materialized;
    }
    capsuleCandidate = materialized.value;
  }

  const stageIndex = EARN11_GENOME_COMPILER_STAGES.indexOf(targetStage as Earn11GenomeCompilerStage);
  const stages =
    stageIndex >= 0
      ? Object.freeze(EARN11_GENOME_COMPILER_STAGES.slice(0, stageIndex + 1))
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
      researchArtifactsComplete: artifactGate.complete,
      artifactBlockers: artifactGate.blockers,
    }),
  );
}

/** Map OS05 compiler stage names used by shared materialization tests. */
export function earn11StageIncludesOs05(stage: Earn11GenomeCompilerStage): readonly GenomeCompilerStage[] {
  const os05: GenomeCompilerStage[] = [];
  if (stage !== 'VALIDATE' && stage !== 'AAF_V2_CERTIFY') {
    os05.push('VALIDATE', 'MATERIALIZE_CAPSULE_CANDIDATE');
  }
  if (
    stage === 'STRATEGY_LAB_EVALUATION' ||
    stage === 'HOLDOUT' ||
    stage === 'WALK_FORWARD' ||
    stage === 'SHADOW' ||
    stage === 'PAPER'
  ) {
    os05.push('STRATEGY_LAB_EVALUATION', 'SHADOW', 'PAPER');
  }
  return Object.freeze(os05);
}
