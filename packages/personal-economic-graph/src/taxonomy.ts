export const ECONOMIC_NODE_KINDS = [
  'PERSON',
  'ACCOUNT',
  'INCOME_SOURCE',
  'EXPENSE',
  'MERCHANT',
  'SUBSCRIPTION',
  'DEBT',
  'ASSET',
  'LIABILITY',
  'INVESTMENT',
  'INSURANCE',
  'TAX_OBLIGATION',
  'REWARD',
  'GOAL',
  'BENEFIT',
  'CASH_FLOW',
  'DATA_ASSET',
  'ECONOMIC_OPPORTUNITY',
  'RISK_PROFILE',
  'PREFERENCE',
  'RESTRICTION',
  'HOUSEHOLD_OBLIGATION',
  'DIGITAL_ASSET',
] as const;

export type EconomicNodeKind = (typeof ECONOMIC_NODE_KINDS)[number];

export const ECONOMIC_EDGE_KINDS = [
  'OWNS',
  'RECEIVES_FROM',
  'PAYS_TO',
  'OWES',
  'FUNDS',
  'HOLDS',
  'SUBSCRIBES_TO',
  'INSURED_BY',
  'INVESTED_IN',
  'CONTRIBUTES_TO',
  'ASSOCIATED_WITH',
  'SUPPORTS_GOAL',
  'GENERATES_INCOME',
  'INCURS_COST',
  'DERIVED_FROM',
  'RESULTED_IN',
] as const;

export type EconomicEdgeKind = (typeof ECONOMIC_EDGE_KINDS)[number];

export const INCOME_KINDS = [
  'SALARY',
  'FREELANCE',
  'BENEFITS',
  'INVESTMENT_INCOME',
  'BUSINESS_DISTRIBUTION',
  'OTHER',
] as const;

export type IncomeKind = (typeof INCOME_KINDS)[number];

export const GOAL_KINDS = [
  'EMERGENCY_RESERVE',
  'EMERGENCY_FUND',
  'HOME_PURCHASE',
  'HOME',
  'RETIREMENT',
  'EDUCATION',
  'TRAVEL',
  'BUSINESS',
  'WEALTH_TARGET',
  'DEBT_REDUCTION',
  'TARGET_LIQUIDITY',
  'CUSTOM',
  'OTHER',
] as const;

export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_STATUSES = ['ACTIVE', 'ACHIEVED', 'PAUSED', 'CANCELLED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const HOLDING_KINDS = ['SOLSTICE_HOLDING', 'USER_DECLARED'] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

export const ASSET_KINDS = [
  'HOME',
  'VEHICLE',
  'EXTERNAL_BROKERAGE',
  'CASH',
  'REAL_ESTATE',
  'DIGITAL_ASSET',
  'OTHER',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const LIABILITY_KINDS = ['MORTGAGE', 'STUDENT_LOAN', 'CREDIT', 'LOAN', 'CREDIT_CARD', 'OTHER'] as const;
export type LiabilityKind = (typeof LIABILITY_KINDS)[number];

export const DEBT_KINDS = ['LOAN', 'MORTGAGE', 'STUDENT_LOAN', 'CREDIT', 'OTHER'] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

export const RECURRING_CADENCES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export const ACTIVITY_CLASSIFICATIONS = [
  'UNKNOWN',
  'SALARY',
  'FREELANCE',
  'BENEFITS',
  'INVESTMENT_INCOME',
  'BUSINESS_DISTRIBUTION',
  'RENT',
  'SUBSCRIPTION',
  'LOAN_PAYMENT',
  'INSURANCE_PAYMENT',
  'TRANSFER',
  'CARD_SPEND',
  'FEE',
  'INTEREST',
  'PAYMENT',
] as const;

export type ActivityClassification = (typeof ACTIVITY_CLASSIFICATIONS)[number];

export const OPPORTUNITY_KINDS = [
  'REDUCE_FEE',
  'CANCEL_UNUSED_SUBSCRIPTION',
  'MOVE_IDLE_CASH',
  'REFINANCE_DEBT',
  'CAPTURE_REWARD',
  'INVEST_SURPLUS',
  'TAX_OPTIMIZATION',
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const CANONICAL_REF_SYSTEMS = [
  'ACCOUNT',
  'PAYMENT',
  'CARD',
  'LEDGER_JOURNAL',
  'IDENTITY',
  'BENEFICIARY',
  'CUSTOMER',
  'USER_DECLARATION',
  'PERSONAL_DATA_VAULT',
  'INVESTMENT',
  'SUITABILITY',
] as const;

export type CanonicalRefSystem = (typeof CANONICAL_REF_SYSTEMS)[number];

export type CanonicalRef = {
  readonly system: CanonicalRefSystem;
  readonly id: string;
};

export type CounterpartKind = 'MERCHANT' | 'BENEFICIARY' | 'EMPLOYER' | 'LANDLORD' | 'LENDER' | 'ACCOUNT' | 'OTHER';

export type Counterpart = {
  readonly kind: CounterpartKind;
  readonly ref: string;
  readonly label?: string;
};

export const FACT_KINDS = ['FACT', 'USER_DECLARATION', 'DERIVED_INSIGHT', 'AI_INFERENCE'] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const VERIFICATION_STATES = [
  'UNVERIFIED',
  'USER_DECLARED',
  'SOURCE_VERIFIED',
  'LEDGER_BACKED',
  'CONFLICTED',
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const INSIGHT_TYPES = [
  'HIGH_IDLE_CASH',
  'INSUFFICIENT_EMERGENCY_RESERVE',
  'HIGH_CONCENTRATION',
  'LARGE_RECURRING_EXPENSE',
  'CASH_FLOW_DEFICIT',
  'UNUSED_RECURRING_SURPLUS',
  'GOAL_FUNDING_GAP',
  'CURRENCY_CONCENTRATION',
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const INSIGHT_SEVERITIES = ['INFO', 'WATCH', 'ATTENTION', 'HIGH'] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

export const RISK_TOLERANCE_LEVELS = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const;
export type RiskToleranceLevel = (typeof RISK_TOLERANCE_LEVELS)[number];

export const RISK_CAPACITY_LEVELS = ['CONSTRAINED', 'LIMITED', 'ADEQUATE', 'STRONG'] as const;
export type RiskCapacityLevel = (typeof RISK_CAPACITY_LEVELS)[number];

export const TIME_HORIZON_BANDS = ['NEAR_TERM', 'MEDIUM', 'LONG'] as const;
export type TimeHorizonBand = (typeof TIME_HORIZON_BANDS)[number];

export const LIQUIDITY_NEED_LEVELS = ['IMMEDIATE', 'ELEVATED', 'MODERATE', 'LOW'] as const;
export type LiquidityNeedLevel = (typeof LIQUIDITY_NEED_LEVELS)[number];

export const INVESTMENT_EXPERIENCE_LEVELS = ['NONE', 'LIMITED', 'INTERMEDIATE', 'EXPERIENCED'] as const;
export type InvestmentExperienceLevel = (typeof INVESTMENT_EXPERIENCE_LEVELS)[number];

export const LOSS_SENSITIVITY_LEVELS = ['VERY_HIGH', 'HIGH', 'MODERATE', 'LOW'] as const;
export type LossSensitivityLevel = (typeof LOSS_SENSITIVITY_LEVELS)[number];

export const CONCENTRATION_LEVELS = ['DIVERSIFIED', 'MODERATE', 'CONCENTRATED', 'HIGHLY_CONCENTRATED'] as const;
export type ConcentrationLevel = (typeof CONCENTRATION_LEVELS)[number];

export const PRODUCT_ELIGIBILITY_STATES = ['ELIGIBLE_SIMULATION', 'RESTRICTED', 'UNKNOWN_RESEARCH_REQUIRED'] as const;
export type ProductEligibilityState = (typeof PRODUCT_ELIGIBILITY_STATES)[number];

export const GROW_DATA_CATEGORIES = [
  'CASH_POSITION',
  'INVESTMENT_POSITION',
  'DECLARED_ASSET',
  'DECLARED_LIABILITY',
  'INCOME',
  'EXPENSE',
  'GOAL',
  'RISK_PROFILE',
  'PREFERENCE',
  'INSIGHT',
  'CASH_FLOW',
  'TAX_CONTEXT',
] as const;
export type GrowDataCategory = (typeof GROW_DATA_CATEGORIES)[number];

export const PEG_PERSONA_IDS = [
  'NEW_USER',
  'HEALTHY_SAVER',
  'HIGH_IDLE_CASH',
  'HIGH_SPENDER',
  'INVESTOR',
  'MULTI_CURRENCY_USER',
  'GOAL_ORIENTED_USER',
  'LIQUIDITY_CONSTRAINED_USER',
  'HIGH_CONCENTRATION_USER',
] as const;
export type PegPersonaId = (typeof PEG_PERSONA_IDS)[number];

export type SerializedMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export function isEconomicNodeKind(value: string): value is EconomicNodeKind {
  return (ECONOMIC_NODE_KINDS as readonly string[]).includes(value);
}

export function isEconomicEdgeKind(value: string): value is EconomicEdgeKind {
  return (ECONOMIC_EDGE_KINDS as readonly string[]).includes(value);
}
