import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import type { StressRun } from '../../risk/src/types.ts';
import type { BacktestRun } from './backtest.ts';
import type { SimulationPlan } from './compiler.ts';
import type { Experiment } from './experiment.ts';
import {
  asStrategyValidationId,
  type StrategyId,
  type StrategyValidationId,
  type StrategyVersion,
} from './ids.ts';
import type { OverfittingWarning } from './types.ts';
import type { WalkForwardRun } from './walk-forward.ts';

export type ReviewerDisposition = 'APPROVE_SHADOW' | 'APPROVE_PAPER' | 'REJECT' | 'HOLD_REVIEW';

export type StrategyValidationReport = {
  readonly validationId: StrategyValidationId;
  readonly strategyId: StrategyId;
  readonly strategyVersion: StrategyVersion;
  readonly compilerVersion: string;
  readonly compiledHash: string;
  readonly datasets: readonly { readonly datasetId: string; readonly version: string; readonly hash: string }[];
  readonly experiments: readonly string[];
  readonly trainResults: BacktestRun | null;
  readonly validationResults: BacktestRun | null;
  readonly outOfSampleResults: BacktestRun | null;
  readonly walkForward: WalkForwardRun | null;
  readonly benchmark: { readonly datasetId: string; readonly version: string; readonly hash: string } | null;
  readonly feesMinor: bigint;
  readonly riskModelVersion: string;
  readonly stress: readonly StressRun[];
  readonly overfittingWarnings: readonly OverfittingWarning[];
  readonly modelVersions: readonly string[];
  readonly limitations: readonly string[];
  readonly reviewerDisposition: ReviewerDisposition | null;
  readonly trainUnbiasedExpectedPerformance: false;
  readonly futureReturnGuarantee: false;
  readonly generatedAt: UtcInstant;
};

export function buildValidationReport(input: {
  readonly strategyId: StrategyId;
  readonly strategyVersion: StrategyVersion;
  readonly plan: SimulationPlan;
  readonly train?: BacktestRun | undefined;
  readonly validation?: BacktestRun | undefined;
  readonly outOfSample?: BacktestRun | undefined;
  readonly walkForward?: WalkForwardRun | undefined;
  readonly experiment?: Experiment | undefined;
  readonly benchmark?: { readonly datasetId: string; readonly version: string; readonly hash: string } | undefined;
  readonly stress?: readonly StressRun[] | undefined;
  readonly warnings?: readonly OverfittingWarning[] | undefined;
  readonly limitations?: readonly string[] | undefined;
  readonly generatedAt: UtcInstant;
}): StrategyValidationReport {
  const datasets = [
    input.train,
    input.validation,
    input.outOfSample,
  ]
    .filter((run): run is BacktestRun => run !== undefined)
    .map((run) => ({ datasetId: run.datasetId, version: run.datasetVersion, hash: run.datasetHash }));
  const material = JSON.stringify({
    strategyId: input.strategyId,
    version: input.strategyVersion,
    compiledHash: input.plan.compiledHash,
    train: input.train?.outputHash ?? null,
    oos: input.outOfSample?.outputHash ?? null,
    walk: input.walkForward?.runId ?? null,
  });
  return Object.freeze({
    validationId: asStrategyValidationId(`svl_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`),
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    compilerVersion: input.plan.compilerVersion,
    compiledHash: input.plan.compiledHash,
    datasets: Object.freeze(datasets),
    experiments: Object.freeze(input.experiment ? [input.experiment.experimentId] : []),
    trainResults: input.train ?? null,
    validationResults: input.validation ?? null,
    outOfSampleResults: input.outOfSample ?? null,
    walkForward: input.walkForward ?? null,
    benchmark: input.benchmark ?? null,
    feesMinor: (input.train?.results.feesMinor ?? 0n) + (input.outOfSample?.results.feesMinor ?? 0n),
    riskModelVersion: input.plan.riskDependencies[0]?.riskModelVersion ?? 'unspecified',
    stress: Object.freeze([...(input.stress ?? [])]),
    overfittingWarnings: Object.freeze([...(input.warnings ?? [])]),
    modelVersions: Object.freeze(input.plan.modelDependencies.map((row) => `${row.modelId}@${row.version}`)),
    limitations: Object.freeze([
      'Historical simulation only. Not a future-return guarantee.',
      'TRAIN performance is never unbiased expected performance.',
      ...(input.limitations ?? []),
    ]),
    reviewerDisposition: null,
    trainUnbiasedExpectedPerformance: false,
    futureReturnGuarantee: false,
    generatedAt: input.generatedAt,
  });
}
