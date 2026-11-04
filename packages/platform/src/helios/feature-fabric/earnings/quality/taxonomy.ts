/**
 * HELIOS EARN06 — earnings quality and forensic accounting taxonomy.
 */

export const HELIOS_EARN06_EARNINGS_QUALITY_SCHEMA = 'sunrey.helios.earn06.earnings-quality.v1' as const;

export const EARN06_QUALITY_FEATURE_IDS = [
  'earn06.accrual_quality',
  'earn06.cash_conversion',
  'earn06.revenue_cash_divergence',
  'earn06.receivables_growth',
  'earn06.inventory_growth',
  'earn06.deferred_revenue_change',
  'earn06.working_capital_intensity',
  'earn06.operating_cash_flow_vs_net_income',
  'earn06.free_cash_flow_conversion',
  'earn06.sbc_intensity',
  'earn06.buyback_eps_contribution',
  'earn06.share_count_change',
  'earn06.tax_rate_contribution',
  'earn06.gross_margin_quality',
  'earn06.operating_margin_quality',
  'earn06.capex_intensity',
  'earn06.capitalized_cost_signal',
  'earn06.non_gaap_adjustment_intensity',
  'earn06.one_time_item_intensity',
] as const;

export type Earn06QualityFeatureId = (typeof EARN06_QUALITY_FEATURE_IDS)[number];

export const EARN06_FORENSIC_SIGNAL_CLASSES = ['ANOMALY', 'DIVERGENCE', 'REQUIRES_RESEARCH'] as const;
export type Earn06ForensicSignalClass = (typeof EARN06_FORENSIC_SIGNAL_CLASSES)[number];

export const EARN06_COMPARISON_BASES = [
  'PREVIOUS_QUARTER',
  'SAME_QUARTER_PRIOR_YEAR',
  'TRAILING_FOUR_QUARTERS',
  'MANAGEMENT_GUIDANCE',
] as const;
export type Earn06ComparisonBasis = (typeof EARN06_COMPARISON_BASES)[number];

export const EARN06_FORMULA_VERSIONS = Object.freeze({
  accrualQuality: '1.0.0',
  cashConversion: '1.0.0',
  revenueCashDivergence: '1.0.0',
  receivablesGrowth: '1.0.0',
  inventoryGrowth: '1.0.0',
  deferredRevenueChange: '1.0.0',
  workingCapitalIntensity: '1.0.0',
  operatingCashFlowVsNetIncome: '1.0.0',
  freeCashFlowConversion: '1.0.0',
  sbcIntensity: '1.0.0',
  buybackEpsContribution: '1.0.0',
  shareCountChange: '1.0.0',
  taxRateContribution: '1.0.0',
  grossMarginQuality: '1.0.0',
  operatingMarginQuality: '1.0.0',
  capexIntensity: '1.0.0',
  capitalizedCostSignal: '1.0.0',
  nonGaapAdjustmentIntensity: '1.0.0',
  oneTimeItemIntensity: '1.0.0',
  forensicChangeDetector: '1.0.0',
});

export const FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME = 'ForensicAccountingResearchAgent' as const;
