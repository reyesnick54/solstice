import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { SimulationPlan } from './compiler.ts';
import { latestCloseAt, membersAt, type MarketDataset } from './dataset.ts';
import { evaluateDecision } from './evaluate.ts';
import {
  asBacktestRunId,
  type BacktestRunId,
  type ParameterSetId,
  type StrategyId,
  type StrategyVersion,
} from './ids.ts';
import { calculateMetrics, type EquityPoint, type PerformanceMetrics } from './metrics.ts';
import { applyDividend, applySplit, simulateFill } from './simulator.ts';
import type { StrategySpecification } from './specification.ts';
import type { EvaluationPartition, StrategyFailure, TransactionCostAssumptions } from './types.ts';

export type ParameterSet = {
  readonly parameterSetId: ParameterSetId;
  readonly values: Readonly<Record<string, string>>;
};

export type InstrumentContribution = {
  readonly instrumentId: string;
  readonly contributionMinor: bigint;
};

export type StrategyAttribution = {
  readonly instruments: readonly InstrumentContribution[];
  readonly cashContributionMinor: bigint;
  readonly feesMinor: bigint;
  readonly allocationContributionMinor: bigint;
  readonly peveGrowthAttributionLedger: false;
};

export type BacktestRun = {
  readonly runId: BacktestRunId;
  readonly strategyId: StrategyId;
  readonly strategyVersion: StrategyVersion;
  readonly compilerVersion: string;
  readonly compiledHash: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetHash: string;
  readonly modelVersions: readonly string[];
  readonly riskModelVersion: string;
  readonly parameterSet: ParameterSet;
  readonly startingCapitalMinor: bigint;
  readonly period: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly partition: EvaluationPartition;
  readonly transactionCosts: TransactionCostAssumptions;
  readonly seed: string | null;
  readonly results: PerformanceMetrics;
  readonly attribution: StrategyAttribution;
  readonly outputHash: string;
  readonly generatedAt: UtcInstant;
  readonly equity: readonly EquityPoint[];
  readonly trainUnbiasedClaim: false;
};

function timestampsBetween(dataset: MarketDataset, start: UtcInstant, end: UtcInstant): readonly UtcInstant[] {
  const stamps = new Set<UtcInstant>();
  for (const row of dataset.observations) {
    if (row.at >= start && row.at <= end) {
      stamps.add(row.at);
    }
  }
  return Object.freeze([...stamps].sort());
}

function markToMarket(
  positions: Readonly<Record<string, bigint>>,
  dataset: MarketDataset,
  at: UtcInstant,
): bigint {
  let total = 0n;
  for (const [instrumentId, quantity] of Object.entries(positions)) {
    const price = latestCloseAt(dataset, instrumentId, at);
    if (price.ok) {
      total += quantity * price.value.closeMinor;
    }
  }
  return total;
}

export function runBacktest(input: {
  readonly specification: StrategySpecification;
  readonly plan: SimulationPlan;
  readonly dataset: MarketDataset;
  readonly parameterSet: ParameterSet;
  readonly startingCapitalMinor: bigint;
  readonly period: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly partition: EvaluationPartition;
  readonly generatedAt: UtcInstant;
  readonly seed?: string;
}): Result<BacktestRun, StrategyFailure> {
  if (input.specification.version.length === 0) {
    return err({ code: 'UNVERSIONED_STRATEGY', message: 'strategy version is required' });
  }
  if (input.dataset.version.length === 0) {
    return err({ code: 'UNVERSIONED_DATASET', message: 'dataset version is required' });
  }
  const costs = input.specification.transactionCosts;
  let cash = input.startingCapitalMinor;
  const positions: Record<string, bigint> = {};
  const equity: EquityPoint[] = [];
  const cashSeries: bigint[] = [];
  let fees = 0n;
  let tradedNotional = 0n;
  let tradeCount = 0;
  let winCount = 0;
  let lossCount = 0;
  const instrumentPnl: Record<string, bigint> = {};
  let previousTotal = input.startingCapitalMinor;
  const stamps = timestampsBetween(input.dataset, input.period.start, input.period.end);
  for (const at of stamps) {
    for (const action of input.dataset.corporateActions.filter((row) => row.at === at)) {
      const owned = positions[action.instrumentId] ?? 0n;
      if (owned <= 0n) {
        continue;
      }
      if (action.kind === 'SPLIT' && action.splitNumerator && action.splitDenominator) {
        positions[action.instrumentId] = applySplit(owned, action.splitNumerator, action.splitDenominator);
      }
      if (action.kind === 'DIVIDEND' && action.cashMinorPerShare) {
        const income = applyDividend(owned, action.cashMinorPerShare);
        cash += income;
        instrumentPnl[action.instrumentId] = (instrumentPnl[action.instrumentId] ?? 0n) + income;
      }
    }
    const members = membersAt(input.dataset, at);
    for (const instrumentId of Object.keys(positions)) {
      if (!members.includes(instrumentId) && (positions[instrumentId] ?? 0n) > 0n) {
        const price = latestCloseAt(input.dataset, instrumentId, at);
        if (price.ok) {
          const qty = positions[instrumentId] ?? 0n;
          const fill = simulateFill({
            order: { instrumentId, side: 'SELL', quantity: qty, decisionAt: at },
            market: { closeMinor: price.value.closeMinor, available: price.value.available },
            costs,
            cashMinor: cash,
            ownedQuantity: qty,
          });
          if (fill.ok) {
            cash += fill.value.cashDeltaMinor;
            fees += fill.value.feeMinor;
            positions[instrumentId] = 0n;
            tradeCount += 1;
          }
        }
      }
    }
    const decision = evaluateDecision({
      specification: input.specification,
      dataset: input.dataset,
      at,
      start: input.period.start,
      cashBps: input.specification.cashAllocationBps,
    });
    const total = cash + markToMarket(positions, input.dataset, at);
    if (decision.shouldRebalance || decision.exit) {
      const targets = decision.exit ? { CASH: 10_000 } : decision.targetWeightsBps;
      for (const instrumentId of new Set([...Object.keys(positions), ...Object.keys(targets), ...members])) {
        if (instrumentId === 'CASH') {
          continue;
        }
        const price = latestCloseAt(input.dataset, instrumentId, at);
        const targetBps = targets[instrumentId] ?? 0;
        const targetValue = (total * BigInt(targetBps)) / 10_000n;
        const currentQty = positions[instrumentId] ?? 0n;
        const currentValue = price.ok ? currentQty * price.value.closeMinor : 0n;
        const deltaValue = targetValue - currentValue;
        if (!price.ok || deltaValue === 0n || price.value.closeMinor <= 0n) {
          continue;
        }
        const side = deltaValue > 0n ? 'BUY' : 'SELL';
        const quantity = (deltaValue < 0n ? -deltaValue : deltaValue) / price.value.closeMinor;
        if (quantity <= 0n) {
          continue;
        }
        const fill = simulateFill({
          order: { instrumentId, side, quantity, decisionAt: at },
          market: { closeMinor: price.value.closeMinor, available: price.value.available },
          costs,
          cashMinor: cash,
          ownedQuantity: currentQty,
        });
        if (!fill.ok) {
          return fill;
        }
        if (fill.value.filledQuantity === 0n) {
          continue;
        }
        cash += fill.value.cashDeltaMinor;
        if (cash < 0n) {
          return err({ code: 'NEGATIVE_CASH', message: 'backtest produced negative cash' });
        }
        const nextQty =
          side === 'BUY' ? currentQty + fill.value.filledQuantity : currentQty - fill.value.filledQuantity;
        if (nextQty < 0n) {
          return err({ code: 'SHORT_FORBIDDEN', message: 'backtest produced a short position' });
        }
        positions[instrumentId] = nextQty;
        fees += fill.value.feeMinor;
        tradedNotional += fill.value.priceMinor * fill.value.filledQuantity;
        tradeCount += 1;
        instrumentPnl[instrumentId] =
          (instrumentPnl[instrumentId] ?? 0n) + (side === 'SELL' ? fill.value.cashDeltaMinor : -fill.value.feeMinor);
      }
    }
    const marked = cash + markToMarket(positions, input.dataset, at);
    if (marked < previousTotal) {
      lossCount += 1;
    } else if (marked > previousTotal) {
      winCount += 1;
    }
    previousTotal = marked;
    cashSeries.push(cash);
    equity.push(Object.freeze({ at, totalMinor: marked }));
  }
  const ending = equity[equity.length - 1]?.totalMinor ?? input.startingCapitalMinor;
  const results = calculateMetrics({
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity,
    feesMinor: fees,
    tradedNotionalMinor: tradedNotional,
    cashMinorSeries: cashSeries,
    tradeCount,
    winCount,
    lossCount,
    observationDays: stamps.length,
  });
  const attribution: StrategyAttribution = Object.freeze({
    instruments: Object.freeze(
      Object.entries(instrumentPnl).map(([instrumentId, contributionMinor]) =>
        Object.freeze({ instrumentId, contributionMinor }),
      ),
    ),
    cashContributionMinor: cash - input.startingCapitalMinor,
    feesMinor: fees,
    allocationContributionMinor: ending - input.startingCapitalMinor - fees,
    peveGrowthAttributionLedger: false,
  });
  const material = JSON.stringify(
    {
      strategyId: input.specification.strategyId,
      version: input.specification.version,
      compiler: input.plan.compilerVersion,
      compiledHash: input.plan.compiledHash,
      dataset: `${input.dataset.datasetId}@${input.dataset.version}:${input.dataset.hash}`,
      models: input.plan.modelDependencies,
      risk: input.plan.riskDependencies,
      parameters: input.parameterSet,
      start: input.startingCapitalMinor.toString(),
      period: input.period,
      costs,
      seed: input.seed ?? null,
      ending: ending.toString(),
      fees: fees.toString(),
      trades: tradeCount,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
  const outputHash = createHash('sha256').update(material).digest('hex');
  return ok(
    Object.freeze({
      runId: asBacktestRunId(`btr_${outputHash.slice(0, 24)}`),
      strategyId: input.specification.strategyId,
      strategyVersion: input.specification.version,
      compilerVersion: input.plan.compilerVersion,
      compiledHash: input.plan.compiledHash,
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.version,
      datasetHash: input.dataset.hash,
      modelVersions: Object.freeze(input.plan.modelDependencies.map((row) => `${row.modelId}@${row.version}`)),
      riskModelVersion: input.plan.riskDependencies[0]?.riskModelVersion ?? 'unspecified',
      parameterSet: input.parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: input.period,
      partition: input.partition,
      transactionCosts: costs,
      seed: input.seed ?? null,
      results,
      attribution,
      outputHash,
      generatedAt: input.generatedAt,
      equity: Object.freeze([...equity]),
      trainUnbiasedClaim: false,
    }),
  );
}
