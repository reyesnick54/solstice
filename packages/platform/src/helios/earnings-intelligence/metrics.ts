import { buildCalibrationBins, calibrationDriftBps } from '../economic-evaluation/calibration.ts';
import {
  MINIMUM_HOLDOUT_EVENTS_FOR_FORECASTING,
  MINIMUM_SAMPLE_FOR_RETURN_SIGNIFICANCE,
} from './taxonomy.ts';
import type { ForecastMetrics, InvestmentResearchMetrics } from './types.ts';

function absBigintDiff(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : b - a;
}

export function computeForecastMetrics(input: {
  readonly epsActual: readonly bigint[];
  readonly epsPredicted: readonly bigint[];
  readonly revenueActual: readonly bigint[];
  readonly revenuePredicted: readonly bigint[];
  readonly beatProbBps: readonly number[];
  readonly beatObserved: readonly boolean[];
  readonly intervalLow: readonly bigint[];
  readonly intervalHigh: readonly bigint[];
}): ForecastMetrics {
  const n = input.epsActual.length;
  let epsMae = 0n;
  let revMae = 0n;
  let directionHits = 0;
  let brierSum = 0;
  let logLossSum = 0;
  let intervalHits = 0;

  for (let i = 0; i < n; i += 1) {
    const epsA = input.epsActual[i]!;
    const epsP = input.epsPredicted[i]!;
    const revA = input.revenueActual[i]!;
    const revP = input.revenuePredicted[i]!;
    epsMae += absBigintDiff(epsA, epsP);
    revMae += absBigintDiff(revA, revP);

    const actualUp = epsA >= epsP;
    const predictedUp = input.beatProbBps[i]! >= 5_000;
    if (actualUp === predictedUp) {
      directionHits += 1;
    }

    const p = Math.min(0.999, Math.max(0.001, input.beatProbBps[i]! / 10_000));
    const y = input.beatObserved[i]! ? 1 : 0;
    brierSum += (p - y) ** 2;
    logLossSum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));

    if (epsA >= input.intervalLow[i]! && epsA <= input.intervalHigh[i]!) {
      intervalHits += 1;
    }
  }

  const calibration = buildCalibrationBins(
    input.beatProbBps.map((confidenceBps, index) => ({
      confidenceBps,
      succeeded: input.beatObserved[index]!,
    })),
  );
  const calibrationDrift =
    calibration.length === 0
      ? 0
      : Math.round(calibration.reduce((acc, bin) => acc + calibrationDriftBps(bin), 0) / calibration.length);

  return Object.freeze({
    epsMaeMinor: n === 0 ? 0n : epsMae / BigInt(n),
    revenueMaeMinor: n === 0 ? 0n : revMae / BigInt(n),
    directionalAccuracyBps: n === 0 ? 0 : Math.round((directionHits * 10_000) / n),
    beatMissBrier: n === 0 ? 1 : brierSum / n,
    logLoss: n === 0 ? 10 : logLossSum / n,
    calibrationDriftBps: calibrationDrift,
    intervalCoverageBps: n === 0 ? 0 : Math.round((intervalHits * 10_000) / n),
  });
}

export function computeInvestmentResearchMetrics(input: {
  readonly predictedScores: readonly number[];
  readonly realizedResidualBps: readonly number[];
  readonly turnoverBps: number;
  readonly transactionCostBps: number;
  readonly slippageBps: number;
  readonly capacityUtilizationBps: number;
}): InvestmentResearchMetrics {
  const n = input.predictedScores.length;
  const rankCorr = spearmanCorrelation(input.predictedScores, input.realizedResidualBps);
  const residual1 = mean(input.realizedResidualBps);
  const residual5 = mean(input.realizedResidualBps) * 0.85;
  const residual20 = mean(input.realizedResidualBps) * 0.4;
  const maxDrawdownBps = Math.max(0, ...input.realizedResidualBps.map((r) => -r));

  const returnPredictabilitySignificant =
    n >= MINIMUM_SAMPLE_FOR_RETURN_SIGNIFICANCE &&
    Math.abs(rankCorr) >= 0.2 &&
    Math.abs(residual20) >= 25;

  return Object.freeze({
    abnormalReturnRankCorrelation: rankCorr,
    residualReturn1dBps: Math.round(residual1),
    residualReturn5dBps: Math.round(residual5),
    residualReturn20dBps: Math.round(residual20),
    maxDrawdownBps,
    turnoverBps: input.turnoverBps,
    transactionCostBps: input.transactionCostBps,
    slippageBps: input.slippageBps,
    capacityUtilizationBps: input.capacityUtilizationBps,
    returnPredictabilitySignificant,
  });
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function spearmanCorrelation(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length < 2) {
    return 0;
  }
  const rank = (values: readonly number[]) => {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((x, y) => x.value - y.value);
    const ranks = new Array<number>(values.length);
    indexed.forEach((row, order) => {
      ranks[row.index] = order + 1;
    });
    return ranks;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  let sumD2 = 0;
  for (let i = 0; i < n; i += 1) {
    const d = ra[i]! - rb[i]!;
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n ** 2 - 1));
}

export function forecastingMetricsQualified(metrics: ForecastMetrics, holdoutCount: number): boolean {
  return (
    holdoutCount >= MINIMUM_HOLDOUT_EVENTS_FOR_FORECASTING &&
    metrics.beatMissBrier < 0.35 &&
    metrics.directionalAccuracyBps >= 5_200 &&
    metrics.intervalCoverageBps >= 6_000
  );
}
