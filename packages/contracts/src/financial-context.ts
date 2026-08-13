import type { Money } from './money.ts';
import type { ProductAccountClass } from './account-class.ts';
import type { AccountId, CustomerId } from './ids.ts';
import type { DataCategory } from './proposal-types.ts';
import type { UtcInstant } from './time.ts';

export type TransactionDirection = 'INFLOW' | 'OUTFLOW';

export type ContextTransaction = {
  readonly id: string;
  readonly accountId: AccountId;
  readonly accountClass: ProductAccountClass;
  readonly amount: Money;
  readonly direction: TransactionDirection;
  readonly merchantName: string;
  readonly occurredAt: UtcInstant;
  readonly recurringGroupId: string | null;
};

export type RecurringPattern = {
  readonly groupId: string;
  readonly merchantName: string;
  readonly typicalAmount: Money;
  readonly cadence: 'WEEKLY' | 'MONTHLY' | 'ANNUAL';
  readonly lastSeenAt: UtcInstant;
  readonly classification:
    | 'ACTIVE'
    | 'REDUNDANT'
    | 'UNUSED'
    | 'PRICE_INCREASED'
    | 'TRIAL_ENDING';
};

export type DepositInvestmentAgreement = {
  readonly accountId: AccountId;
  readonly present: true;
  readonly authorizedSweep: true;
};

export type ContextAccount = {
  readonly id: AccountId;
  readonly accountClass: ProductAccountClass;
  readonly currency: string;
  readonly balance: Money;
  readonly depositInvestmentAgreement: DepositInvestmentAgreement | null;
};

export type HighCostDebt = {
  readonly name: string;
  readonly balance: Money;
  readonly isHighCost: true;
};

export type NearTermObligation = {
  readonly name: string;
  readonly amount: Money;
  readonly dueAt: UtcInstant;
};

export type UserGoal = {
  readonly name: string;
  readonly remaining: Money;
};

/**
 * Authorized read-only financial snapshot. Assembled by the control plane.
 * Contains no write methods. Forbidden data categories are already stripped.
 */
export type FinancialContextSnapshot = {
  readonly customerId: CustomerId;
  readonly asOf: UtcInstant;
  readonly currency: string;
  readonly accounts: readonly ContextAccount[];
  readonly balancesByClass: {
    readonly [C in ProductAccountClass]: Money;
  };
  readonly recentTransactions: readonly ContextTransaction[];
  readonly recurringPatterns: readonly RecurringPattern[];
  readonly monthlyEssentialSpending: Money;
  readonly highCostDebt: readonly HighCostDebt[];
  readonly nearTermObligations: readonly NearTermObligation[];
  readonly userGoals: readonly UserGoal[];
  readonly realizedGainsThisWeek: Money;
  readonly strippedDataCategories: readonly DataCategory[];
  readonly writePath: false;
};

export type ForbiddenReturnMetricOnContext =
  | 'percentageReturn'
  | 'percentReturn'
  | 'yield'
  | 'apy'
  | 'apr'
  | 'growthRate'
  | 'blendedYield'
  | 'rateOfReturn';

export type FinancialContextHasNoReturnMetrics =
  Extract<keyof FinancialContextSnapshot, ForbiddenReturnMetricOnContext> extends never
    ? true
    : false;
