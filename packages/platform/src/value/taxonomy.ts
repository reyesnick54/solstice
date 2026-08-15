export const ECONOMIC_VALUE_DIMENSIONS = [
  'LIQUIDITY_RESILIENCE',
  'CASH_FLOW_STABILITY',
  'SAVINGS_CAPACITY',
  'DEBT_BURDEN',
  'GOAL_PROGRESS',
  'ECONOMIC_RESILIENCE',
  'OPPORTUNITY_CAPACITY',
  'INCOME_DIVERSIFICATION',
  'FINANCIAL_FRICTION',
  'ECONOMIC_PROGRESS',
  'ATTRIBUTED_VALUE_CREATED',
  'DATA_PROVENANCE_STRENGTH',
] as const;

export type EconomicValueDimensionKind = (typeof ECONOMIC_VALUE_DIMENSIONS)[number];

export const DIMENSION_DEFINITIONS: Readonly<Record<EconomicValueDimensionKind, string>> = {
  LIQUIDITY_RESILIENCE:
    'Liquid reserves relative to known essential monthly obligations. Not a universal emergency-fund standard.',
  CASH_FLOW_STABILITY:
    'Known recurring surplus or deficit from inflows and outflows. Incomplete expense data is not treated as zero.',
  SAVINGS_CAPACITY:
    'Known economic surplus available after recurring obligations. Distinguishes KNOWN, ESTIMATED, and INCOMPLETE inputs.',
  DEBT_BURDEN:
    'Debt-related economic pressure from available balances and servicing facts. Not a lending credit score and not a regulatory DTI claim.',
  GOAL_PROGRESS:
    'Attributable progress toward confirmed Growth Orchestrator / PEG goals. Unrealized market outcomes are not marked achieved.',
  ECONOMIC_RESILIENCE:
    'Versioned combination of reserve coverage, cash-flow capacity, and debt pressure. Thresholds are engineering values, not counsel-confirmed.',
  OPPORTUNITY_CAPACITY:
    'Informational flexibility remaining under the active mandate after floors, obligations, and known debt. Does not authorize movement.',
  INCOME_DIVERSIFICATION:
    'Count of distinct known income sources. Concentration is disclosed; it is not an underwriting factor.',
  FINANCIAL_FRICTION:
    'Known fees and similar frictions relative to known income. Missing fee facts reduce confidence rather than inventing zero friction.',
  ECONOMIC_PROGRESS:
    'Change versus a prior snapshot plus realized attributed benefit. Projected value is excluded. Restated series must be labeled.',
  ATTRIBUTED_VALUE_CREATED:
    'Index mapping of realized Growth Attribution Ledger totals. The index is not a dollar figure; money is reported separately.',
  DATA_PROVENANCE_STRENGTH:
    'Weighted strength of input provenance. Inferred facts cannot silently become authoritative.',
};

export const VALUE_REALIZATION_STATES = [
  'REALIZED',
  'OBSERVED',
  'ESTIMATED',
  'PROJECTED',
  'COUNTERFACTUAL',
] as const;

export type ValueRealizationState = (typeof VALUE_REALIZATION_STATES)[number];

export const ATTRIBUTION_TYPES = [
  'FEE_AVOIDED',
  'SUBSCRIPTION_ELIMINATED',
  'REWARD_CAPTURED',
  'INTEREST_EARNED',
  'DEBT_INTEREST_AVOIDED',
  'FX_COST_AVOIDED',
  'PAYMENT_FEE_REDUCED',
  'IDLE_CASH_YIELD_IMPROVED',
  'OTHER_MEASURABLE_IMPROVEMENT',
] as const;

export type AttributionType = (typeof ATTRIBUTION_TYPES)[number];

export const PRINCIPAL_MOVEMENT_REASONS = [
  'PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT',
  'PRINCIPAL_WITHDRAWAL_IS_NOT_ECONOMIC_IMPROVEMENT',
  'PRINCIPAL_TRANSFER_IS_NOT_ECONOMIC_IMPROVEMENT',
] as const;

export type PrincipalMovementReason = (typeof PRINCIPAL_MOVEMENT_REASONS)[number];

export const RELATED_ATTRIBUTION_TYPES: Readonly<Record<AttributionType, readonly AttributionType[]>> = {
  FEE_AVOIDED: ['PAYMENT_FEE_REDUCED', 'FX_COST_AVOIDED'],
  SUBSCRIPTION_ELIMINATED: [],
  REWARD_CAPTURED: [],
  INTEREST_EARNED: ['IDLE_CASH_YIELD_IMPROVED'],
  DEBT_INTEREST_AVOIDED: [],
  FX_COST_AVOIDED: ['FEE_AVOIDED', 'PAYMENT_FEE_REDUCED'],
  PAYMENT_FEE_REDUCED: ['FEE_AVOIDED', 'FX_COST_AVOIDED'],
  IDLE_CASH_YIELD_IMPROVED: ['INTEREST_EARNED'],
  OTHER_MEASURABLE_IMPROVEMENT: [],
};

export const FORMULA_LIFECYCLES = ['ACTIVE', 'RETIRED', 'EXPERIMENTAL'] as const;
export type FormulaLifecycle = (typeof FORMULA_LIFECYCLES)[number];

export const DATA_COMPLETENESS_STATES = ['SUFFICIENT', 'PARTIAL', 'SPARSE', 'CONFLICTED'] as const;
export type DataCompletenessState = (typeof DATA_COMPLETENESS_STATES)[number];

export const CASH_FLOW_QUALITY_STATES = ['KNOWN', 'ESTIMATED', 'INCOMPLETE'] as const;
export type CashFlowQualityState = (typeof CASH_FLOW_QUALITY_STATES)[number];

export const MEASURE_KINDS = ['INDEX', 'MONEY'] as const;
export type MeasureKind = (typeof MEASURE_KINDS)[number];

export const ATTRIBUTION_SOURCE_SYSTEMS = [
  'GROWTH_ORCHESTRATOR',
  'TREASURY',
  'PAYMENTS',
  'CARDS',
  'LEDGER_INTEREST',
  'USER_DECLARED',
  'OTHER',
] as const;

export type AttributionSourceSystem = (typeof ATTRIBUTION_SOURCE_SYSTEMS)[number];

export const PROTECTED_TRAIT_KEYS = [
  'race',
  'religion',
  'ethnicity',
  'sexualOrientation',
  'sexual_orientation',
  'politicalAffiliation',
  'political_affiliation',
  'disability',
  'medicalCondition',
  'medical_condition',
] as const;

export type ProtectedTraitKey = (typeof PROTECTED_TRAIT_KEYS)[number];

export const PEVE_NOT_HUMAN_WORTH =
  'PEVE measures a person\'s economic system. It is not a measure of human worth, a social-credit score, or a credit underwriting decision.';

export const PEVE_NOT_CREDIT_SCORE =
  'Debt-burden and resilience indexes are engineering measurements. They are not regulatory debt-to-income, credit scores, or eligibility determinations.';

export const PEVE_NOT_EXECUTION =
  'A PEVE index never authorizes execution. Execution still requires ActionIntent, Kernel, and a verified Execution Authority.';
