import type { BacktestRun } from './backtest.ts';
import type { Experiment } from './experiment.ts';
import type { OverfittingWarning } from './types.ts';

export function overfittingWarnings(input: {
  readonly parameterCount: number;
  readonly observationCount: number;
  readonly train?: BacktestRun | undefined;
  readonly outOfSample?: BacktestRun | undefined;
  readonly experiment?: Experiment | undefined;
  readonly turnoverBps?: bigint | undefined;
}): readonly OverfittingWarning[] {
  const warnings: OverfittingWarning[] = [];
  const note = { provesOverfitting: false as const, disprovesOverfitting: false as const };
  if (input.parameterCount >= 6) {
    warnings.push({
      kind: 'TOO_MANY_PARAMETERS',
      message: `parameter count ${String(input.parameterCount)} is high relative to a constrained simulation`,
      ...note,
    });
  }
  if (input.observationCount < 20) {
    warnings.push({
      kind: 'TOO_FEW_OBSERVATIONS',
      message: `observation count ${String(input.observationCount)} is too small for an unbiased claim`,
      ...note,
    });
  }
  if (input.train && input.outOfSample) {
    const gap = input.train.results.totalReturn.units - input.outOfSample.results.totalReturn.units;
    if (gap > 20_000_000n) {
      warnings.push({
        kind: 'LARGE_TRAIN_TEST_GAP',
        message: 'TRAIN performance is materially stronger than OUT_OF_SAMPLE_TEST; TRAIN is not unbiased expected performance',
        ...note,
      });
    }
  }
  if (input.experiment && input.experiment.parameterSets.length >= 8) {
    warnings.push({
      kind: 'WINNER_FROM_MANY_TRIALS',
      message: `winner selected from ${String(input.experiment.parameterSets.length)} persisted trials`,
      ...note,
    });
  }
  if (input.outOfSample && input.outOfSample.equity.length >= 3) {
    const first = input.outOfSample.equity[0]?.totalMinor ?? 0n;
    const last = input.outOfSample.equity[input.outOfSample.equity.length - 1]?.totalMinor ?? 0n;
    const mid = input.outOfSample.equity[Math.floor(input.outOfSample.equity.length / 2)]?.totalMinor ?? 0n;
    if (first > 0n && last - first > 0n && mid - first > ((last - first) * 8n) / 10n) {
      warnings.push({
        kind: 'RESULT_DOMINATED_BY_ONE_PERIOD',
        message: 'a single interval accounts for most of the observed change',
        ...note,
      });
    }
  }
  if (input.turnoverBps !== undefined && input.turnoverBps > 50_000n) {
    warnings.push({
      kind: 'EXCESSIVE_TURNOVER',
      message: 'turnover is high relative to starting capital after explicit costs',
      ...note,
    });
  }
  if (input.experiment && input.experiment.parameterSets.length >= 4) {
    const returns = input.experiment.runs.map((run) => run.results.totalReturn.units).sort((a, b) => (a < b ? -1 : 1));
    const min = returns[0] ?? 0n;
    const max = returns[returns.length - 1] ?? 0n;
    if (max - min > 30_000_000n) {
      warnings.push({
        kind: 'UNSTABLE_PARAMETERS',
        message: 'nearby parameter sets produce unstable historical results',
        ...note,
      });
    }
  }
  return Object.freeze(warnings);
}
