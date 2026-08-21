/**
 * Typed Consumer BFF account / balance / activity models.
 * Matches services/api Consumer BFF and api/sunrey-consumer-bff-v1.openapi.yaml.
 * Browser-safe. No Ledger, Kernel, or Execution Authority types.
 */

export const FINANCIAL_ACCOUNT_LIFECYCLES = [
  'PENDING',
  'ACTIVE',
  'RESTRICTED',
  'FROZEN',
  'CLOSING',
  'CLOSED',
] as const;
export type FinancialAccountLifecycle = (typeof FINANCIAL_ACCOUNT_LIFECYCLES)[number];

export const FINANCIAL_PRODUCT_TYPES = [
  'CASH_ACCOUNT',
  'CHECKING_PAYMENT',
  'SAVINGS',
  'MULTI_CURRENCY',
  'INVESTMENT_CASH',
  'EXCHANGE_CASH',
] as const;
export type FinancialProductType = (typeof FINANCIAL_PRODUCT_TYPES)[number];

export const CONSUMER_ACTIVITY_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REVERSED',
  'CANCELLED',
  'ACTION_REQUIRED',
] as const;
export type ConsumerActivityStatus = (typeof CONSUMER_ACTIVITY_STATUSES)[number];

export type MoneyView = {
  readonly currency: string;
  readonly minorUnits: string;
};

export type AccountBalanceView = {
  readonly posted: MoneyView;
  readonly ledger: MoneyView;
  readonly available: MoneyView;
  readonly held: MoneyView;
  readonly pending: MoneyView;
  readonly currency: string;
};

export type ConsumerAccount = {
  readonly id: string;
  readonly productType: FinancialProductType | string;
  readonly status: FinancialAccountLifecycle | string;
  readonly domainStatus: string;
  readonly currency: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly restrictions: readonly string[];
  readonly productConfiguration: {
    readonly licensingClaim: 'NOT_A_LICENSED_BANK_ACCOUNT';
    readonly environment: 'simulation';
    readonly liveBanking: false;
  };
};

export type ConsumerActivity = {
  readonly activityId: string;
  readonly type: string;
  readonly direction: string;
  readonly amount: MoneyView;
  readonly currency: string;
  readonly status: ConsumerActivityStatus | string;
  readonly counterpartyDisplay: string | null;
  readonly description: string;
  readonly occurredAt: string;
  readonly completedAt: string | null;
  readonly category: string;
  readonly relatedActionId: string | null;
  readonly fee?: MoneyView | null;
};

export type AccountStatementData = {
  readonly statementId: string;
  readonly accountId: string;
  readonly currency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly opening: MoneyView;
  readonly closing: MoneyView;
  readonly transactions: readonly {
    readonly postedAt: string;
    readonly direction: string;
    readonly amount: MoneyView;
    readonly description: string;
    readonly reference: string;
  }[];
};
