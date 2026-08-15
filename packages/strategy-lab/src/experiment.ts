import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { runBacktest, type BacktestRun, type ParameterSet } from './backtest.ts';
import type { SimulationPlan } from './compiler.ts';
import type { MarketDataset } from './dataset.ts';
import { asExperimentId, asParameterSetId, type ExperimentId } from './ids.ts';
import type { StrategySpecification } from './specification.ts';
import { STRATEGY_RESOURCE_LIMITS, type EvaluationPartition, type OverfittingWarning, type StrategyFailure } from './types.ts';

export type ExperimentTrial = {
  readonly parameterSet: ParameterSet;
  readonly run: BacktestRun;
  readonly hidden: false;
};

export type Experiment = {
  readonly experimentId: ExperimentId;
  readonly strategyId: string;
  readonly strategyVersions: readonly string[];
  readonly parameterSets: readonly ParameterSet[];
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly runs: readonly BacktestRun[];
  readonly trials: readonly ExperimentTrial[];
  readonly selectionCriteria: string;
  readonly selectedParameterSetId: string | null;
  readonly warnings: readonly OverfittingWarning[];
  readonly resultsRetained: true;
  readonly generatedAt: UtcInstant;
};

export function expandParameterGrid(
  axes: Readonly<Record<string, readonly string[]>>,
): Result<readonly ParameterSet[], StrategyFailure> {
  const keys = Object.keys(axes);
  let combinations: Record<string, string>[] = [{}];
  for (const key of keys) {
    const values = axes[key] ?? [];
    const next: Record<string, string>[] = [];
    for (const current of combinations) {
      for (const value of values) {
        next.push({ ...current, [key]: value });
      }
    }
    combinations = next;
  }
  if (combinations.length > STRATEGY_RESOURCE_LIMITS.maximumParameterCombinations) {
    return err({
      code: 'RESOURCE_LIMIT',
      message: `parameter grid exceeds maximumParameterCombinations=${String(STRATEGY_RESOURCE_LIMITS.maximumParameterCombinations)}`,
    });
  }
  return ok(
    Object.freeze(
      combinations.map((values) => {
        const canonical = JSON.stringify(values);
        return Object.freeze({
          parameterSetId: asParameterSetId(`par_${createHash('sha256').update(canonical).digest('hex').slice(0, 20)}`),
          values: Object.freeze({ ...values }),
        });
      }),
    ),
  );
}

export function runExperiment(input: {
  readonly specification: StrategySpecification;
  readonly plan: SimulationPlan;
  readonly dataset: MarketDataset;
  readonly parameterSets: readonly ParameterSet[];
  readonly startingCapitalMinor: bigint;
  readonly period: { readonly start: import('../../domain/src/time.ts').UtcInstant; readonly end: import('../../domain/src/time.ts').UtcInstant };
  readonly partition: EvaluationPartition;
  readonly selectionCriteria: string;
  readonly generatedAt: UtcInstant;
  readonly warnings?: readonly OverfittingWarning[];
}): Result<Experiment, StrategyFailure> {
  if (input.parameterSets.length > STRATEGY_RESOURCE_LIMITS.maximumParameterCombinations) {
    return err({
      code: 'RESOURCE_LIMIT',
      message: 'agent-generated infinite or oversized search is forbidden',
    });
  }
  const trials: ExperimentTrial[] = [];
  for (const parameterSet of input.parameterSets) {
    const run = runBacktest({
      specification: input.specification,
      plan: input.plan,
      dataset: input.dataset,
      parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: input.period,
      partition: input.partition,
      generatedAt: input.generatedAt,
    });
    if (!run.ok) {
      return run;
    }
    trials.push(Object.freeze({ parameterSet, run: run.value, hidden: false }));
  }
  const ranked = [...trials].sort((a, b) =>
    a.run.results.totalReturn.units < b.run.results.totalReturn.units ? 1 : -1,
  );
  const selected = ranked[0]?.parameterSet.parameterSetId ?? null;
  const material = trials.map((trial) => trial.run.outputHash).join('|');
  return ok(
    Object.freeze({
      experimentId: asExperimentId(`exp_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`),
      strategyId: input.specification.strategyId,
      strategyVersions: Object.freeze([input.specification.version]),
      parameterSets: Object.freeze([...input.parameterSets]),
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version,
      runs: Object.freeze(trials.map((trial) => trial.run)),
      trials: Object.freeze(trials),
      selectionCriteria: input.selectionCriteria,
      selectedParameterSetId: selected,
      warnings: Object.freeze([...(input.warnings ?? [])]),
      resultsRetained: true,
      generatedAt: input.generatedAt,
    }),
  );
}

export function refuseExperimentDeletion(): Result<never, StrategyFailure> {
  return err({
    code: 'EXPERIMENT_DELETE_FORBIDDEN',
    message: 'experiment history is immutable; losing parameter sets cannot be deleted',
  });
}
