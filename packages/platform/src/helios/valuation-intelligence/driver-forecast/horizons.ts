/**
 * Near (EARN09), medium (history + analyst + drivers), long (terminal convergence) blending.
 */

import type { ForecastHorizonBand } from './taxonomy.ts';
import type { AnalystRevenueExpectation, HorizonBlendWeights, TerminalAssumptions } from './types.ts';
import type { ProbabilisticEarningsState } from '../../earnings-intelligence/state-estimator/types.ts';
import { earningsDecimalToNumber, parseEarningsDecimal } from '../../earnings-intelligence/state-estimator/numeric.ts';

export function resolveHorizonBand(
  yearIndex: number,
  nearTermQuarters: number,
  terminal: TerminalAssumptions,
  forecastYears: number,
): ForecastHorizonBand {
  const nearTermYears = Math.max(1, Math.ceil(nearTermQuarters / 4));
  if (yearIndex < nearTermYears) {
    return 'NEAR';
  }
  if (yearIndex >= forecastYears - terminal.convergenceYears) {
    return 'LONG';
  }
  return 'MEDIUM';
}

export function horizonGrowthPrior(
  band: ForecastHorizonBand,
  baseGrowth: number,
  terminal: TerminalAssumptions,
  yearIndex: number,
  forecastYears: number,
): number {
  if (band === 'LONG') {
    const blend = (yearIndex - (forecastYears - terminal.convergenceYears)) / terminal.convergenceYears;
    return baseGrowth * (1 - blend) + terminal.terminalRevenueGrowth * blend;
  }
  return baseGrowth;
}

export function nearTermEarn09Bridge(
  nearTermEarnings: ProbabilisticEarningsState | undefined,
  annualRevenueBase: number,
): { readonly revenueGrowthDelta: number | null; readonly anchored: boolean } {
  if (nearTermEarnings === undefined) {
    return { revenueGrowthDelta: null, anchored: false };
  }
  const revenuePoint = parseEarningsDecimal(nearTermEarnings.nextQuarterRevenue.pointEstimate);
  if (!revenuePoint.ok) {
    return { revenueGrowthDelta: null, anchored: false };
  }
  const quarterly = earningsDecimalToNumber(revenuePoint.scaled);
  const impliedAnnual = quarterly * 4;
  const coherent =
    impliedAnnual > 0 &&
    impliedAnnual >= annualRevenueBase * 0.05 &&
    impliedAnnual <= annualRevenueBase * 5;
  if (coherent) {
    return { revenueGrowthDelta: impliedAnnual / annualRevenueBase - 1, anchored: true };
  }
  const beatTilt = nearTermEarnings.beatProbability.probability - 0.5;
  const revenueBeatTilt = nearTermEarnings.revenueBeatProbability.probability - 0.5;
  const marginTilt = nearTermEarnings.marginExpansionProbability.probability - 0.5;
  const growthDelta = Math.max(
    -0.12,
    Math.min(0.18, beatTilt * 0.08 + revenueBeatTilt * 0.1 + marginTilt * 0.02),
  );
  return { revenueGrowthDelta: growthDelta, anchored: true };
}

export function mediumTermAnalystGrowth(
  fiscalYear: number,
  analyst: readonly AnalystRevenueExpectation[] | undefined,
  priorRevenue: number,
): number | null {
  if (analyst === undefined || analyst.length === 0 || !(priorRevenue > 0)) {
    return null;
  }
  const row = analyst.find((entry) => entry.fiscalYear === fiscalYear);
  if (row === undefined) {
    return null;
  }
  return row.revenuePoint / priorRevenue - 1;
}

export function blendHorizonTargets(input: {
  readonly band: ForecastHorizonBand;
  readonly weights: HorizonBlendWeights;
  readonly driverGrowth: number;
  readonly analystGrowth: number | null;
  readonly nearAnchorGrowth: number | null;
}): number {
  const near = input.nearAnchorGrowth ?? input.driverGrowth;
  const medium = input.analystGrowth ?? input.driverGrowth;
  const long = input.driverGrowth * 0.85;
  const weightSum = input.weights.NEAR + input.weights.MEDIUM + input.weights.LONG;
  const wNear = input.weights.NEAR / weightSum;
  const wMedium = input.weights.MEDIUM / weightSum;
  const wLong = input.weights.LONG / weightSum;
  if (input.band === 'NEAR') {
    return wNear * near + wMedium * medium * 0.35 + wLong * long * 0.1;
  }
  if (input.band === 'MEDIUM') {
    return wNear * near * 0.25 + wMedium * medium + wLong * long * 0.35;
  }
  return wNear * near * 0.1 + wMedium * medium * 0.35 + wLong * long;
}
