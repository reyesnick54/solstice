/**
 * Typed Consumer BFF payment resources (`/api/v1`).
 * Matches services/api + packages/payments platform resources.
 * Browser-safe. No Ledger, Kernel, or Execution Authority types.
 */

export const BFF_PAYMENT_STATUSES = [
  'DRAFT',
  'QUOTED',
  'AWAITING_APPROVAL',
  'AWAITING_STEP_UP_AUTH',
  'AWAITING_COMPLIANCE',
  'AUTHORIZED',
  'QUEUED',
  'SUBMITTED',
  'PROCESSING',
  'SETTLED',
  'FAILED',
  'CANCELLED',
  'RETURNED',
  'REVERSED',
] as const;
export type PaymentStatus = (typeof BFF_PAYMENT_STATUSES)[number];

export const RECIPIENT_DESTINATION_TYPES = [
  'SUNREY_USER',
  'DOMESTIC_BANK',
  'INTERNATIONAL_BANK',
  'WALLET',
] as const;
export type RecipientDestinationType = (typeof RECIPIENT_DESTINATION_TYPES)[number];

export type MoneyResource = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type Recipient = {
  readonly id: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly destinationType: RecipientDestinationType;
  readonly country: string;
  readonly currency: string;
  readonly displayHint: string;
  readonly relationship: string | null;
  readonly purpose: string | null;
  readonly verificationStatus: 'PENDING' | 'ACTIVE' | 'REVIEW' | 'BLOCKED' | 'DISABLED';
  readonly screeningStatus: string;
  readonly createdAt: string;
};

export type PaymentQuote = {
  readonly quoteId: string;
  readonly sourceAmount: MoneyResource;
  readonly destinationAmount: MoneyResource | null;
  readonly currency: string;
  readonly fees: readonly { readonly code: string; readonly amount: MoneyResource; readonly description: string }[];
  readonly amountDebited: MoneyResource;
  readonly fx: { readonly rateLabel: string | null; readonly rateSource: string; readonly reference: string } | null;
  readonly estimatedRoute: {
    readonly railPreference: string;
    readonly paymentType: string;
    readonly corridorId: string | null;
  };
  readonly estimatedDeliveryClass: string;
  readonly settlementTimePromise: null;
  readonly requiredApprovals: readonly string[];
  readonly complianceState: string;
  readonly expiresAt: string;
  readonly productionMoneyMovement: false;
};

export type Payment = {
  readonly paymentId: string;
  readonly payerId: string;
  readonly sourceAccountId: string;
  readonly beneficiaryId: string | null;
  readonly destination: {
    readonly type: string;
    readonly accountId: string | null;
    readonly displayHint: string;
  };
  readonly amount: MoneyResource;
  readonly destinationAmount: MoneyResource;
  readonly currency: string;
  readonly paymentType: string;
  readonly railPreference: string;
  readonly purpose: string;
  readonly reference: string;
  readonly fees: readonly { readonly code: string; readonly amount: MoneyResource; readonly description: string }[];
  readonly fx: { readonly rateLabel: string | null; readonly rateSource: string; readonly reference: string } | null;
  readonly status: PaymentStatus;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly providerReference: string | null;
  readonly idempotencyKey: string;
  readonly approvalId: string | null;
  readonly workflowId: string | null;
  readonly productionMoneyMovement: false;
};

export type PaymentApproval = {
  readonly approvalId: string;
  readonly paymentId: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly createdAt: string;
  readonly decidedAt: string | null;
};

export type RecipientCreateInput = {
  readonly accountId: string;
  readonly displayName: string;
  readonly destinationType?: RecipientDestinationType;
  readonly destinationAccountId?: string;
  readonly scheme?: string;
  readonly accountNumber?: string;
  readonly country?: string;
  readonly currency?: string;
  readonly kind?: 'PERSON' | 'BUSINESS';
  readonly relationship?: string;
  readonly purpose?: string;
};

export type PaymentQuoteInput = {
  readonly sourceAccountId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly beneficiaryId?: string;
  readonly destinationAccountId?: string;
  readonly railPreference?: string;
  readonly purpose?: string;
};

export type PaymentCreateInput = {
  readonly sourceAccountId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly beneficiaryId?: string;
  readonly destinationAccountId?: string;
  readonly quoteId?: string;
  readonly purpose?: string;
  readonly reference?: string;
  readonly paymentId?: string;
  readonly approveNow?: boolean;
  readonly stepUpSatisfied?: boolean;
};

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
