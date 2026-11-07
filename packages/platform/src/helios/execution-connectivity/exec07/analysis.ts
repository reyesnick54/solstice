import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import {
  benchmarkConstructionComplete,
  buildExecutionBenchmarks,
  pickPrimaryBenchmark,
  type ExecutionBenchmarkPriceInput,
} from './benchmarks.ts';
import { averageNullableBps, bpsFromMinorDelta, clampBps, rateBps, signedSlippageMinor } from './numeric.ts';
import { HELIOS_EXEC07_TCA_SCHEMA } from './taxonomy.ts';
import type {
  ExecutionOperationalMetrics,
  TransactionCostAnalysis,
} from './types.ts';

export type Exec07TransactionCostInput = {
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: bigint;
  readonly quantityFilledUnits: bigint;
  readonly averageFillPriceMinor: bigint | null;
  readonly explicitFeesMinor: bigint | null;
  readonly spreadAtArrivalMinor: bigint | null;
  readonly decisionToFillMoveMinor: bigint | null;
  readonly priceImprovementVsLimitMinor: bigint | null;
  readonly ordersSubmitted: number;
  readonly ordersFilled: number;
  readonly ordersPartiallyFilled: number;
  readonly ordersCanceled: number;
  readonly ordersRejected: number;
  readonly submissionToAckLatencyMs: number | null;
  readonly ackToFillLatencyMs: number | null;
  readonly postFillAdverseMoveBps: number | null;
  readonly benchmarks: ExecutionBenchmarkPriceInput;
  readonly computedAt: UtcInstant;
};

function operationalMetrics(input: Exec07TransactionCostInput): ExecutionOperationalMetrics {
  const submitted = input.ordersSubmitted > 0 ? input.ordersSubmitted : 1;
  return Object.freeze({
    fillRateBps: rateBps(input.ordersFilled, submitted),
    partialFillRateBps: rateBps(input.ordersPartiallyFilled, submitted),
    cancelRateBps: rateBps(input.ordersCanceled, submitted),
    rejectRateBps: rateBps(input.ordersRejected, submitted),
    submissionToAckLatencyMs: input.submissionToAckLatencyMs,
    ackToFillLatencyMs: input.ackToFillLatencyMs,
    adverseSelectionBps: input.postFillAdverseMoveBps == null ? null : clampBps(input.postFillAdverseMoveBps),
  });
}

export function computeExec07TransactionCostAnalysis(input: Exec07TransactionCostInput): TransactionCostAnalysis {
  const benchmarks = buildExecutionBenchmarks(input.benchmarks);
  const primary = pickPrimaryBenchmark(benchmarks, 'ARRIVAL_PRICE');
  const benchmarkPrice = primary?.priceMinor ?? null;
  const fillPrice = input.averageFillPriceMinor;
  const filledQty = input.quantityFilledUnits;
  const notional =
    benchmarkPrice != null && filledQty > 0n ? benchmarkPrice * filledQty : fillPrice != null && filledQty > 0n ? fillPrice * filledQty : 0n;

  const spreadCostMinor =
    input.spreadAtArrivalMinor != null && filledQty > 0n ? input.spreadAtArrivalMinor * filledQty : null;

  const slippageMinor =
    benchmarkPrice != null && fillPrice != null && filledQty > 0n
      ? signedSlippageMinor({
          side: input.side,
          benchmarkPriceMinor: benchmarkPrice,
          fillPriceMinor: fillPrice,
          quantityUnits: filledQty,
        })
      : null;

  const timingCostMinor =
    input.decisionToFillMoveMinor != null && filledQty > 0n ? input.decisionToFillMoveMinor * filledQty : null;

  const marketImpactMinor = slippageMinor != null && spreadCostMinor != null ? slippageMinor - spreadCostMinor : slippageMinor;

  const implementationShortfallMinor = slippageMinor;

  const explicitFeesMinor = input.explicitFeesMinor;
  const priceImprovementMinor = input.priceImprovementVsLimitMinor;

  const benchmarkOk = benchmarkConstructionComplete(benchmarks);
  const dataComplete =
    benchmarkOk &&
    fillPrice != null &&
    filledQty > 0n &&
    explicitFeesMinor != null &&
    spreadCostMinor != null &&
    slippageMinor != null;

  const material = [
    input.side,
    input.quantityUnits.toString(),
    filledQty.toString(),
    fillPrice?.toString() ?? 'null',
    benchmarkPrice?.toString() ?? 'null',
  ].join(':');
  const analysisId = `exec07_tca_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;

  return Object.freeze({
    analysisId,
    schema: HELIOS_EXEC07_TCA_SCHEMA,
    side: input.side,
    quantityUnits: input.quantityUnits,
    quantityFilledUnits: filledQty,
    notionalMinor: notional,
    explicitFeesMinor,
    spreadCostMinor,
    spreadCostBps: bpsFromMinorDelta(spreadCostMinor ?? 0n, notional),
    marketImpactMinor,
    marketImpactBps: bpsFromMinorDelta(marketImpactMinor ?? 0n, notional),
    timingCostMinor,
    timingCostBps: bpsFromMinorDelta(timingCostMinor ?? 0n, notional),
    slippageMinor,
    slippageBps: bpsFromMinorDelta(slippageMinor ?? 0n, notional),
    priceImprovementMinor,
    priceImprovementBps: bpsFromMinorDelta(priceImprovementMinor ?? 0n, notional),
    implementationShortfallMinor,
    implementationShortfallBps: bpsFromMinorDelta(implementationShortfallMinor ?? 0n, notional),
    benchmarks,
    operational: operationalMetrics(input),
    benchmarkConstructionComplete: benchmarkOk,
    dataComplete,
    computedAt: input.computedAt,
  });
}

export function aggregateCostBps(analyses: readonly TransactionCostAnalysis[], field: 'slippageBps'): number | null {
  return averageNullableBps(analyses.map((row) => row[field]));
}
