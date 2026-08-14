/**
 * Growth Attribution Ledger — 15 typed sources and 4 realization classes.
 *
 * Cost-avoided items are NEVER income.
 * Unrealized is NEVER withdrawable cash.
 * There is no percentage-return, blended-yield, or growth-rate field.
 */

export const GROWTH_SOURCES = [
  'INTEREST_INCOME',
  'DIVIDEND_INCOME',
  'REALIZED_INVESTMENT_GAIN',
  'UNREALIZED_MARK_TO_MARKET',
  'CASHBACK',
  'CARD_REWARD_PENDING',
  'MERCHANT_EXCHANGE_SAVING',
  'SUBSCRIPTION_CANCELLATION',
  'FEE_WAIVER',
  'DEBT_INTEREST_AVOIDED',
  'OPPORTUNITY_COMPENSATION',
  'RESEARCH_COMPENSATION',
  'BILL_PRICE_INCREASE_AVOIDED',
  'PYR_REWARD',
  'DATA_EARNINGS',
] as const;

export type GrowthSource = (typeof GROWTH_SOURCES)[number];

export const REALIZATION_CLASSES = [
  'SETTLED_CASH',
  'UNREALIZED',
  'COST_AVOIDED',
  'PENDING',
] as const;

export type RealizationClass = (typeof REALIZATION_CLASSES)[number];

export const GROWTH_SOURCE_COUNT = 15 as const;
export const REALIZATION_CLASS_COUNT = 4 as const;

/**
 * Canonical realization class for each source. Recording may only use this
 * class (or a documented promotion PENDING → SETTLED_CASH for compensation).
 */
export const CANONICAL_REALIZATION: {
  readonly [S in GrowthSource]: RealizationClass;
} = {
  INTEREST_INCOME: 'SETTLED_CASH',
  DIVIDEND_INCOME: 'SETTLED_CASH',
  REALIZED_INVESTMENT_GAIN: 'SETTLED_CASH',
  UNREALIZED_MARK_TO_MARKET: 'UNREALIZED',
  CASHBACK: 'SETTLED_CASH',
  CARD_REWARD_PENDING: 'PENDING',
  MERCHANT_EXCHANGE_SAVING: 'COST_AVOIDED',
  SUBSCRIPTION_CANCELLATION: 'COST_AVOIDED',
  FEE_WAIVER: 'COST_AVOIDED',
  DEBT_INTEREST_AVOIDED: 'COST_AVOIDED',
  OPPORTUNITY_COMPENSATION: 'PENDING',
  RESEARCH_COMPENSATION: 'PENDING',
  BILL_PRICE_INCREASE_AVOIDED: 'COST_AVOIDED',
  PYR_REWARD: 'SETTLED_CASH',
  DATA_EARNINGS: 'SETTLED_CASH',
};

export const SETTLED_CASH_SOURCES: readonly GrowthSource[] = [
  'INTEREST_INCOME',
  'DIVIDEND_INCOME',
  'REALIZED_INVESTMENT_GAIN',
  'CASHBACK',
  'PYR_REWARD',
  'DATA_EARNINGS',
];

export const COST_AVOIDED_SOURCES: readonly GrowthSource[] = [
  'MERCHANT_EXCHANGE_SAVING',
  'SUBSCRIPTION_CANCELLATION',
  'FEE_WAIVER',
  'DEBT_INTEREST_AVOIDED',
  'BILL_PRICE_INCREASE_AVOIDED',
];

export function isGrowthSource(value: unknown): value is GrowthSource {
  return typeof value === 'string' && (GROWTH_SOURCES as readonly string[]).includes(value);
}

export function isRealizationClass(value: unknown): value is RealizationClass {
  return (
    typeof value === 'string' &&
    (REALIZATION_CLASSES as readonly string[]).includes(value)
  );
}

export function isCostAvoided(source: GrowthSource): boolean {
  return CANONICAL_REALIZATION[source] === 'COST_AVOIDED';
}

export function isUnrealized(source: GrowthSource): boolean {
  return CANONICAL_REALIZATION[source] === 'UNREALIZED';
}

export type GrowthPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'LIFETIME';
