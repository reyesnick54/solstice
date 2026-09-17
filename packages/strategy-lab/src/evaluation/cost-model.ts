import { RATIO_UNIT, ratioFromUnits } from '../../../risk/src/arithmetic.ts';
import type { Ratio } from '../../../risk/src/arithmetic.ts';
import type { PerformanceMetrics } from '../metrics.ts';
import type { EvaluationEconomics, ExtendedEvaluationMetrics } from './types.ts';

export function buildEvaluationEconomics(input: {
  readonly startingCapitalMinor: bigint;
  readonly endingCapitalMinor: bigint;
  readonly feesMinor: bigint;
  readonly spreadCostMinor: bigint;
  readonly slippageCostMinor: bigint;
  readonly operatingResearchCostMinor: bigint;
}): EvaluationEconomics {
  const grossPnlMinor = input.endingCapitalMinor - input.startingCapitalMinor + input.feesMinor + input.spreadCostMinor + input.slippageCostMinor;
  const tradingCostMinor = input.feesMinor + input.spreadCostMinor + input.slippageCostMinor;
  const netEconomicsMinor =
    grossPnlMinor - tradingCostMinor - input.operatingResearchCostMinor;
  return Object.freeze({
    grossPnlMinor,
    tradingCostMinor,
    operatingResearchCostMinor: input.operatingResearchCostMinor,
    netEconomicsMinor,
    feesMinor: input.feesMinor,
    spreadCostMinor: input.spreadCostMinor,
    slippageCostMinor: input.slippageCostMinor,
  });
}

function ratioFromCapital(delta: bigint, base: bigint): Ratio {
  if (base <= 0n) {
    return ratioFromUnits(0n);
  }
  return ratioFromUnits((delta * RATIO_UNIT) / base);
}

export function extendMetrics(input: {
  readonly base: PerformanceMetrics;
  readonly economics: EvaluationEconomics;
  readonly startingCapitalMinor: bigint;
  readonly averageHoldingDays: number | null;
  readonly concentrationTopInstrumentBps: bigint | null;
  readonly worstPeriodReturn: Ratio | null;
}): ExtendedEvaluationMetrics {
  const grossReturn = ratioFromCapital(input.economics.grossPnlMinor, input.startingCapitalMinor);
  const netReturn = ratioFromCapital(input.economics.netEconomicsMinor, input.startingCapitalMinor);
  const idleCashRatio = input.base.cashUtilization;
  const winLossRate =
    input.base.tradeCount > 0
      ? ratioFromUnits((BigInt(input.base.winCount) * RATIO_UNIT) / BigInt(input.base.tradeCount))
      : null;
  return Object.freeze({
    ...input.base,
    ...input.economics,
    grossReturn,
    netReturn,
    averageHoldingDays: input.averageHoldingDays,
    concentrationTopInstrumentBps: input.concentrationTopInstrumentBps,
    idleCashRatio,
    worstPeriodReturn: input.worstPeriodReturn,
    winLossRate,
  });
}
