/**
 * VAL02 — probabilistic business-driver cash-flow forecast engine.
 */

import type { CashFlowLineItem, ForecastHorizonBand } from './taxonomy.ts';
import {
  HELIOS_VAL02_DRIVER_FORECAST_AUTHORITY,
  HELIOS_VAL02_DRIVER_FORECAST_SCHEMA,
} from './taxonomy.ts';
import type {
  BuildDriverForecastInput,
  DriverForecastResult,
  LineItemDistribution,
  PeriodCashFlowDistribution,
  PeriodCashFlowSample,
} from './types.ts';
import { drawCorrelatedFactors } from './correlations.ts';
import { assessEconomicFeasibility } from './constraints.ts';
import { evaluateDriverTree } from './driver-tree.ts';
import {
  blendHorizonTargets,
  horizonGrowthPrior,
  mediumTermAnalystGrowth,
  nearTermEarn09Bridge,
  resolveHorizonBand,
} from './horizons.ts';
import { mean, parseFundamentalMinor, parseFundamentalRatio, percentile, stdDev } from './numeric.ts';
import { createSeededRng } from './rng.ts';

const MONEY_SCALE = 1_000_000;

function buildLineItemDistribution(lineItem: CashFlowLineItem, values: readonly number[]): LineItemDistribution {
  const sorted = Object.freeze([...values].sort((a, b) => a - b));
  const avg = mean(sorted);
  return Object.freeze({
    lineItem,
    mean: avg,
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    stdDev: stdDev(sorted, avg),
  });
}

function aggregatePeriod(
  fiscalYear: number,
  horizonBand: ForecastHorizonBand,
  samples: readonly PeriodCashFlowSample[],
  rejected: number,
): PeriodCashFlowDistribution {
  const lineItems = Object.freeze({
    revenue: buildLineItemDistribution('revenue', samples.map((row) => row.revenue)),
    grossMargin: buildLineItemDistribution('grossMargin', samples.map((row) => row.grossMargin)),
    operatingMargin: buildLineItemDistribution('operatingMargin', samples.map((row) => row.operatingMargin)),
    tax: buildLineItemDistribution('tax', samples.map((row) => row.taxRate)),
    da: buildLineItemDistribution('da', samples.map((row) => row.da)),
    capex: buildLineItemDistribution('capex', samples.map((row) => row.capex)),
    workingCapital: buildLineItemDistribution('workingCapital', samples.map((row) => row.workingCapitalChange)),
    fcff: buildLineItemDistribution('fcff', samples.map((row) => row.fcff)),
    fcfe: buildLineItemDistribution('fcfe', samples.map((row) => row.fcfe)),
    shareCount: buildLineItemDistribution('shareCount', samples.map((row) => row.shareCount)),
    netDebt: buildLineItemDistribution('netDebt', samples.map((row) => row.netDebt)),
  }) as Readonly<Record<CashFlowLineItem, LineItemDistribution>>;

  return Object.freeze({
    fiscalYear,
    horizonBand,
    lineItems,
    feasiblePathCount: samples.length,
    rejectedPathCount: rejected,
  });
}

export function buildDriverCashFlowForecast(input: BuildDriverForecastInput): DriverForecastResult {
  const { driverModel, fundamentals } = input;
  const rng = createSeededRng(input.randomSeed);
  const features = fundamentals.features;

  const baseRevenue = parseFundamentalMinor(features.revenue.valueMinor, MONEY_SCALE, 10_000);
  const baseGrossMargin = parseFundamentalRatio(features.gross_margin.ratio, 0.55);
  const baseOperatingMargin = parseFundamentalRatio(features.operating_margin.ratio, 0.22);
  const baseCapex = parseFundamentalMinor(features.capex.valueMinor, MONEY_SCALE, baseRevenue * 0.06);
  const baseDa = baseCapex * 0.65;
  const baseShareCount = parseFundamentalMinor(features.share_count.valueMinor, 1, 1_000);
  const baseNetDebt = parseFundamentalMinor(features.net_debt.valueMinor, MONEY_SCALE, baseRevenue * 0.3);
  const baseTax = 0.21;

  const nearBridge = nearTermEarn09Bridge(input.nearTermEarnings, baseRevenue);

  const periodsByYear = new Map<number, PeriodCashFlowSample[]>();
  const rejectedByYear = new Map<number, number>();

  let lastRevenue = baseRevenue;
  const zeroDraw = drawCorrelatedFactors(driverModel.correlation, rng, {});
  const probeTree = evaluateDriverTree(driverModel.revenueDriverTree, zeroDraw, 1);
  const driverRevenueScale = probeTree.value > 0 ? baseRevenue / probeTree.value : 1;
  const consolidatedTree = evaluateDriverTree(driverModel.revenueDriverTree, zeroDraw, driverRevenueScale);

  for (let yearIndex = 0; yearIndex < driverModel.forecastYears; yearIndex += 1) {
    const fiscalYear = new Date(input.asOf).getUTCFullYear() + yearIndex + 1;
    const horizonBand = resolveHorizonBand(
      yearIndex,
      driverModel.nearTermQuarters,
      driverModel.terminal,
      driverModel.forecastYears,
    );
    const yearSamples: PeriodCashFlowSample[] = [];
    let rejected = 0;

    for (let draw = 0; draw < input.sampleCount; draw += 1) {
      let accepted: PeriodCashFlowSample | null = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const factorDraw = drawCorrelatedFactors(driverModel.correlation, rng, {
          revenueGrowth: 0.08,
          grossMargin: 0.04,
          operatingMargin: 0.035,
          capexIntensity: 0.06,
          workingCapitalIntensity: 0.05,
          reinvestment: 0.07,
        });

        const driverGrowth = 0.06 + (factorDraw.revenueGrowth ?? 0);
        const analystGrowth = mediumTermAnalystGrowth(fiscalYear, input.analystRevenueExpectations, lastRevenue);
        const nearGrowth =
          nearBridge.revenueGrowthDelta !== null && yearIndex === 0 ? nearBridge.revenueGrowthDelta : null;

        const blendedGrowth = blendHorizonTargets({
          band: horizonBand,
          weights: driverModel.horizonWeights,
          driverGrowth,
          analystGrowth,
          nearAnchorGrowth: nearGrowth,
        });
        const growth = horizonGrowthPrior(horizonBand, blendedGrowth, driverModel.terminal, yearIndex, driverModel.forecastYears);
        const growthMultiplier = 1 + growth;

        const driverTreeRoot = evaluateDriverTree(
          driverModel.revenueDriverTree,
          factorDraw,
          driverRevenueScale * growthMultiplier,
        );
        let revenue =
          driverTreeRoot.value > 0 ? driverTreeRoot.value : lastRevenue * growthMultiplier;

        if (yearIndex === 0 && nearBridge.revenueGrowthDelta !== null && horizonBand === 'NEAR') {
          revenue = baseRevenue * (1 + nearBridge.revenueGrowthDelta + (factorDraw.revenueGrowth ?? 0) * 0.35);
        }

        let grossMargin = baseGrossMargin + (factorDraw.grossMargin ?? 0);
        let operatingMargin = baseOperatingMargin + (factorDraw.operatingMargin ?? 0);

        if (horizonBand === 'LONG') {
          const t = (yearIndex - (driverModel.forecastYears - driverModel.terminal.convergenceYears)) / driverModel.terminal.convergenceYears;
          operatingMargin =
            operatingMargin * (1 - t) + driverModel.terminal.terminalOperatingMargin * t;
        }

        grossMargin = Math.min(0.95, Math.max(0.05, grossMargin));
        operatingMargin = Math.min(grossMargin - 0.01, Math.max(-0.02, operatingMargin));

        const taxRate = baseTax;
        const da = baseDa * (revenue / baseRevenue);
        const capex =
          revenue *
          (driverModel.terminal.terminalCapexToRevenue +
            (factorDraw.capexIntensity ?? 0) +
            (factorDraw.reinvestment ?? 0) * 0.5);
        const workingCapitalChange =
          revenue *
          (driverModel.terminal.terminalWorkingCapitalToRevenueDelta +
            (factorDraw.workingCapitalIntensity ?? 0));

        const ebit = revenue * operatingMargin;
        const nopat = ebit * (1 - taxRate);
        const fcff = nopat + da - capex - workingCapitalChange;
        const interest = baseNetDebt * 0.04;
        const fcfe = fcff - interest * (1 - taxRate);

        const shareCount = baseShareCount * (1 - 0.01 * Math.max(0, growth));
        const netDebt = baseNetDebt + capex * 0.15 - fcff * 0.35;

        const feasibility = assessEconomicFeasibility({
          revenue,
          grossMargin,
          operatingMargin,
          taxRate,
          da,
          capex,
          workingCapitalChange,
          fcff,
          fcfe,
          shareCount,
          netDebt,
          revenueGrowth: growth,
          factorDraw,
        });

        if (!feasibility.feasible) {
          rejected += 1;
          continue;
        }

        accepted = Object.freeze({
          fiscalYear,
          horizonBand,
          revenue,
          grossMargin,
          operatingMargin,
          taxRate,
          da,
          capex,
          workingCapitalChange,
          fcff,
          fcfe,
          shareCount,
          netDebt,
          driverTreeRoot,
          economicallyFeasible: true as const,
        });
        break;
      }
      if (accepted !== null) {
        yearSamples.push(accepted);
        lastRevenue = accepted.revenue;
      }
    }

    periodsByYear.set(fiscalYear, yearSamples);
    rejectedByYear.set(fiscalYear, rejected);
  }

  const periods: PeriodCashFlowDistribution[] = [];
  for (const [fiscalYear, samples] of periodsByYear.entries()) {
    if (samples.length === 0) {
      continue;
    }
    periods.push(
      aggregatePeriod(fiscalYear, samples[0]!.horizonBand, samples, rejectedByYear.get(fiscalYear) ?? 0),
    );
  }
  periods.sort((a, b) => a.fiscalYear - b.fiscalYear);

  return Object.freeze({
    schema: HELIOS_VAL02_DRIVER_FORECAST_SCHEMA,
    authority: HELIOS_VAL02_DRIVER_FORECAST_AUTHORITY,
    instrumentId: input.instrumentId,
    asOf: input.asOf,
    modelId: driverModel.modelId,
    researchOnly: true as const,
    grantsExecutionAuthority: false as const,
    epsExtrapolationOnly: false as const,
    driverTreesUsed: true,
    horizonBands: Object.freeze(['NEAR', 'MEDIUM', 'LONG']),
    periods: Object.freeze(periods),
    consolidatedDriverTree: consolidatedTree,
    correlationFactors: driverModel.correlation.factors,
    nearTermEarn09Anchored: nearBridge.anchored,
    sampleCount: input.sampleCount,
    disclaimer: 'NOT_INVESTMENT_ADVICE_NOT_EXECUTION_AUTHORITY',
  }) as DriverForecastResult;
}
