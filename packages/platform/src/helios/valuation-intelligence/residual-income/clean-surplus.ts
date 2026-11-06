import type { CleanSurplusAdjustment, ResidualIncomeForecastPeriod } from './types.ts';

export function reconcileCleanSurplus(input: {
  readonly period: ResidualIncomeForecastPeriod;
  readonly beginningBookEquity: number;
  readonly netIncome: number;
  readonly assumeCleanSurplus: boolean;
}): { readonly endingBookEquity: number; readonly adjustment: CleanSurplusAdjustment } {
  const dividends = input.period.dividends ?? 0;
  const shareIssuance = input.period.shareIssuance ?? 0;
  const shareRepurchases = input.period.shareRepurchases ?? 0;
  const oci = input.period.otherComprehensiveIncome ?? 0;
  const fx = input.period.fxTranslation ?? 0;
  const restatement = input.period.restatementAdjustment ?? 0;

  const impliedEnding =
    input.beginningBookEquity +
    input.netIncome -
    dividends -
    shareRepurchases +
    shareIssuance +
    oci +
    fx +
    restatement;

  const reported = input.period.reportedEndingBookEquity ?? null;
  const adjustmentAmount = reported === null ? 0 : reported - impliedEnding;
  const cleanSurplusHolds =
    input.assumeCleanSurplus || reported === null ? adjustmentAmount === 0 : Math.abs(adjustmentAmount) < 1e-6;

  const endingBookEquity = reported ?? impliedEnding;

  return Object.freeze({
    endingBookEquity,
    adjustment: Object.freeze({
      periodIndex: input.period.periodIndex,
      beginningBookEquity: input.beginningBookEquity,
      impliedEndingBookEquity: impliedEnding,
      reportedEndingBookEquity: reported,
      adjustmentAmount,
      cleanSurplusHolds,
      ociAmount: oci,
      fxTranslationAmount: fx,
      restatementAmount: restatement,
      dividends,
      shareIssuance,
      shareRepurchases,
    }),
  });
}
