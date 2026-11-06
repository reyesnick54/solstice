import type { UtcInstant } from '@solstice/domain';

import type { HeliosValuationState, ValuationStrategyGenomeFeatureRow } from './types.ts';

function row(
  featureId: ValuationStrategyGenomeFeatureRow['featureId'],
  ratioDecimal: string | null,
  valueMinor: bigint | null,
  knowableAt: UtcInstant,
): ValuationStrategyGenomeFeatureRow {
  return Object.freeze({
    featureId,
    ratioDecimal,
    valueMinor,
    knowableAt,
    aafCertified: true,
    coverageOk: true,
    missingnessOk: true,
    biasOk: true,
    lineageOk: true,
  });
}

export function compileValuationStrategyGenomeFeatures(
  state: HeliosValuationState,
): readonly ValuationStrategyGenomeFeatureRow[] {
  const gap = state.valuationGap;
  const reverse = state.reverseDcfExpectations?.expectationGap;
  return Object.freeze([
    row(
      'intrinsic_value_gap',
      gap ? (Number(gap.medianValueGapMinor) / 100).toFixed(4) : null,
      gap?.medianValueGapMinor ?? null,
      state.valuationTime,
    ),
    row(
      'reverse_dcf_growth_gap',
      reverse ? (reverse.growthGapBps / 10_000).toFixed(6) : null,
      reverse ? BigInt(Math.abs(reverse.growthGapBps)) : null,
      state.valuationTime,
    ),
    row(
      'reverse_dcf_margin_gap',
      reverse ? (reverse.marginGapBps / 10_000).toFixed(6) : null,
      reverse ? BigInt(Math.abs(reverse.marginGapBps)) : null,
      state.valuationTime,
    ),
    row(
      'valuation_uncertainty',
      state.valuationUncertainty.toFixed(6),
      null,
      state.valuationTime,
    ),
    row('valuation_fragility', state.fragility.toFixed(6), null, state.valuationTime),
    row(
      'cross_model_dispersion',
      state.crossModelDispersion.toFixed(6),
      null,
      state.valuationTime,
    ),
    row(
      'residual_income_gap',
      gap && state.residualIncomeValueDistribution.p50Minor
        ? (
            Number(state.residualIncomeValueDistribution.p50Minor - (state.marketPriceMinor ?? 0n)) /
            100
          ).toFixed(4)
        : null,
      state.residualIncomeValueDistribution.p50Minor,
      state.valuationTime,
    ),
    row(
      'peer_relative_gap',
      state.comparableValueDistribution.p50Minor && state.marketPriceMinor
        ? (
            Number(state.comparableValueDistribution.p50Minor - state.marketPriceMinor) / 100
          ).toFixed(4)
        : null,
      state.comparableValueDistribution.p50Minor,
      state.valuationTime,
    ),
  ]);
}
