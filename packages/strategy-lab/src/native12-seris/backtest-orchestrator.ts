import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { BacktestRun } from '../backtest.ts';

export type SerisBacktestRunSummary = {
  readonly runId: string;
  readonly strategyName: string;
  readonly symbol: string;
  readonly partition: BacktestRun['partition'];
  readonly initialCapitalMinor: string;
  readonly finalEquityMinor: string;
  readonly candleCount: number;
  readonly metricsHash: string;
  readonly dataRange: { readonly from: UtcInstant; readonly to: UtcInstant };
  readonly startedAt: UtcInstant;
  readonly endedAt: UtcInstant;
};

function canonicalMetrics(run: BacktestRun): string {
  return JSON.stringify({
    totalReturn: run.results.totalReturn.units.toString(),
    maxDrawdown: run.results.maximumDrawdown.units.toString(),
    feesMinor: run.results.feesMinor.toString(),
    turnoverBps: String(run.results.turnoverBps),
    partition: run.partition,
  });
}

export function summarizeBacktestRun(input: {
  readonly run: BacktestRun;
  readonly strategyName: string;
  readonly symbol: string;
  readonly endedAt: UtcInstant;
}): SerisBacktestRunSummary {
  const metricsHash = createHash('sha256')
    .update(
      JSON.stringify({
        strategyName: input.strategyName,
        symbol: input.symbol,
        metrics: canonicalMetrics(input.run),
      }),
    )
    .digest('hex');
  return Object.freeze({
    runId: input.run.runId,
    strategyName: input.strategyName,
    symbol: input.symbol,
    partition: input.run.partition,
    initialCapitalMinor: input.run.startingCapitalMinor.toString(),
    finalEquityMinor: (input.run.equity.at(-1)?.totalMinor ?? input.run.startingCapitalMinor).toString(),
    candleCount: input.run.equity.length,
    metricsHash,
    dataRange: Object.freeze({ from: input.run.period.start, to: input.run.period.end }),
    startedAt: input.run.generatedAt,
    endedAt: input.endedAt,
  });
}
