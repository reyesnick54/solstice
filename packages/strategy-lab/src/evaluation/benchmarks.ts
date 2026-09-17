import type { UtcInstant } from '../../../domain/src/time.ts';
import { ratioFromUnits, type Ratio } from '../../../risk/src/arithmetic.ts';
import type { ParameterSet } from '../backtest.ts';
import type { SimulationPlan } from '../compiler.ts';
import { calculateMetrics, type EquityPoint, type PerformanceMetrics } from '../metrics.ts';
import type { StrategySpecification } from '../specification.ts';
import type { EvaluationDatasetManifest } from './manifest.ts';
import { manifestViewAt } from './manifest.ts';
import { buildEvaluationEconomics } from './cost-model.ts';
import type { BenchmarkComparison, EvaluationEconomics } from './types.ts';

const H14_ENTRY_THRESHOLD = 10_100n;
const H14_EXIT_THRESHOLD = 10_300n;

function metricsFromEquity(input: {
  readonly startingCapitalMinor: bigint;
  readonly equity: readonly EquityPoint[];
  readonly feesMinor: bigint;
}): PerformanceMetrics {
  const ending = input.equity[input.equity.length - 1]?.totalMinor ?? input.startingCapitalMinor;
  return calculateMetrics({
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity: input.equity,
    feesMinor: input.feesMinor,
    tradedNotionalMinor: 0n,
    cashMinorSeries: input.equity.map(() => input.startingCapitalMinor),
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    observationDays: input.equity.length,
  });
}

function relativeReturn(strategy: Ratio, benchmark: Ratio): Ratio | null {
  return ratioFromUnits(strategy.units - benchmark.units);
}

function runCashBenchmark(startingCapitalMinor: bigint, stamps: readonly UtcInstant[]): BenchmarkComparison {
  const equity: EquityPoint[] = stamps.map((at) => Object.freeze({ at, totalMinor: startingCapitalMinor }));
  const metrics = metricsFromEquity({ startingCapitalMinor, equity, feesMinor: 0n });
  const economics = buildEvaluationEconomics({
    startingCapitalMinor,
    endingCapitalMinor: startingCapitalMinor,
    feesMinor: 0n,
    spreadCostMinor: 0n,
    slippageCostMinor: 0n,
    operatingResearchCostMinor: 0n,
  });
  return Object.freeze({
    kind: 'CASH_NO_ACTION',
    instrumentId: null,
    metrics,
    economics,
    relativeReturn: null,
  });
}

function runBuyAndHold(
  manifest: EvaluationDatasetManifest,
  instrumentId: string,
  startingCapitalMinor: bigint,
  stamps: readonly UtcInstant[],
): BenchmarkComparison | null {
  let cash = startingCapitalMinor;
  let qty = 0n;
  let fees = 0n;
  const equity: EquityPoint[] = [];
  for (const at of stamps) {
    const view = manifestViewAt(manifest, at);
    if (!view.ok) {
      continue;
    }
    const obs = view.value.observations.find((row) => row.instrumentId === instrumentId && row.at === at);
    if (qty === 0n && obs && obs.available && obs.closeMinor > 0n) {
      qty = cash / obs.closeMinor;
      fees += 2n;
      cash -= qty * obs.closeMinor + 2n;
    }
    const mark = cash + qty * (obs?.closeMinor ?? 0n);
    equity.push(Object.freeze({ at, totalMinor: mark }));
  }
  if (equity.length === 0) {
    return null;
  }
  const ending = equity[equity.length - 1]?.totalMinor ?? startingCapitalMinor;
  const metrics = metricsFromEquity({ startingCapitalMinor, equity, feesMinor: fees });
  const economics = buildEvaluationEconomics({
    startingCapitalMinor,
    endingCapitalMinor: ending,
    feesMinor: fees,
    spreadCostMinor: 0n,
    slippageCostMinor: 0n,
    operatingResearchCostMinor: 0n,
  });
  return Object.freeze({
    kind: 'BUY_AND_HOLD',
    instrumentId,
    metrics,
    economics,
    relativeReturn: null,
  });
}

function runH14ReferenceBenchmark(
  manifest: EvaluationDatasetManifest,
  instrumentId: string,
  startingCapitalMinor: bigint,
  stamps: readonly UtcInstant[],
): BenchmarkComparison | null {
  let cash = startingCapitalMinor;
  let qty = 0n;
  let fees = 0n;
  const equity: EquityPoint[] = [];
  for (const at of stamps) {
    const row = manifest.observations.find(
      (obs) => obs.instrumentId === instrumentId && obs.informationTime.sourceEventTime === at,
    );
    if (!row || !row.available || !row.sessionOpen) {
      equity.push(Object.freeze({ at, totalMinor: cash + qty * (row?.closeMinor ?? 0n) }));
      continue;
    }
    const mid = row.closeMinor;
    if (qty === 0n && mid <= H14_ENTRY_THRESHOLD && row.bidMinor !== null && row.askMinor !== null) {
      qty = 1n;
      const cost = row.askMinor + 2n;
      if (cost <= cash) {
        cash -= cost;
        fees += 2n;
      } else {
        qty = 0n;
      }
    } else if (qty > 0n && (mid >= H14_EXIT_THRESHOLD) && row.bidMinor !== null) {
      cash += row.bidMinor - 2n;
      fees += 2n;
      qty = 0n;
    }
    equity.push(Object.freeze({ at, totalMinor: cash + qty * mid }));
  }
  if (equity.length === 0) {
    return null;
  }
  const ending = equity[equity.length - 1]?.totalMinor ?? startingCapitalMinor;
  const metrics = metricsFromEquity({ startingCapitalMinor, equity, feesMinor: fees });
  const economics = buildEvaluationEconomics({
    startingCapitalMinor,
    endingCapitalMinor: ending,
    feesMinor: fees,
    spreadCostMinor: 0n,
    slippageCostMinor: 0n,
    operatingResearchCostMinor: 0n,
  });
  return Object.freeze({
    kind: 'HELIOS_H14_REFERENCE',
    instrumentId,
    metrics,
    economics,
    relativeReturn: null,
  });
}

export function runBenchmarkSuite(input: {
  readonly manifest: EvaluationDatasetManifest;
  readonly specification: StrategySpecification;
  readonly plan: SimulationPlan;
  readonly parameterSet: ParameterSet;
  readonly startingCapitalMinor: bigint;
  readonly period: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly strategyNetReturn: Ratio;
}): readonly BenchmarkComparison[] {
  const stamps = input.manifest.observations
    .map((row) => row.informationTime.sourceEventTime)
    .filter((at) => at >= input.period.start && at <= input.period.end)
    .filter((at, index, all) => all.indexOf(at) === index)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  const out: BenchmarkComparison[] = [runCashBenchmark(input.startingCapitalMinor, stamps)];

  const primaryInstrument = input.specification.instrumentUniverse[0];
  if (primaryInstrument) {
    const buyHold = runBuyAndHold(input.manifest, primaryInstrument, input.startingCapitalMinor, stamps);
    if (buyHold) {
      out.push({
        ...buyHold,
        relativeReturn: relativeReturn(input.strategyNetReturn, ratioFromUnits(buyHold.metrics.totalReturn.units)),
      });
    }
    const h14 = runH14ReferenceBenchmark(input.manifest, primaryInstrument, input.startingCapitalMinor, stamps);
    if (h14) {
      out.push({
        ...h14,
        relativeReturn: relativeReturn(input.strategyNetReturn, ratioFromUnits(h14.metrics.totalReturn.units)),
      });
    }
  }

  if (primaryInstrument) {
    const deterministic = runBuyAndHold(input.manifest, primaryInstrument, input.startingCapitalMinor, stamps);
    if (deterministic) {
      out.push(
        Object.freeze({
          ...deterministic,
          kind: 'SIMPLE_DETERMINISTIC',
          relativeReturn: relativeReturn(
            input.strategyNetReturn,
            ratioFromUnits(deterministic.metrics.totalReturn.units),
          ),
        }),
      );
    }
  }

  return Object.freeze(out);
}
