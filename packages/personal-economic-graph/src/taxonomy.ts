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
  'HOME_PURCHASE',
  'RETIREMENT',
  'EDUCATION',
  'TRAVEL',
  'DEBT_REDUCTION',
  'TARGET_LIQUIDITY',
  'OTHER',
] as const;

export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_STATUSES = ['ACTIVE', 'ACHIEVED', 'PAUSED', 'CANCELLED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const HOLDING_KINDS = ['SOLSTICE_HOLDING', 'USER_DECLARED'] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

export const ASSET_KINDS = ['HOME', 'VEHICLE', 'EXTERNAL_BROKERAGE', 'CASH', 'OTHER'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const LIABILITY_KINDS = ['MORTGAGE', 'STUDENT_LOAN', 'OTHER'] as const;
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
