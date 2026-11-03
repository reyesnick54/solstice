import { err, ok, type Result, type UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import type { RiskBudget } from '@solstice/risk';
import {
  buildValidationReport,
  countStrategyParameters,
  DEFAULT_PARAMETER_SET,
  expandParameterGrid,
  freezePromotionCapsule,
  overfittingWarnings,
  runWalkForward,
  type BacktestRun,
  type MarketDataset,
  type ParameterSet,
  type StrategyFailure,
  type StrategyLab,
} from '@solstice/strategy-lab';
import {
  buildStrategyProposalEvidence,
  sealStrategyProposalEvidence,
  type SandboxEvaluationMetrics,
  type StrategyProposalEvidenceRecord,
} from './strategy-proposal-evidence.ts';
import type { StrategyProposal } from './strategy-proposal.ts';
import {
  StrategyProposalValidator,
  type StrategyFeatureCatalog,
} from './strategy-proposal-validator.ts';
import { DEFAULT_STRATEGY_SAFETY_POLICY } from './strategy-safety-policy.ts';
import type { SandboxPipelineStage } from './taxonomy.ts';

export type StrategySandboxOutcome = {
  readonly proposalId: string;
  readonly stageReached: SandboxPipelineStage;
  readonly capsuleCandidateFingerprint: string | null;
  readonly validationReportId: string | null;
  readonly metrics: SandboxEvaluationMetrics | null;
  readonly forwardShadowRecommended: boolean;
  readonly paperRecommended: boolean;
  readonly deployed: false;
  readonly humanPromotionRequired: true;
  readonly evidence: StrategyProposalEvidenceRecord;
  readonly selectionReason: string;
};

function selectParameterSetConservatively(
  runs: readonly { readonly parameterSet: ParameterSet; readonly run: BacktestRun }[],
  maxDrawdownBps: number,
): { readonly selected: ParameterSet; readonly reason: string } | null {
  const eligible = runs.filter((trial) => {
    const dd = Number(trial.run.results.maximumDrawdown.units / 10_000n);
    return dd <= maxDrawdownBps;
  });
  if (eligible.length === 0) {
    return null;
  }
  const sorted = [...eligible].sort((left, right) => {
    const leftScore =
      Number(left.run.results.totalReturn.units) -
      Number(left.run.results.maximumDrawdown.units) -
      Number(left.run.results.feesMinor);
    const rightScore =
      Number(right.run.results.totalReturn.units) -
      Number(right.run.results.maximumDrawdown.units) -
      Number(right.run.results.feesMinor);
    return rightScore - leftScore;
  });
  const median = sorted[Math.floor(sorted.length / 2)];
  if (!median) {
    return null;
  }
  return Object.freeze({
    selected: median.parameterSet,
    reason: 'selected median risk-adjusted train candidate among drawdown-eligible sweeps; not maximum backtest return',
  });
}

function buildMetrics(input: {
  readonly train: BacktestRun;
  readonly holdout: BacktestRun;
  readonly walkForwardFoldCount: number;
  readonly proposal: StrategyProposal;
}): SandboxEvaluationMetrics {
  const turnoverMinor = input.holdout.results.feesMinor + input.train.results.feesMinor;
  const maxDrawdownBps = Number(input.holdout.results.maximumDrawdown.units / 10_000n);
  const trainReturn = input.train.results.totalReturn.units;
  const holdoutReturn = input.holdout.results.totalReturn.units;
  const gap = trainReturn - holdoutReturn;
  const stabilityScore = Math.max(0, 100 - Math.min(100, Number(gap / 1_000_000n)));
  return Object.freeze({
    coverageReportPresent: input.proposal.genome.coverageReportRequired,
    regimeBreakdownPresent: input.proposal.genome.regimeBreakdownRequired,
    turnoverMinor,
    maxDrawdownBps,
    stabilityScore,
    holdoutReturnUnits: holdoutReturn,
    trainReturnUnits: trainReturn,
    walkForwardFoldCount: input.walkForwardFoldCount,
    explicitCostsApplied: input.holdout.transactionCosts.mode === 'EXPLICIT_COSTS',
    slippageNamed: input.holdout.transactionCosts.slippageMinor >= 0n,
    promoteOnReturnOnly: false,
  });
}

export class StrategySandbox {
  private readonly lab: StrategyLab;
  private readonly vault: EvidenceVault | undefined;
  private readonly catalog: StrategyFeatureCatalog;
  private readonly validator: StrategyProposalValidator;

  constructor(lab: StrategyLab, vault: EvidenceVault | undefined, catalog: StrategyFeatureCatalog) {
    this.lab = lab;
    this.vault = vault;
    this.catalog = catalog;
    this.validator = new StrategyProposalValidator(DEFAULT_STRATEGY_SAFETY_POLICY);
  }

  processProposal(input: {
    readonly proposal: StrategyProposal;
    readonly dataset: MarketDataset;
    readonly riskBudget: RiskBudget;
    readonly subjectId: string;
    readonly startingCapitalMinor: bigint;
    readonly sealedAt: UtcInstant;
    readonly maxDrawdownBps?: number;
  }): Result<StrategySandboxOutcome, StrategyFailure> {
    if (input.proposal.deployRequested) {
      return err({ code: 'PROMOTION_GATE_FAILED', message: 'AI proposals may not request deployment' });
    }

    const validation = this.validator.validate(input.proposal, this.catalog);
    if (!validation.ok) {
      const evidence = buildStrategyProposalEvidence({
        proposal: input.proposal,
        validation: {
          passed: false,
          stages: Object.freeze([]),
          specificationReady: false,
        },
        sealedAt: input.sealedAt,
      });
      sealStrategyProposalEvidence(this.vault, evidence);
      return validation;
    }

    this.lab.store.putDataset(input.dataset);

    const draft = this.lab.createDraft({ specification: input.proposal.genome.specificationDraft });
    if (!draft.ok) {
      return draft;
    }
    const compiled = this.lab.compile(draft.value.strategyId, draft.value.version, input.riskBudget);
    if (!compiled.ok) {
      return compiled;
    }
    const spec = this.lab.store.getSpecification(draft.value.strategyId, draft.value.version);
    if (!spec) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'compiled specification missing' });
    }

    const capsule = freezePromotionCapsule({
      specification: spec,
      plan: compiled.value,
      evidenceRefs: [{ evidenceKind: 'EXTERNAL', refId: input.proposal.proposalId, hash: input.proposal.materialHash }],
      subjectId: input.subjectId,
      frozenAt: input.sealedAt,
    });
    if (!capsule.ok) {
      return capsule;
    }

    const { train, validation: validationWindow, holdout } = input.proposal.genome.evaluationPlan;
    let parameterSet: ParameterSet = DEFAULT_PARAMETER_SET;
    let selectionReason = 'default parameter set';

    const sweep = input.proposal.genome.parameterSweep;
    if (sweep) {
      const grid = expandParameterGrid(sweep);
      if (!grid.ok) {
        return grid;
      }
      const trials: { readonly parameterSet: ParameterSet; readonly run: BacktestRun }[] = [];
      for (const candidate of grid.value) {
        const run = this.lab.backtest({
          strategyId: spec.strategyId,
          version: spec.version,
          datasetId: input.dataset.datasetId,
          datasetVersion: input.dataset.version,
          parameterSet: candidate,
          startingCapitalMinor: input.startingCapitalMinor,
          period: { start: train.start, end: train.end },
          partition: 'TRAIN',
        });
        if (!run.ok) {
          return run;
        }
        trials.push({ parameterSet: candidate, run: run.value });
      }
      const selected = selectParameterSetConservatively(
        trials,
        input.maxDrawdownBps ?? DEFAULT_STRATEGY_SAFETY_POLICY.maximumRules * 100,
      );
      if (!selected) {
        return err({
          code: 'PROMOTION_GATE_FAILED',
          message: 'no parameter sweep candidate passed drawdown policy',
        });
      }
      parameterSet = selected.selected;
      selectionReason = selected.reason;
    }

    const trainRun = this.lab.backtest({
      strategyId: spec.strategyId,
      version: spec.version,
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
    const validationRun = this.lab.backtest({
      strategyId: spec.strategyId,
      version: spec.version,
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version,
      parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: { start: validationWindow.start, end: validationWindow.end },
      partition: 'VALIDATION',
    });
    if (!validationRun.ok) {
      return validationRun;
    }
    const holdoutRun = this.lab.backtest({
      strategyId: spec.strategyId,
      version: spec.version,
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

    const wfPlan = input.proposal.genome.evaluationPlan.walkForward;
    const walkForward = runWalkForward({
      specification: spec,
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

    const parameterCount = countStrategyParameters(spec.entryConditions);
    const warnings = overfittingWarnings({
      parameterCount,
      observationCount: input.dataset.observations.length,
      train: trainRun.value,
      outOfSample: holdoutRun.value,
      turnoverBps: holdoutRun.value.results.turnoverBps,
    });

    const validationReport = buildValidationReport({
      strategyId: spec.strategyId,
      strategyVersion: spec.version,
      plan: compiled.value,
      train: trainRun.value,
      validation: validationRun.value,
      outOfSample: holdoutRun.value,
      walkForward: walkForward.value,
      warnings,
      limitations: Object.freeze([
        'AI-generated proposal. Human governance required before paper promotion.',
        'Selection policy forbids promotion on maximum backtest return alone.',
      ]),
      generatedAt: input.sealedAt,
    });

    const metrics = buildMetrics({
      train: trainRun.value,
      holdout: holdoutRun.value,
      walkForwardFoldCount: walkForward.value.folds.length,
      proposal: input.proposal,
    });

    const forwardShadowRecommended =
      metrics.maxDrawdownBps <= (input.maxDrawdownBps ?? 2_500) &&
      metrics.explicitCostsApplied &&
      walkForward.value.folds.length > 0;
    const paperRecommended =
      forwardShadowRecommended &&
      metrics.stabilityScore >= 20 &&
      warnings.every((warning) => warning.kind !== 'LARGE_TRAIN_TEST_GAP');

    const evidence = buildStrategyProposalEvidence({
      proposal: input.proposal,
      validation: validation.value,
      capsule: capsule.value,
      validationReport,
      train: trainRun.value,
      validationRun: validationRun.value,
      holdout: holdoutRun.value,
      walkForward: walkForward.value,
      metrics,
      sealedAt: input.sealedAt,
    });
    sealStrategyProposalEvidence(this.vault, evidence);

    return ok(
      Object.freeze({
        proposalId: input.proposal.proposalId,
        stageReached: paperRecommended ? 'PAPER_RECOMMENDED' : 'FORWARD_SHADOW_RECOMMENDED',
        capsuleCandidateFingerprint: capsule.value.fingerprint,
        validationReportId: validationReport.validationId,
        metrics,
        forwardShadowRecommended,
        paperRecommended,
        deployed: false,
        humanPromotionRequired: true,
        evidence,
        selectionReason,
      }),
    );
  }
}
