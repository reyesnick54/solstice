import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { runBacktest, type BacktestRun, type ParameterSet } from './backtest.ts';
import type { SimulationPlan } from './compiler.ts';
import type { MarketDataset } from './dataset.ts';
import { asWalkForwardRunId, type WalkForwardRunId } from './ids.ts';
import type { StrategySpecification } from './specification.ts';
import type { ChronologicalWindow, StrategyFailure } from './types.ts';

export type WalkForwardFold = {
  readonly train: ChronologicalWindow;
  readonly test: ChronologicalWindow;
  readonly trainRun: BacktestRun;
  readonly testRun: BacktestRun;
  readonly configurationFrozen: true;
};

export type WalkForwardRun = {
  readonly runId: WalkForwardRunId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly folds: readonly WalkForwardFold[];
  readonly boundaries: readonly ChronologicalWindow[];
  readonly generatedAt: UtcInstant;
};

function addDays(instant: UtcInstant, days: number): UtcInstant {
  return new Date(Date.parse(instant) + days * 86_400_000).toISOString() as UtcInstant;
}

export function walkForwardWindows(input: {
  readonly start: UtcInstant;
  readonly end: UtcInstant;
  readonly trainDays: number;
  readonly testDays: number;
}): readonly { readonly train: ChronologicalWindow; readonly test: ChronologicalWindow }[] {
  const folds: { readonly train: ChronologicalWindow; readonly test: ChronologicalWindow }[] = [];
  let cursor = input.start;
  while (true) {
    const trainEnd = addDays(cursor, input.trainDays);
    const testEnd = addDays(trainEnd, input.testDays);
    if (testEnd > input.end) {
      break;
    }
    folds.push(
      Object.freeze({
        train: Object.freeze({ start: cursor, end: trainEnd, partition: 'TRAIN' as const }),
        test: Object.freeze({ start: trainEnd, end: testEnd, partition: 'OUT_OF_SAMPLE_TEST' as const }),
      }),
    );
    cursor = addDays(cursor, input.testDays);
  }
  return Object.freeze(folds);
}

export function runWalkForward(input: {
  readonly specification: StrategySpecification;
  readonly plan: SimulationPlan;
  readonly dataset: MarketDataset;
  readonly parameterSet: ParameterSet;
  readonly startingCapitalMinor: bigint;
  readonly trainDays: number;
  readonly testDays: number;
  readonly generatedAt: UtcInstant;
}): Result<WalkForwardRun, StrategyFailure> {
  const windows = walkForwardWindows({
    start: input.dataset.timeRange.start,
    end: input.dataset.timeRange.end,
    trainDays: input.trainDays,
    testDays: input.testDays,
  });
  if (windows.length === 0) {
    return err({ code: 'RESOURCE_LIMIT', message: 'walk-forward window does not fit the dataset' });
  }
  const folds: WalkForwardFold[] = [];
  for (const window of windows) {
    const trainRun = runBacktest({
      specification: input.specification,
      plan: input.plan,
      dataset: input.dataset,
      parameterSet: input.parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: { start: window.train.start, end: window.train.end },
      partition: 'TRAIN',
      generatedAt: input.generatedAt,
    });
    if (!trainRun.ok) {
      return trainRun;
    }
    const testRun = runBacktest({
      specification: input.specification,
      plan: input.plan,
      dataset: input.dataset,
      parameterSet: input.parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: { start: window.test.start, end: window.test.end },
      partition: 'OUT_OF_SAMPLE_TEST',
      generatedAt: input.generatedAt,
    });
    if (!testRun.ok) {
      return testRun;
    }
    folds.push(
      Object.freeze({
        train: window.train,
        test: window.test,
        trainRun: trainRun.value,
        testRun: testRun.value,
        configurationFrozen: true,
      }),
    );
  }
  const material = folds.map((fold) => `${fold.train.start}:${fold.test.end}:${fold.testRun.outputHash}`).join('|');
  return ok(
    Object.freeze({
      runId: asWalkForwardRunId(`wfr_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`),
      strategyId: input.specification.strategyId,
      strategyVersion: input.specification.version,
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version,
      folds: Object.freeze(folds),
      boundaries: Object.freeze(folds.flatMap((fold) => [fold.train, fold.test])),
      generatedAt: input.generatedAt,
    }),
  );
}
