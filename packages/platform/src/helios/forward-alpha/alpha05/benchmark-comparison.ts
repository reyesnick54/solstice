import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import {
  activeReturnRatio,
  alignActivePeriodReturns,
  informationRatio,
  totalReturnRatio,
  trackingErrorFromActiveSeries,
} from './numeric.ts';
import { HELIOS_ALPHA05_SCHEMA } from './taxonomy.ts';
import type { BenchmarkComparison, BenchmarkPortfolio, ForwardBenchmark, ReturnAttributionMetrics } from './types.ts';

export type BuildBenchmarkComparisonInput = {
  readonly forwardBenchmark: ForwardBenchmark;
  readonly benchmarkPortfolio: BenchmarkPortfolio;
  readonly strategyEquity: readonly { readonly at: UtcInstant; readonly totalMinor: bigint }[];
  readonly methodology: string;
  readonly computedAt: UtcInstant;
};

function metricsFromEquity(
  strategyStarting: bigint,
  strategyEnding: bigint,
  strategyEquity: readonly { readonly at: UtcInstant; readonly totalMinor: bigint }[],
  benchmarkPortfolio: BenchmarkPortfolio,
): ReturnAttributionMetrics {
  const absoluteReturn = totalReturnRatio(strategyStarting, strategyEnding);
  const benchmarkReturn = totalReturnRatio(
    benchmarkPortfolio.startingCapitalMinor,
    benchmarkPortfolio.endingCapitalMinor,
  );
  const activeReturn = activeReturnRatio(absoluteReturn, benchmarkReturn);
  const activeSeries = alignActivePeriodReturns(strategyEquity, benchmarkPortfolio.equity);
  const trackingError = trackingErrorFromActiveSeries(activeSeries);
  const information = informationRatio(activeReturn, trackingError);
  return Object.freeze({
    absoluteReturn,
    benchmarkReturn,
    activeReturn,
    trackingError,
    informationRatio: information,
  });
}

export function buildBenchmarkComparison(input: BuildBenchmarkComparisonInput): BenchmarkComparison {
  const strategyStarting = input.strategyEquity[0]?.totalMinor ?? 0n;
  const strategyEnding = input.strategyEquity[input.strategyEquity.length - 1]?.totalMinor ?? strategyStarting;
  const metrics = metricsFromEquity(strategyStarting, strategyEnding, input.strategyEquity, input.benchmarkPortfolio);
  const material = `${input.forwardBenchmark.benchmarkId}:${strategyStarting}:${strategyEnding}`;
  const comparisonId = `alpha05-cmp:${createHash('sha256').update(material).digest('hex').slice(0, 18)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    comparisonId,
    campaignId: input.forwardBenchmark.campaignId,
    forwardBenchmark: input.forwardBenchmark,
    benchmarkPortfolio: input.benchmarkPortfolio,
    strategyStartingCapitalMinor: strategyStarting,
    strategyEndingCapitalMinor: strategyEnding,
    metrics,
    methodology: input.methodology,
    computedAt: input.computedAt,
  });
}
