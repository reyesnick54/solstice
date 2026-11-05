/**
 * Reject economically impossible driver / cash-flow combinations.
 */

import type { CorrelatedFactorDraw } from './correlations.ts';

export type CashFlowPathCandidate = {
  readonly revenue: number;
  readonly grossMargin: number;
  readonly operatingMargin: number;
  readonly taxRate: number;
  readonly da: number;
  readonly capex: number;
  readonly workingCapitalChange: number;
  readonly fcff: number;
  readonly fcfe: number;
  readonly shareCount: number;
  readonly netDebt: number;
  readonly revenueGrowth: number;
  readonly factorDraw: CorrelatedFactorDraw;
};

export type FeasibilityRejection =
  | 'NEGATIVE_REVENUE'
  | 'MARGIN_OUT_OF_RANGE'
  | 'OPERATING_EXCEEDS_GROSS'
  | 'TAX_OUT_OF_RANGE'
  | 'NEGATIVE_SHARE_COUNT'
  | 'REINVESTMENT_INCONSISTENT_WITH_GROWTH'
  | 'WORKING_CAPITAL_INCONSISTENT_WITH_GROWTH'
  | 'FCFF_FEASIBILITY';

export function assessEconomicFeasibility(
  candidate: CashFlowPathCandidate,
): { readonly feasible: true } | { readonly feasible: false; readonly reason: FeasibilityRejection } {
  if (!(candidate.revenue > 0)) {
    return { feasible: false, reason: 'NEGATIVE_REVENUE' };
  }
  if (
    candidate.grossMargin <= 0.03 ||
    candidate.grossMargin >= 0.98 ||
    candidate.operatingMargin <= -0.05 ||
    candidate.operatingMargin >= candidate.grossMargin - 0.005
  ) {
    return { feasible: false, reason: 'MARGIN_OUT_OF_RANGE' };
  }
  if (candidate.operatingMargin > candidate.grossMargin) {
    return { feasible: false, reason: 'OPERATING_EXCEEDS_GROSS' };
  }
  if (candidate.taxRate < 0 || candidate.taxRate > 0.5) {
    return { feasible: false, reason: 'TAX_OUT_OF_RANGE' };
  }
  if (!(candidate.shareCount > 0)) {
    return { feasible: false, reason: 'NEGATIVE_SHARE_COUNT' };
  }
  const growth = candidate.revenueGrowth;
  if (growth > 0.12) {
    const capexToRevenue = candidate.capex / candidate.revenue;
    const minCapex = 0.02 + growth * 0.25;
    if (capexToRevenue + (candidate.factorDraw.reinvestment ?? 0) * 0.5 < minCapex * 0.85) {
      return { feasible: false, reason: 'REINVESTMENT_INCONSISTENT_WITH_GROWTH' };
    }
    const wcToRevenue = Math.abs(candidate.workingCapitalChange) / candidate.revenue;
    const minWc = 0.005 + growth * 0.12;
    if (wcToRevenue < minWc * 0.7 && growth > 0.18) {
      return { feasible: false, reason: 'WORKING_CAPITAL_INCONSISTENT_WITH_GROWTH' };
    }
  }
  const impliedEbit = candidate.revenue * candidate.operatingMargin;
  const nopat = impliedEbit * (1 - candidate.taxRate);
  const reconstructedFcff = nopat + candidate.da - candidate.capex - candidate.workingCapitalChange;
  if (Math.abs(reconstructedFcff - candidate.fcff) > Math.max(1, Math.abs(candidate.fcff) * 0.05)) {
    return { feasible: false, reason: 'FCFF_FEASIBILITY' };
  }
  if (candidate.fcff < -candidate.revenue * 0.6) {
    return { feasible: false, reason: 'FCFF_FEASIBILITY' };
  }
  if (candidate.fcfe < candidate.fcff - candidate.revenue * 0.15) {
    return { feasible: false, reason: 'FCFF_FEASIBILITY' };
  }
  return { feasible: true };
}
