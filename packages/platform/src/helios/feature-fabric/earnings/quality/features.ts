import type { UtcInstant } from '@solstice/domain';
import { EARN06_FORMULA_VERSIONS } from './taxonomy.ts';
import { absBig, growthBps, marginBps, maxKnowableAt, ratioBps } from './math.ts';
import type {
  Earn06ComputedFeature,
  Earn06FeatureQuality,
  Earn06ManagementGuidance,
  Earn06QuarterFinancials,
  Earn06QuarterHistory,
} from './types.ts';

function feature(
  featureId: Earn06ComputedFeature['featureId'],
  formulaVersion: string,
  valueMinor: bigint | null,
  valueText: string | null,
  knowableAt: UtcInstant,
  quality: Earn06FeatureQuality,
  observationRefs: readonly string[],
): Earn06ComputedFeature {
  return Object.freeze({
    featureId,
    formulaVersion,
    valueMinor,
    valueText,
    knowableAt,
    quality,
    observationRefs: Object.freeze([...observationRefs]),
    grantsExecutionAuthority: false,
  });
}

function refs(...quarters: readonly (Earn06QuarterFinancials | null | undefined)[]): readonly string[] {
  const out: string[] = [];
  for (const q of quarters) {
    if (!q) continue;
    out.push(...q.evidenceRefs);
  }
  return Object.freeze([...new Set(out)]);
}

function knowableFrom(history: Earn06QuarterHistory, evaluationTime: UtcInstant): UtcInstant {
  const times = [
    history.current.knowableAt,
    history.previousQuarter?.knowableAt,
    history.sameQuarterPriorYear?.knowableAt,
    ...history.trailingFourQuarters.map((q) => q.knowableAt),
    history.guidance?.knowableAt,
  ];
  return maxKnowableAt(times, evaluationTime) as UtcInstant;
}

function priorOrNull<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

export function computeEarn06QualityFeatures(input: {
  readonly evaluationTime: UtcInstant;
  readonly history: Earn06QuarterHistory;
}): readonly Earn06ComputedFeature[] {
  const { history, evaluationTime } = input;
  const cur = history.current;
  const prev = history.previousQuarter;
  const yoy = history.sameQuarterPriorYear;
  const knowableAt = knowableFrom(history, evaluationTime);
  const observationRefs = refs(cur, prev, yoy);

  const revenue = cur.revenueMinor;
  const ni = cur.netIncomeMinor;
  const ocf = cur.operatingCashFlowMinor;
  const fcf = cur.freeCashFlowMinor ?? (ocf != null && cur.capexMinor != null ? ocf - cur.capexMinor : null);

  const accrualNumerator = ni != null && ocf != null ? ni - ocf : null;
  const accrualQuality =
    accrualNumerator != null && revenue != null && revenue !== 0n
      ? ratioBps(accrualNumerator, revenue)
      : null;

  const cashConversion = ni != null && ni !== 0n && ocf != null ? ratioBps(ocf, ni) : null;

  const revenueGrowth = revenue != null && prev?.revenueMinor != null ? growthBps(revenue, prev.revenueMinor) : null;
  const ocfGrowth =
    ocf != null && prev?.operatingCashFlowMinor != null ? growthBps(ocf, prev.operatingCashFlowMinor) : null;
  const revenueCashDivergence =
    revenueGrowth != null && ocfGrowth != null ? revenueGrowth - ocfGrowth : null;

  const receivablesGrowth =
    cur.accountsReceivableMinor != null && prev?.accountsReceivableMinor != null
      ? growthBps(cur.accountsReceivableMinor, prev.accountsReceivableMinor)
      : null;

  const inventoryGrowth =
    cur.inventoryMinor != null && prev?.inventoryMinor != null
      ? growthBps(cur.inventoryMinor, prev.inventoryMinor)
      : null;

  const deferredRevenueChange =
    cur.deferredRevenueMinor != null && prev?.deferredRevenueMinor != null
      ? cur.deferredRevenueMinor - prev.deferredRevenueMinor
      : null;

  const workingCapitalIntensity =
    cur.workingCapitalMinor != null && revenue != null && revenue !== 0n
      ? ratioBps(cur.workingCapitalMinor, revenue)
      : null;

  const ocfVsNiSpread = ni != null && ocf != null ? ocf - ni : null;

  const fcfConversion = ni != null && ni !== 0n && fcf != null ? ratioBps(fcf, ni) : null;

  const sbcIntensity = cur.sbcMinor != null && revenue != null && revenue !== 0n ? ratioBps(cur.sbcMinor, revenue) : null;

  const shareCountChange =
    cur.shareCountScaled != null && prev?.shareCountScaled != null
      ? growthBps(cur.shareCountScaled, prev.shareCountScaled)
      : null;

  const epsGrowth =
    cur.dilutedEpsMinor != null && prev?.dilutedEpsMinor != null && prev.dilutedEpsMinor !== 0n
      ? growthBps(cur.dilutedEpsMinor, prev.dilutedEpsMinor)
      : null;
  const buybackEpsContribution =
    epsGrowth != null && shareCountChange != null && shareCountChange < 0n
      ? ratioBps(absBig(shareCountChange), absBig(epsGrowth))
      : null;

  const taxRateContribution =
    cur.effectiveTaxRateBps != null && prev?.effectiveTaxRateBps != null
      ? cur.effectiveTaxRateBps - prev.effectiveTaxRateBps
      : null;

  const grossMarginQuality =
    cur.grossProfitMinor != null && revenue != null ? marginBps(cur.grossProfitMinor, revenue) : null;

  const operatingMarginQuality =
    cur.operatingIncomeMinor != null && revenue != null ? marginBps(cur.operatingIncomeMinor, revenue) : null;

  const capexIntensity = cur.capexMinor != null && revenue != null && revenue !== 0n ? ratioBps(cur.capexMinor, revenue) : null;

  const capitalizedCostSignal =
    cur.capitalizedCostsMinor != null && revenue != null && revenue !== 0n
      ? ratioBps(cur.capitalizedCostsMinor, revenue)
      : null;

  const nonGaapIntensity =
    cur.nonGaapAdjustmentsMinor != null && revenue != null && revenue !== 0n
      ? ratioBps(absBig(cur.nonGaapAdjustmentsMinor), revenue)
      : null;

  const oneTimeIntensity =
    cur.oneTimeItemsMinor != null && revenue != null && revenue !== 0n
      ? ratioBps(absBig(cur.oneTimeItemsMinor), revenue)
      : null;

  const qualityFor = (value: bigint | null): Earn06FeatureQuality =>
    value === null ? 'DEGRADED_MISSING_INPUT' : 'VALID';

  return Object.freeze([
    feature(
      'earn06.accrual_quality',
      EARN06_FORMULA_VERSIONS.accrualQuality,
      accrualQuality,
      accrualQuality != null ? 'ACCRUAL_TO_REVENUE_BPS' : null,
      knowableAt,
      qualityFor(accrualQuality),
      observationRefs,
    ),
    feature(
      'earn06.cash_conversion',
      EARN06_FORMULA_VERSIONS.cashConversion,
      cashConversion,
      cashConversion != null ? 'OCF_TO_NI_BPS' : null,
      knowableAt,
      qualityFor(cashConversion),
      observationRefs,
    ),
    feature(
      'earn06.revenue_cash_divergence',
      EARN06_FORMULA_VERSIONS.revenueCashDivergence,
      revenueCashDivergence,
      revenueCashDivergence != null ? 'REV_GROWTH_MINUS_OCF_GROWTH_BPS' : null,
      knowableAt,
      qualityFor(revenueCashDivergence),
      observationRefs,
    ),
    feature(
      'earn06.receivables_growth',
      EARN06_FORMULA_VERSIONS.receivablesGrowth,
      receivablesGrowth,
      receivablesGrowth != null ? 'QOQ_BPS' : null,
      knowableAt,
      qualityFor(receivablesGrowth),
      observationRefs,
    ),
    feature(
      'earn06.inventory_growth',
      EARN06_FORMULA_VERSIONS.inventoryGrowth,
      inventoryGrowth,
      inventoryGrowth != null ? 'QOQ_BPS' : null,
      knowableAt,
      qualityFor(inventoryGrowth),
      observationRefs,
    ),
    feature(
      'earn06.deferred_revenue_change',
      EARN06_FORMULA_VERSIONS.deferredRevenueChange,
      deferredRevenueChange,
      deferredRevenueChange != null ? 'MINOR_UNITS_DELTA' : null,
      knowableAt,
      deferredRevenueChange != null ? 'VALID' : 'DEGRADED_MISSING_INPUT',
      observationRefs,
    ),
    feature(
      'earn06.working_capital_intensity',
      EARN06_FORMULA_VERSIONS.workingCapitalIntensity,
      workingCapitalIntensity,
      workingCapitalIntensity != null ? 'WC_TO_REVENUE_BPS' : null,
      knowableAt,
      qualityFor(workingCapitalIntensity),
      observationRefs,
    ),
    feature(
      'earn06.operating_cash_flow_vs_net_income',
      EARN06_FORMULA_VERSIONS.operatingCashFlowVsNetIncome,
      ocfVsNiSpread,
      ocfVsNiSpread != null ? 'OCF_MINUS_NI_MINOR' : null,
      knowableAt,
      ocfVsNiSpread != null ? 'VALID' : 'DEGRADED_MISSING_INPUT',
      observationRefs,
    ),
    feature(
      'earn06.free_cash_flow_conversion',
      EARN06_FORMULA_VERSIONS.freeCashFlowConversion,
      fcfConversion,
      fcfConversion != null ? 'FCF_TO_NI_BPS' : null,
      knowableAt,
      qualityFor(fcfConversion),
      observationRefs,
    ),
    feature(
      'earn06.sbc_intensity',
      EARN06_FORMULA_VERSIONS.sbcIntensity,
      sbcIntensity,
      sbcIntensity != null ? 'SBC_TO_REVENUE_BPS' : null,
      knowableAt,
      qualityFor(sbcIntensity),
      observationRefs,
    ),
    feature(
      'earn06.buyback_eps_contribution',
      EARN06_FORMULA_VERSIONS.buybackEpsContribution,
      buybackEpsContribution,
      buybackEpsContribution != null ? 'SHARE_REDUCTION_SHARE_OF_EPS_GROWTH_BPS' : null,
      knowableAt,
      qualityFor(buybackEpsContribution),
      observationRefs,
    ),
    feature(
      'earn06.share_count_change',
      EARN06_FORMULA_VERSIONS.shareCountChange,
      shareCountChange,
      shareCountChange != null ? 'QOQ_BPS' : null,
      knowableAt,
      qualityFor(shareCountChange),
      observationRefs,
    ),
    feature(
      'earn06.tax_rate_contribution',
      EARN06_FORMULA_VERSIONS.taxRateContribution,
      taxRateContribution,
      taxRateContribution != null ? 'EFFECTIVE_RATE_DELTA_BPS' : null,
      knowableAt,
      taxRateContribution != null ? 'VALID' : 'DEGRADED_MISSING_INPUT',
      observationRefs,
    ),
    feature(
      'earn06.gross_margin_quality',
      EARN06_FORMULA_VERSIONS.grossMarginQuality,
      grossMarginQuality,
      grossMarginQuality != null ? 'GROSS_MARGIN_BPS' : null,
      knowableAt,
      qualityFor(grossMarginQuality),
      observationRefs,
    ),
    feature(
      'earn06.operating_margin_quality',
      EARN06_FORMULA_VERSIONS.operatingMarginQuality,
      operatingMarginQuality,
      operatingMarginQuality != null ? 'OPERATING_MARGIN_BPS' : null,
      knowableAt,
      qualityFor(operatingMarginQuality),
      observationRefs,
    ),
    feature(
      'earn06.capex_intensity',
      EARN06_FORMULA_VERSIONS.capexIntensity,
      capexIntensity,
      capexIntensity != null ? 'CAPEX_TO_REVENUE_BPS' : null,
      knowableAt,
      qualityFor(capexIntensity),
      observationRefs,
    ),
    feature(
      'earn06.capitalized_cost_signal',
      EARN06_FORMULA_VERSIONS.capitalizedCostSignal,
      capitalizedCostSignal,
      capitalizedCostSignal != null ? 'CAPITALIZED_TO_REVENUE_BPS' : null,
      knowableAt,
      qualityFor(capitalizedCostSignal),
      observationRefs,
    ),
    feature(
      'earn06.non_gaap_adjustment_intensity',
      EARN06_FORMULA_VERSIONS.nonGaapAdjustmentIntensity,
      nonGaapIntensity,
      nonGaapIntensity != null ? 'NON_GAAP_TO_REVENUE_BPS' : null,
      knowableAt,
      qualityFor(nonGaapIntensity),
      observationRefs,
    ),
    feature(
      'earn06.one_time_item_intensity',
      EARN06_FORMULA_VERSIONS.oneTimeItemIntensity,
      oneTimeIntensity,
      oneTimeIntensity != null ? 'ONE_TIME_TO_REVENUE_BPS' : null,
      knowableAt,
      qualityFor(oneTimeIntensity),
      observationRefs,
    ),
  ]);
}

export function filterKnowableQuarter(
  quarter: Earn06QuarterFinancials,
  evaluationTime: UtcInstant,
): Earn06QuarterFinancials | null {
  if (Date.parse(quarter.knowableAt) > Date.parse(evaluationTime)) {
    return null;
  }
  return quarter;
}

export function buildQuarterHistoryAt(input: {
  readonly evaluationTime: UtcInstant;
  readonly current: Earn06QuarterFinancials;
  readonly previousQuarter?: Earn06QuarterFinancials | null;
  readonly sameQuarterPriorYear?: Earn06QuarterFinancials | null;
  readonly trailingFourQuarters?: readonly Earn06QuarterFinancials[];
  readonly guidance?: Earn06ManagementGuidance | null;
}): Earn06QuarterHistory | null {
  const current = filterKnowableQuarter(input.current, input.evaluationTime);
  if (!current) {
    return null;
  }
  return Object.freeze({
    current,
    previousQuarter: priorOrNull(input.previousQuarter && filterKnowableQuarter(input.previousQuarter, input.evaluationTime)),
    sameQuarterPriorYear: priorOrNull(
      input.sameQuarterPriorYear && filterKnowableQuarter(input.sameQuarterPriorYear, input.evaluationTime),
    ),
    trailingFourQuarters: Object.freeze(
      (input.trailingFourQuarters ?? [])
        .map((q) => filterKnowableQuarter(q, input.evaluationTime))
        .filter((q): q is Earn06QuarterFinancials => q != null),
    ),
    guidance:
      input.guidance && Date.parse(input.guidance.knowableAt) <= Date.parse(input.evaluationTime)
        ? input.guidance
        : null,
  });
}
