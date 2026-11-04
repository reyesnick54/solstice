import type { UtcInstant } from '@solstice/domain';
import { growthBps, ratioBps } from './math.ts';
import { EARN06_FORMULA_VERSIONS } from './taxonomy.ts';
import type {
  Earn06QuarterFinancials,
  Earn06QuarterHistory,
  ForensicChangeDetectorResult,
  ForensicHypothesis,
} from './types.ts';

const MATERIAL_DIVERGENCE_BPS = 800n;
const RECEIVABLES_LEAD_BPS = 500n;
const INVENTORY_LEAD_BPS = 700n;
const ONE_TIME_MARGIN_DOMINANCE_BPS = 5_000n;
const BUYBACK_EPS_DOMINANCE_BPS = 6_000n;
const NON_GAAP_SHIFT_BPS = 400n;

function hypothesis(
  hypothesisId: string,
  signalClass: ForensicHypothesis['signalClass'],
  comparisonBasis: ForensicHypothesis['comparisonBasis'],
  summary: string,
  detail: string,
  relatedFeatureIds: ForensicHypothesis['relatedFeatureIds'],
  evidenceRefs: readonly string[],
): ForensicHypothesis {
  return Object.freeze({
    hypothesisId,
    signalClass,
    comparisonBasis,
    summary,
    detail,
    relatedFeatureIds: Object.freeze([...relatedFeatureIds]),
    evidenceRefs: Object.freeze([...evidenceRefs]),
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

function detectAgainstPriorQuarter(history: Earn06QuarterHistory): readonly ForensicHypothesis[] {
  const cur = history.current;
  const prev = history.previousQuarter;
  if (!prev) {
    return Object.freeze([]);
  }
  const found: ForensicHypothesis[] = [];
  const evidence = refs(cur, prev);

  if (cur.revenueMinor != null && prev.revenueMinor != null && cur.accountsReceivableMinor != null && prev.accountsReceivableMinor != null) {
    const revGrowth = growthBps(cur.revenueMinor, prev.revenueMinor);
    const arGrowth = growthBps(cur.accountsReceivableMinor, prev.accountsReceivableMinor);
    if (revGrowth != null && arGrowth != null && revGrowth > 0n && arGrowth - revGrowth >= RECEIVABLES_LEAD_BPS) {
      found.push(
        hypothesis(
          'earn06.hyp.receivables_outrun_revenue_qoq',
          'DIVERGENCE',
          'PREVIOUS_QUARTER',
          'Revenue is accelerating while receivables accelerate materially faster.',
          'Quarter-over-quarter receivable growth exceeds revenue growth by at least 500 bps while revenue growth is positive. Treat as a working-capital collection hypothesis, not a conclusion.',
          ['earn06.receivables_growth', 'earn06.revenue_cash_divergence'],
          evidence,
        ),
      );
    }
  }

  if (cur.netIncomeMinor != null && prev.netIncomeMinor != null && cur.operatingCashFlowMinor != null && prev.operatingCashFlowMinor != null) {
    const niGrowth = growthBps(cur.netIncomeMinor, prev.netIncomeMinor);
    const ocfGrowth = growthBps(cur.operatingCashFlowMinor, prev.operatingCashFlowMinor);
    if (niGrowth != null && ocfGrowth != null && niGrowth > MATERIAL_DIVERGENCE_BPS && ocfGrowth < 0n) {
      found.push(
        hypothesis(
          'earn06.hyp.earnings_up_cash_down_qoq',
          'DIVERGENCE',
          'PREVIOUS_QUARTER',
          'Earnings are growing while operating cash flow deteriorates.',
          'Net income grew quarter-over-quarter while operating cash flow declined. Cash conversion and accrual quality dimensions warrant follow-up.',
          ['earn06.operating_cash_flow_vs_net_income', 'earn06.cash_conversion'],
          evidence,
        ),
      );
    }
  }

  if (
    cur.operatingIncomeMinor != null &&
    prev.operatingIncomeMinor != null &&
    cur.revenueMinor != null &&
    prev.revenueMinor != null &&
    cur.oneTimeItemsMinor != null
  ) {
    const marginDelta =
      ratioBps(cur.operatingIncomeMinor, cur.revenueMinor)! - ratioBps(prev.operatingIncomeMinor, prev.revenueMinor)!;
    const oneTimeShare =
      cur.revenueMinor !== 0n ? ratioBps(cur.oneTimeItemsMinor < 0n ? -cur.oneTimeItemsMinor : cur.oneTimeItemsMinor, cur.revenueMinor) : null;
    if (marginDelta > 0n && oneTimeShare != null && oneTimeShare * marginDelta > ONE_TIME_MARGIN_DOMINANCE_BPS) {
      found.push(
        hypothesis(
          'earn06.hyp.margin_from_one_time_qoq',
          'ANOMALY',
          'PREVIOUS_QUARTER',
          'Margin expansion may be dominated by one-time items.',
          'Operating margin improved quarter-over-quarter while one-time item intensity is large relative to the margin change.',
          ['earn06.one_time_item_intensity', 'earn06.operating_margin_quality'],
          evidence,
        ),
      );
    }
  }

  if (cur.dilutedEpsMinor != null && prev.dilutedEpsMinor != null && cur.shareCountScaled != null && prev.shareCountScaled != null) {
    const epsGrowth = growthBps(cur.dilutedEpsMinor, prev.dilutedEpsMinor);
    const shareChange = growthBps(cur.shareCountScaled, prev.shareCountScaled);
    if (epsGrowth != null && shareChange != null && epsGrowth > 0n && shareChange <= -300n) {
      const dominance = ratioBps(shareChange < 0n ? -shareChange : shareChange, epsGrowth);
      if (dominance != null && dominance >= BUYBACK_EPS_DOMINANCE_BPS) {
        found.push(
          hypothesis(
            'earn06.hyp.eps_from_buybacks_qoq',
            'DIVERGENCE',
            'PREVIOUS_QUARTER',
            'EPS growth may be dominated by share-count reduction.',
            'Diluted EPS rose while shares outstanding fell materially; mechanical EPS lift should be separated from operating improvement.',
            ['earn06.buyback_eps_contribution', 'earn06.share_count_change'],
            evidence,
          ),
        );
      }
    }
  }

  if (cur.nonGaapAdjustmentsMinor != null && prev.nonGaapAdjustmentsMinor != null && cur.revenueMinor != null && prev.revenueMinor != null) {
    const curIntensity = ratioBps(cur.nonGaapAdjustmentsMinor < 0n ? -cur.nonGaapAdjustmentsMinor : cur.nonGaapAdjustmentsMinor, cur.revenueMinor);
    const prevIntensity = ratioBps(
      prev.nonGaapAdjustmentsMinor < 0n ? -prev.nonGaapAdjustmentsMinor : prev.nonGaapAdjustmentsMinor,
      prev.revenueMinor,
    );
    if (curIntensity != null && prevIntensity != null && curIntensity - prevIntensity >= NON_GAAP_SHIFT_BPS) {
      found.push(
        hypothesis(
          'earn06.hyp.non_gaap_reconciliation_shift_qoq',
          'REQUIRES_RESEARCH',
          'PREVIOUS_QUARTER',
          'Non-GAAP reconciliation intensity changed materially.',
          'Non-GAAP adjustment intensity moved sharply versus the prior quarter; reconcile bridge items and management definitions.',
          ['earn06.non_gaap_adjustment_intensity'],
          evidence,
        ),
      );
    }
  }

  if (cur.workingCapitalMinor != null && prev.workingCapitalMinor != null && cur.revenueMinor != null && prev.revenueMinor != null) {
    const wcRelease = prev.workingCapitalMinor - cur.workingCapitalMinor;
    const revUp = cur.revenueMinor > prev.revenueMinor;
    if (wcRelease > 0n && revUp && wcRelease > cur.revenueMinor / 20n) {
      found.push(
        hypothesis(
          'earn06.hyp.unexpected_wc_release_qoq',
          'ANOMALY',
          'PREVIOUS_QUARTER',
          'Unexpected working-capital release alongside revenue growth.',
          'Working capital declined materially while revenue increased — verify whether release is sustainable or timing-related.',
          ['earn06.working_capital_intensity', 'earn06.deferred_revenue_change'],
          evidence,
        ),
      );
    }
  }

  if (cur.inventoryMinor != null && prev.inventoryMinor != null && cur.revenueMinor != null && prev.revenueMinor != null) {
    const invGrowth = growthBps(cur.inventoryMinor, prev.inventoryMinor);
    const revGrowth = growthBps(cur.revenueMinor, prev.revenueMinor);
    if (invGrowth != null && revGrowth != null && invGrowth - revGrowth >= INVENTORY_LEAD_BPS) {
      found.push(
        hypothesis(
          'earn06.hyp.inventory_revenue_divergence_qoq',
          'DIVERGENCE',
          'PREVIOUS_QUARTER',
          'Inventory growth diverges from revenue growth.',
          'Inventory grew faster than revenue quarter-over-quarter — demand versus production timing may explain the gap.',
          ['earn06.inventory_growth', 'earn06.revenue_cash_divergence'],
          evidence,
        ),
      );
    }
  }

  return Object.freeze(found);
}

function detectAgainstPriorYear(history: Earn06QuarterHistory): readonly ForensicHypothesis[] {
  const cur = history.current;
  const yoy = history.sameQuarterPriorYear;
  if (!yoy) {
    return Object.freeze([]);
  }
  const evidence = refs(cur, yoy);
  const found: ForensicHypothesis[] = [];

  if (cur.revenueMinor != null && yoy.revenueMinor != null && cur.accountsReceivableMinor != null && yoy.accountsReceivableMinor != null) {
    const revGrowth = growthBps(cur.revenueMinor, yoy.revenueMinor);
    const arGrowth = growthBps(cur.accountsReceivableMinor, yoy.accountsReceivableMinor);
    if (revGrowth != null && arGrowth != null && revGrowth > 0n && arGrowth - revGrowth >= RECEIVABLES_LEAD_BPS) {
      found.push(
        hypothesis(
          'earn06.hyp.receivables_outrun_revenue_yoy',
          'DIVERGENCE',
          'SAME_QUARTER_PRIOR_YEAR',
          'Year-over-year revenue growth with receivables growing faster.',
          'Same-quarter prior-year comparison shows receivables growth outpacing revenue growth.',
          ['earn06.receivables_growth'],
          evidence,
        ),
      );
    }
  }

  return Object.freeze(found);
}

function detectAgainstTrailingFour(history: Earn06QuarterHistory): readonly ForensicHypothesis[] {
  const trail = history.trailingFourQuarters;
  if (trail.length < 4) {
    return Object.freeze([]);
  }
  const cur = history.current;
  const evidence = refs(cur, ...trail);
  const avgNi =
    trail.reduce((sum, q) => sum + (q.netIncomeMinor ?? 0n), 0n) / BigInt(trail.length);
  const avgOcf =
    trail.reduce((sum, q) => sum + (q.operatingCashFlowMinor ?? 0n), 0n) / BigInt(trail.length);
  if (cur.netIncomeMinor != null && cur.operatingCashFlowMinor != null && avgNi > 0n && cur.netIncomeMinor > avgNi && cur.operatingCashFlowMinor < avgOcf) {
    return Object.freeze([
      hypothesis(
        'earn06.hyp.earnings_up_cash_down_t4q',
        'DIVERGENCE',
        'TRAILING_FOUR_QUARTERS',
        'Current earnings exceed trailing average while cash flow is below trend.',
        'Current-quarter net income is above the trailing-four-quarter average but operating cash flow is below that average.',
        ['earn06.operating_cash_flow_vs_net_income', 'earn06.cash_conversion'],
        evidence,
      ),
    ]);
  }
  return Object.freeze([]);
}

function detectAgainstGuidance(history: Earn06QuarterHistory): readonly ForensicHypothesis[] {
  const guidance = history.guidance;
  if (!guidance || history.current.revenueMinor == null) {
    return Object.freeze([]);
  }
  if (guidance.metricId !== 'revenue') {
    return Object.freeze([]);
  }
  const delta = history.current.revenueMinor - guidance.valueMinor;
  const evidence = refs(history.current);
  if (delta < 0n && -delta > guidance.valueMinor / 20n) {
    return Object.freeze([
      hypothesis(
        'earn06.hyp.revenue_below_guidance',
        'REQUIRES_RESEARCH',
        'MANAGEMENT_GUIDANCE',
        'Reported revenue materially below point-in-time management guidance.',
        'Current revenue trails guided revenue by more than 5%; reconcile guidance assumptions and subsequent updates.',
        ['earn06.revenue_cash_divergence'],
        Object.freeze([...(evidence as string[]), guidance.evidenceRef ?? 'guidance.unspecified'].filter(Boolean)),
      ),
    ]);
  }
  return Object.freeze([]);
}

export function detectForensicAccountingChanges(input: {
  readonly evaluationTime: UtcInstant;
  readonly history: Earn06QuarterHistory;
}): ForensicChangeDetectorResult {
  const hypotheses = Object.freeze([
    ...detectAgainstPriorQuarter(input.history),
    ...detectAgainstPriorYear(input.history),
    ...detectAgainstTrailingFour(input.history),
    ...detectAgainstGuidance(input.history),
  ]);

  return Object.freeze({
    evaluationTime: input.evaluationTime,
    fiscalPeriod: input.history.current.fiscalPeriod,
    formulaVersion: EARN06_FORMULA_VERSIONS.forensicChangeDetector,
    hypotheses,
    grantsExecutionAuthority: false,
  });
}
