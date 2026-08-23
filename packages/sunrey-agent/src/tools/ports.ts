import type { MoneyView } from './types.ts';

export type ToolPortFailure = {
  readonly ok: false;
  readonly code:
    | 'NOT_OWNED'
    | 'NOT_FOUND'
    | 'PROVIDER_UNAVAILABLE'
    | 'PRODUCT_UNAVAILABLE'
    | 'QUOTE_EXPIRED'
    | 'COMPLIANCE_REFUSED'
    | 'KERNEL_DENIED'
    | 'NOT_ELIGIBLE';
  readonly message: string;
};

export type PortOk<T> = { readonly ok: true; readonly value: T };
export type PortResult<T> = PortOk<T> | ToolPortFailure;

export type AccountRecord = {
  readonly accountId: string;
  readonly ownerId: string;
  readonly label: string;
  readonly currency: string;
  readonly available: MoneyView;
  readonly held: MoneyView;
  readonly classes: Readonly<Record<string, MoneyView>>;
};

export type ActivityRecord = {
  readonly activityId: string;
  readonly accountId: string;
  readonly description: string;
  readonly amount: MoneyView;
  readonly direction: 'IN' | 'OUT';
  readonly occurredAt: string;
};

export type SpendingAnalysis = {
  readonly window: string;
  readonly inflows: MoneyView;
  readonly outflows: MoneyView;
  readonly net: MoneyView;
  readonly categories: readonly { readonly name: string; readonly amount: MoneyView }[];
};

export type RecipientRecord = {
  readonly recipientId: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly currency: string;
};

export type PaymentQuoteRecord = {
  readonly quoteId: string;
  readonly sourceAccountId: string;
  readonly recipientId: string;
  readonly amount: MoneyView;
  readonly fees: MoneyView;
  readonly destinationAmount: MoneyView;
  readonly rate: { readonly numerator: string; readonly denominator: string };
  readonly expiry: string;
  readonly expired: boolean;
};

export type PaymentRecord = {
  readonly paymentId: string;
  readonly ownerId: string;
  readonly status: string;
  readonly amount: MoneyView;
};

export type FxQuoteRecord = {
  readonly quoteId: string;
  readonly source: MoneyView;
  readonly destination: MoneyView;
  readonly fees: MoneyView;
  readonly rate: { readonly numerator: string; readonly denominator: string };
  readonly expiry: string;
  readonly expired: boolean;
};

export type GoalRecord = { readonly goalId: string; readonly name: string; readonly target: MoneyView };
export type OpportunityRecord = {
  readonly opportunityId: string;
  readonly title: string;
  readonly amount: MoneyView;
  readonly kind: string;
};
export type GrowthPlanRecord = { readonly planId: string; readonly ownerId: string; readonly summary: string };
export type GrowthProposalRecord = {
  readonly proposalId: string;
  readonly planId: string;
  readonly amount: MoneyView;
  readonly state: string;
};

export type HoldingRecord = {
  readonly assetId: string;
  readonly quantityMinorUnits: string;
  readonly informationalValue: MoneyView | null;
};
export type PortfolioRecord = {
  readonly ownerId: string;
  readonly holdings: readonly HoldingRecord[];
  readonly allocation: readonly { readonly sleeve: string; readonly amount: MoneyView }[];
  readonly performanceQuantityChange: string;
  readonly riskLabel: string;
};

export type MarketRecord = {
  readonly marketId: string;
  readonly base: string;
  readonly quote: string;
  readonly eligible: boolean;
  readonly lastPriceUnits: string | null;
};
export type ExchangeOrderRecord = {
  readonly orderId: string;
  readonly marketId: string;
  readonly side: string;
  readonly quantityMinorUnits: string;
  readonly state: string;
};

export type WalletRecord = {
  readonly walletId: string;
  readonly ownerId: string;
  readonly assetId: string;
  readonly balanceMinorUnits: string;
};
export type DepositRecord = { readonly depositId: string; readonly ownerId: string; readonly status: string };

export type CardRecord = {
  readonly cardId: string;
  readonly ownerId: string;
  readonly last4: string;
  readonly status: string;
};

export type ConsentSummary = {
  readonly ownerId: string;
  readonly activePermits: number;
  readonly purposes: readonly string[];
};

export type AccountsPort = {
  listAccounts(ownerId: string): PortResult<readonly AccountRecord[]>;
  getAccount(ownerId: string, accountId: string): PortResult<AccountRecord>;
  activity(ownerId: string, accountId: string): PortResult<readonly ActivityRecord[]>;
  analyzeSpending(ownerId: string): PortResult<SpendingAnalysis>;
};

export type PaymentsPort = {
  listRecipients(ownerId: string): PortResult<readonly RecipientRecord[]>;
  quote(input: {
    readonly ownerId: string;
    readonly sourceAccountId: string;
    readonly recipientId: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
  }): PortResult<PaymentQuoteRecord>;
  getPayment(ownerId: string, paymentId: string): PortResult<PaymentRecord>;
};

export type FxPort = {
  quote(input: {
    readonly ownerId: string;
    readonly sourceCurrency: string;
    readonly destinationCurrency: string;
    readonly sourceAmountMinorUnits: string;
  }): PortResult<FxQuoteRecord>;
};

export type GrowPort = {
  goals(ownerId: string): PortResult<readonly GoalRecord[]>;
  opportunities(ownerId: string): PortResult<readonly OpportunityRecord[]>;
  plan(ownerId: string): PortResult<GrowthPlanRecord | null>;
  proposals(ownerId: string): PortResult<readonly GrowthProposalRecord[]>;
  createProposal(input: {
    readonly ownerId: string;
    readonly opportunityId: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
  }): PortResult<GrowthProposalRecord>;
  modifyProposal(input: {
    readonly ownerId: string;
    readonly proposalId: string;
    readonly amountMinorUnits: string;
  }): PortResult<GrowthProposalRecord>;
};

export type PortfolioPort = {
  get(ownerId: string): PortResult<PortfolioRecord>;
};

export type ExchangeEligibilityRecord = {
  readonly ownerId: string;
  readonly canTrade: boolean;
  readonly canDeposit: boolean;
  readonly canWithdraw: boolean;
  readonly reasonCodes: readonly string[];
};

export type ExchangeHoldingRecord = {
  readonly assetId: string;
  readonly quantityMinorUnits: string;
  readonly reservedMinorUnits: string;
};

export type ExchangePreviewRecord = {
  readonly previewId: string;
  readonly marketId: string;
  readonly side: string;
  readonly quantityMinorUnits: string;
  readonly estimatedPriceUnits: string | null;
  readonly guaranteedExecutionPrice: false;
};

export type ExchangePort = {
  markets(): PortResult<readonly MarketRecord[]>;
  asset(assetId: string): PortResult<{ readonly assetId: string; readonly listed: boolean }>;
  price(marketId: string): PortResult<{ readonly marketId: string; readonly lastPriceUnits: string | null; readonly eligible: boolean }>;
  orders(ownerId: string): PortResult<readonly ExchangeOrderRecord[]>;
  eligibility(ownerId: string, marketId?: string): PortResult<ExchangeEligibilityRecord>;
  holdings(ownerId: string): PortResult<readonly ExchangeHoldingRecord[]>;
  preview(input: {
    readonly ownerId: string;
    readonly marketId: string;
    readonly side: string;
    readonly quantityMinorUnits: string;
  }): PortResult<ExchangePreviewRecord>;
};

export type CustodyPort = {
  wallets(ownerId: string): PortResult<readonly WalletRecord[]>;
  deposit(ownerId: string, depositId: string): PortResult<DepositRecord>;
};

export type CardsPort = {
  list(ownerId: string): PortResult<readonly CardRecord[]>;
  get(ownerId: string, cardId: string): PortResult<CardRecord>;
};

export type DataPort = {
  consent(ownerId: string): PortResult<ConsentSummary>;
  permissions(ownerId: string): PortResult<{ readonly ownerId: string; readonly scopes: readonly string[] }>;
  hinRights(ownerId: string): PortResult<{
    readonly ownerId: string;
    readonly items: readonly { readonly rightId: string; readonly category: string; readonly status: string; readonly ownershipTransferred: false }[];
  }>;
  hinPermissions(ownerId: string): PortResult<{
    readonly ownerId: string;
    readonly purposes: readonly string[];
  }>;
  hinEarnings(ownerId: string): PortResult<{
    readonly ownerId: string;
    readonly settledMinorUnits: string;
    readonly guaranteed: false;
  }>;
  hinLicense(ownerId: string, licenseId: string): PortResult<{
    readonly licenseId: string;
    readonly purpose: string;
    readonly status: string;
  }>;
};

export type NativeEconomyRecord = {
  readonly assetId: string;
  readonly canonicalName: string;
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly totalSupply: string;
  readonly circulatingSupply: string;
  readonly protocolNative: true;
  readonly lastTradeMinorUnits: string | null;
  readonly valuationIsNotMarketPrice: true;
};

export type NativeEconomyPort = {
  asset(assetId: string): PortResult<NativeEconomyRecord>;
  supply(assetId?: string): PortResult<readonly NativeEconomyRecord[]>;
  overview(): PortResult<{
    readonly sunrey: NativeEconomyRecord;
    readonly moonrey: NativeEconomyRecord;
    readonly productionActive: false;
  }>;
};

export type ToolCompliancePort = {
  evaluate(input: {
    readonly toolId: string;
    readonly ownerId: string;
    readonly amountMinorUnits?: string;
  }): { readonly status: 'ALLOW' | 'BLOCK' | 'HOLD' | 'REQUIRE_MANUAL_REVIEW'; readonly detail: string };
};

export type AgentToolDomainPorts = {
  readonly accounts: AccountsPort;
  readonly payments: PaymentsPort;
  readonly fx: FxPort;
  readonly grow: GrowPort;
  readonly portfolio: PortfolioPort;
  readonly exchange: ExchangePort;
  readonly custody: CustodyPort;
  readonly cards: CardsPort;
  readonly data: DataPort;
  readonly nativeEconomy: NativeEconomyPort;
  readonly compliance: ToolCompliancePort;
};
