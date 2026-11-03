import { createHash, randomUUID } from 'node:crypto';

import { err, ok, type Result } from '@solstice/domain';
import type { UtcInstant } from '@solstice/domain';
import { DEFAULT_PARAMETER_SET } from '../fixtures.ts';
import { overfittingWarnings } from '../overfitting.ts';
import { countStrategyParameters } from '../dsl.ts';
import { materializeStrategyCapsuleCandidate } from '../os05/materialize.ts';
import { validateStrategyGenome } from '../os05/validate.ts';
import type { StrategyGenomeFailure } from '../os05/types.ts';
import { runWalkForward } from '../walk-forward.ts';
import type { MarketDataset } from '../dataset.ts';
import type { StrategyFailure } from '../types.ts';
import { StrategyLab } from '../service.ts';

type SerisPipelineRiskBudget = Parameters<StrategyLab['compile']>[2];
import { summarizeBacktestRun } from './backtest-orchestrator.ts';
import type { SerisAiStrategyProposal } from './proposal.ts';
import { SerisStrategyRunStore } from './run-store.ts';
import type { SerisNative12PipelineStage } from './taxonomy.ts';
import { SERIS_NATIVE12_PIPELINE_STAGES } from './taxonomy.ts';
import type { SerisBacktestRunSummary } from './backtest-orchestrator.ts';

export type SerisFeatureCatalogPort = {
  readonly hasCatalogFeature: (catalogRef: string) => boolean;
  readonly hasDataFeature: (featureId: string) => boolean;
};

export type SerisNative12PipelineOutcome = {
  readonly runId: string;
  readonly proposalId: string;
  readonly stageReached: SerisNative12PipelineStage;
  readonly stagesCompleted: readonly SerisNative12PipelineStage[];
  readonly genomeHash: string;
  readonly capsuleCandidateFingerprint: string | null;
  readonly validationReportId: string | null;
  readonly backtestSummaries: readonly SerisBacktestRunSummary[];
  readonly shadowRunId: string | null;
  readonly paperRunId: string | null;
  readonly deployed: false;
  readonly humanPromotionRequired: true;
  readonly liveExecutionPermitted: false;
};

function stageIndex(stage: SerisNative12PipelineStage): number {
  return SERIS_NATIVE12_PIPELINE_STAGES.indexOf(stage);
}

function completedThrough(stage: SerisNative12PipelineStage): readonly SerisNative12PipelineStage[] {
  const idx = stageIndex(stage);
  return Object.freeze(SERIS_NATIVE12_PIPELINE_STAGES.slice(0, idx + 1));
}

function mapGenomeFailure(failure: StrategyGenomeFailure): StrategyFailure {
  return Object.freeze({
    code: 'PROMOTION_GATE_FAILED',
    message: `${failure.code}: ${failure.message}`,
  });
}

function validateFeatureAvailability(
  proposal: SerisAiStrategyProposal,
  catalog: SerisFeatureCatalogPort,
): Result<true, StrategyFailure> {
  for (const node of proposal.genome.nodes) {
    if (node.kind === 'FEATURE') {
      if (!catalog.hasCatalogFeature(node.catalogRef)) {
        return err({
          code: 'PROMOTION_GATE_FAILED',
          message: `unknown feature catalogRef ${node.catalogRef}`,
        });
      }
      if (!catalog.hasDataFeature(node.outputRef)) {
        return err({
          code: 'PROMOTION_GATE_FAILED',
          message: `feature data unavailable for ${node.outputRef}`,
        });
      }
    }
  }
  for (const featureId of proposal.specificationDraft.requiredData) {
    if (!catalog.hasDataFeature(featureId)) {
      return err({
        code: 'PROMOTION_GATE_FAILED',
        message: `specification requires unavailable feature ${featureId}`,
      });
    }
  }
  return ok(true);
}

export class SerisNativeStrategyPipeline {
  readonly runStore: SerisStrategyRunStore;
  private readonly lab: StrategyLab;

  constructor(lab: StrategyLab, runStore?: SerisStrategyRunStore) {
    this.lab = lab;
    this.runStore = runStore ?? new SerisStrategyRunStore();
  }

  processProposal(input: {
    readonly proposal: SerisAiStrategyProposal;
    readonly dataset: MarketDataset;
    readonly riskBudget: SerisPipelineRiskBudget;
    readonly subjectId: string;
    readonly startingCapitalMinor: bigint;
    readonly sealedAt: UtcInstant;
    readonly featureCatalog: SerisFeatureCatalogPort;
    /** Human governance actor for shadow/paper simulation gates (StrategyLab validates at promote time). */
    readonly governanceActor?: unknown;
    readonly investmentAccountId?: string;
    readonly maxDrawdownBps?: number;
  }): Result<SerisNative12PipelineOutcome, StrategyFailure> {
    const runId = `sn12run_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const stages: SerisNative12PipelineStage[] = ['AI_PROPOSAL'];

    if (input.proposal.deployRequested) {
      return err({ code: 'PROMOTION_GATE_FAILED', message: 'deploy is forbidden for AI proposals' });
    }

    const genomeValidated = validateStrategyGenome(input.proposal.genome);
    if (!genomeValidated.ok) {
      return err(mapGenomeFailure(genomeValidated.error));
    }
    stages.push('GENOME_VALIDATION');

    const features = validateFeatureAvailability(input.proposal, input.featureCatalog);
    if (!features.ok) {
      return features;
    }
    stages.push('FEATURE_VALIDITY');

    const capsule = materializeStrategyCapsuleCandidate(genomeValidated.value);
    if (!capsule.ok) {
      return err(mapGenomeFailure(capsule.error));
    }

    this.lab.store.putDataset(input.dataset);
    const draft = this.lab.createDraft({ specification: input.proposal.specificationDraft });
    if (!draft.ok) {
      return draft;
    }
    const compiled = this.lab.compile(draft.value.strategyId, draft.value.version, input.riskBudget);
    if (!compiled.ok) {
      return compiled;
    }

    const { train, validation, holdout } = input.proposal.evaluationPlan;
    const parameterSet = DEFAULT_PARAMETER_SET;
    const summaries: SerisBacktestRunSummary[] = [];

    const trainRun = this.lab.backtest({
      strategyId: draft.value.strategyId,
      version: draft.value.version,
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version,
      parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: { start: train.start, end: train.end },
      partition: 'TRAIN',
    });
    if (!trainRun.ok) {
      return trainRun;
    }
    stages.push('HISTORICAL_TEST');
    summaries.push(
      summarizeBacktestRun({
        run: trainRun.value,
        strategyName: input.proposal.sourceReview.strategyName,
        symbol: input.proposal.marketContext.symbol,
        endedAt: input.sealedAt,
      }),
    );

    const validationRun = this.lab.backtest({
      strategyId: draft.value.strategyId,
      version: draft.value.version,
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version,
      parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: { start: validation.start, end: validation.end },
      partition: 'VALIDATION',
    });
    if (!validationRun.ok) {
      return validationRun;
    }

    const holdoutRun = this.lab.backtest({
      strategyId: draft.value.strategyId,
      version: draft.value.version,
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version,
      parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: { start: holdout.start, end: holdout.end },
      partition: 'OUT_OF_SAMPLE_TEST',
    });
    if (!holdoutRun.ok) {
      return holdoutRun;
    }
    stages.push('HOLDOUT');
    summaries.push(
      summarizeBacktestRun({
        run: holdoutRun.value,
        strategyName: input.proposal.sourceReview.strategyName,
        symbol: input.proposal.marketContext.symbol,
        endedAt: input.sealedAt,
      }),
    );

    const wfPlan = input.proposal.evaluationPlan.walkForward;
    const walkForward = runWalkForward({
      specification: this.lab.store.getSpecification(draft.value.strategyId, draft.value.version)!,
      plan: compiled.value,
      dataset: input.dataset,
      parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      trainDays: wfPlan.trainDays,
      testDays: wfPlan.testDays,
      generatedAt: input.sealedAt,
    });
    if (!walkForward.ok) {
      return walkForward;
    }
    stages.push('WALK_FORWARD');

    const spec = this.lab.store.getSpecification(draft.value.strategyId, draft.value.version);
    if (!spec) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'specification missing after compile' });
    }
    const parameterCount = countStrategyParameters(spec.entryConditions);
    const warnings = overfittingWarnings({
      parameterCount,
      observationCount: input.dataset.observations.length,
      train: trainRun.value,
      outOfSample: holdoutRun.value,
      turnoverBps: holdoutRun.value.results.turnoverBps,
    });

    const validationReport = this.lab.validate({
      strategyId: draft.value.strategyId,
      version: draft.value.version,
      train: trainRun.value,
      validation: validationRun.value,
      outOfSample: holdoutRun.value,
      walkForward: walkForward.value,
    });
    if (!validationReport.ok) {
      return validationReport;
    }

    const maxDd = Number(holdoutRun.value.results.maximumDrawdown.units / 10_000n);
    const drawdownOk = maxDd <= (input.maxDrawdownBps ?? 2_500);
    const stabilityOk = !warnings.some((row) => row.kind === 'LARGE_TRAIN_TEST_GAP');
    const shadowEligible = drawdownOk && walkForward.value.folds.length > 0 && stabilityOk;

    let shadowRunId: string | null = null;
    let paperRunId: string | null = null;
    let stageReached: SerisNative12PipelineStage = 'WALK_FORWARD';

    if (shadowEligible && input.governanceActor) {
      const shadowApproved = this.lab.approveShadow(
        input.governanceActor,
        draft.value.strategyId,
        draft.value.version,
        'NATIVE12 research pipeline shadow gate',
      );
      if (shadowApproved.ok) {
        const shadow = this.lab.startShadow(
          draft.value.strategyId,
          draft.value.version,
          input.dataset.datasetId,
          input.dataset.version,
        );
        if (shadow.ok) {
          shadowRunId = shadow.value.runId;
          stages.push('SHADOW');
          stageReached = 'SHADOW';
          this.lab.completeShadow(draft.value.strategyId, draft.value.version);

          if (input.investmentAccountId) {
            const paperApproved = this.lab.approvePaper(
              input.governanceActor,
              draft.value.strategyId,
              draft.value.version,
              'NATIVE12 research pipeline paper gate',
            );
            if (paperApproved.ok) {
              const paper = this.lab.startPaper({
                strategyId: draft.value.strategyId,
                version: draft.value.version,
                investmentAccountId: input.investmentAccountId,
              });
              if (paper.ok) {
                paperRunId = paper.value.runId;
                stages.push('PAPER');
                stageReached = 'PAPER';
              }
            }
          }
        }
      }
    }

    const outcome: SerisNative12PipelineOutcome = Object.freeze({
      runId,
      proposalId: input.proposal.proposalId,
      stageReached,
      stagesCompleted: completedThrough(stageReached),
      genomeHash: genomeValidated.value.lineage.genomeHash,
      capsuleCandidateFingerprint: capsule.value.materialHash,
      validationReportId: validationReport.value.validationId,
      backtestSummaries: Object.freeze([...summaries]),
      shadowRunId,
      paperRunId,
      deployed: false,
      humanPromotionRequired: true,
      liveExecutionPermitted: false,
    });

    this.runStore.putRun(
      Object.freeze({
        runId,
        proposalId: input.proposal.proposalId,
        strategyId: draft.value.strategyId,
        strategyVersion: draft.value.version,
        stageReached,
        stagesCompleted: outcome.stagesCompleted,
        ok: true,
        summary: `Seris native12 pipeline reached ${stageReached}`,
        metricsHash: summaries.at(-1)?.metricsHash ?? null,
        marketSymbol: input.proposal.marketContext.symbol,
        startedAt: input.proposal.proposedAt,
        endedAt: input.sealedAt,
        shadowRunId,
        paperRunId,
        liveExecutionAttempted: false,
      }),
    );

    return ok(outcome);
  }
}

export function serisPipelineRunFingerprint(outcome: SerisNative12PipelineOutcome): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        proposalId: outcome.proposalId,
        stageReached: outcome.stageReached,
        genomeHash: outcome.genomeHash,
        metricsHash: outcome.backtestSummaries.map((row) => row.metricsHash),
      }),
    )
    .digest('hex');
}
