export const ATTRIBUTION_RESULT_KINDS = ['REALIZED', 'UNREALIZED', 'PENDING', 'ESTIMATED'] as const;
export type AttributionResultKind = (typeof ATTRIBUTION_RESULT_KINDS)[number];

export const FEE_CERTAINTY = ['ACTUAL', 'ESTIMATED', 'UNKNOWN'] as const;
export type FeeCertainty = (typeof FEE_CERTAINTY)[number];

export const FEE_TYPES = [
  'COMMISSION',
  'SPREAD',
  'SLIPPAGE',
  'VENUE',
  'CUSTODY',
  'FUNDING',
  'WITHDRAWAL',
  'MANAGEMENT',
  'BORROW',
  'OTHER',
] as const;
export type FeeType = (typeof FEE_TYPES)[number];

export const INCOME_TYPES = ['DIVIDEND', 'INTEREST', 'DISTRIBUTION', 'STAKING', 'OTHER'] as const;
export type IncomeType = (typeof INCOME_TYPES)[number];

export const RESEARCH_COST_CLASSES = [
  'MODEL',
  'MARKET_DATA',
  'TOOL',
  'COMPUTE',
  'OTHER',
] as const;
export type ResearchCostClass = (typeof RESEARCH_COST_CLASSES)[number];

export const COST_BASIS_METHODS = ['FIFO_SIMULATION_ACCOUNTING_METHOD'] as const;
export type CostBasisMethod = (typeof COST_BASIS_METHODS)[number];

export const ATTRIBUTION_RULE_FLAGS = Object.freeze({
  principalDepositsAreNotGrowth: true as const,
  expenseSavingsAreNotInvestmentPnl: true as const,
  unrealizedIsNotAvailableCash: true as const,
  tokenValuesAreNotRealizedProfit: true as const,
  researchEarningsSeparateFromInvestment: true as const,
  paperSeparateFromLiveRealized: true as const,
});
