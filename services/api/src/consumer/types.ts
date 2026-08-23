/**
 * Client-safe Consumer BFF vocabulary.
 * Semantic product data only — no presentation layout.
 */

export const PRODUCT_AVAILABILITIES = [
  'IMPLEMENTED',
  'AVAILABLE_SIMULATION',
  'NOT_YET_PRODUCTIZED',
  'EXTERNAL_PROVIDER_REQUIRED',
] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITIES)[number];

/**
 * Explicit client states so Lovable can distinguish empty from failure.
 * Provider failure is never represented as a zero balance.
 */
export const CLIENT_RESOURCE_STATES = [
  'READY',
  'EMPTY',
  'FEATURE_DISABLED',
  'SIMULATION_ONLY',
  'USER_INELIGIBLE',
  'PENDING_VERIFICATION',
  'PROVIDER_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'MIXED_CURRENCY_WITHOUT_CONVERSION',
  'VALUATION_UNAVAILABLE',
] as const;
export type ClientResourceState = (typeof CLIENT_RESOURCE_STATES)[number];

export const CONSUMER_TRANSACTION_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REVERSED',
  'CANCELLED',
  'ACTION_REQUIRED',
] as const;
export type ConsumerTransactionStatus = (typeof CONSUMER_TRANSACTION_STATUSES)[number];

export const CONSUMER_ACTION_STATUSES = [
  'PENDING',
  'ACTION_REQUIRED',
  'AWAITING_APPROVAL',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type ConsumerActionStatus = (typeof CONSUMER_ACTION_STATUSES)[number];

export const CONSUMER_ACCOUNT_TYPES = [
  'CASH',
  'SAVINGS',
  'INVESTMENT',
  'DIGITAL_ASSET',
  'REWARDS',
  'PENDING',
  'OTHER',
] as const;

export const FINANCIAL_ACCOUNT_LIFECYCLES = [
  'PENDING',
  'ACTIVE',
  'RESTRICTED',
  'FROZEN',
  'CLOSING',
  'CLOSED',
] as const;

export const FINANCIAL_PRODUCT_TYPES = [
  'CASH_ACCOUNT',
  'CHECKING_PAYMENT',
  'SAVINGS',
  'MULTI_CURRENCY',
  'INVESTMENT_CASH',
  'EXCHANGE_CASH',
] as const;

export const ACCOUNT_RESTRICTION_CODES = [
  'DEBIT_BLOCKED',
  'CREDIT_BLOCKED',
  'WITHDRAWAL_BLOCKED',
  'TRANSFER_BLOCKED',
  'TRADING_BLOCKED',
  'CARD_BLOCKED',
  'COMPLIANCE_REVIEW',
] as const;
export type ConsumerAccountType = (typeof CONSUMER_ACCOUNT_TYPES)[number];

export const CONSUMER_ASSET_TYPES = [
  'FIAT',
  'SECURITY',
  'DIGITAL_ASSET',
  'NATIVE_PROTOCOL_ASSET',
] as const;
export type ConsumerAssetType = (typeof CONSUMER_ASSET_TYPES)[number];

export const RISK_DISPLAY_LEVELS = ['LOW', 'STANDARD', 'ELEVATED', 'RESTRICTED'] as const;
export type RiskDisplayLevel = (typeof RISK_DISPLAY_LEVELS)[number];

export const APPROVAL_REQUIREMENTS = [
  'NONE',
  'CUSTOMER_CONFIRMATION',
  'STEP_UP_AUTHENTICATION',
  'MANUAL_REVIEW',
  'KERNEL_HOLD',
] as const;
export type ApprovalRequirement = (typeof APPROVAL_REQUIREMENTS)[number];

export const VERIFICATION_DISPLAY_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
] as const;
export type VerificationDisplayState = (typeof VERIFICATION_DISPLAY_STATES)[number];

/**
 * Lovable-safe identity verification. Internal match scores and secret
 * screening rules are never returned on this surface.
 */
export const IDENTITY_VERIFICATION_CLIENT_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'ACTION_REQUIRED',
  'VERIFIED',
  'REVIEW',
] as const;
export type IdentityVerificationClientState = (typeof IDENTITY_VERIFICATION_CLIENT_STATES)[number];

export const PROVIDER_AVAILABILITIES = [
  'SIMULATED',
  'SANDBOX',
  'UNAVAILABLE',
  'NOT_CONNECTED',
  'EXTERNAL_REQUIRED',
] as const;
export type ProviderAvailability = (typeof PROVIDER_AVAILABILITIES)[number];

export const CARD_STATUSES = [
  'REQUESTED',
  'PENDING',
  'ACTIVE',
  'FROZEN',
  'SUSPENDED',
  'REPLACED',
  'CLOSED',
  'EXPIRED',
] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_WALLET_STATUSES = [
  'NOT_ELIGIBLE',
  'ELIGIBLE',
  'PROVISIONING',
  'ACTIVE',
  'FAILED',
  'SUSPENDED',
] as const;

export const CONSUMER_RESOURCE_GROUPS = [
  'ME',
  'HOME',
  'ACCOUNTS',
  'ACTIVITY',
  'PAYMENTS',
  'RECIPIENTS',
  'FX',
  'CARDS',
  'GROW',
  'GOALS',
  'PORTFOLIO',
  'AGENT',
  'EXCHANGE',
  'WALLETS',
  'ECONOMY',
  'DATA',
  'SECURITY',
  'NOTIFICATIONS',
] as const;
export type ConsumerResourceGroup = (typeof CONSUMER_RESOURCE_GROUPS)[number];

export type MoneyView = {
  readonly currency: string;
  readonly minorUnits: string;
};

export type ResourceField<T> = {
  readonly state: ClientResourceState;
  readonly availability: ProductAvailability;
  readonly value: T | null;
  readonly reason: string | null;
};

export function resourceField<T>(input: {
  readonly state: ClientResourceState;
  readonly availability: ProductAvailability;
  readonly value?: T | null;
  readonly reason?: string | null;
}): ResourceField<T> {
  const unavailable =
    input.state === 'PROVIDER_UNAVAILABLE' ||
    input.state === 'SERVICE_UNAVAILABLE' ||
    input.state === 'FEATURE_DISABLED' ||
    input.state === 'USER_INELIGIBLE' ||
    input.state === 'PENDING_VERIFICATION' ||
    input.state === 'MIXED_CURRENCY_WITHOUT_CONVERSION' ||
    input.state === 'VALUATION_UNAVAILABLE';
  return Object.freeze({
    state: input.state,
    availability: input.availability,
    value: unavailable ? null : (input.value ?? null),
    reason: input.reason ?? null,
  });
}

export const GROW_OPPORTUNITY_STATUSES = [
  'DETECTED',
  'ELIGIBLE',
  'INELIGIBLE',
  'PRESENTED',
  'DISMISSED',
  'ACCEPTED_FOR_PROPOSAL',
  'EXPIRED',
  'SUPERSEDED',
  'COMPLETED',
] as const;

export const GROW_OPPORTUNITY_CATEGORIES = [
  'CASH_OPTIMIZATION',
  'EMERGENCY_RESERVE',
  'RECURRING_SAVING',
  'INVESTMENT_ALLOCATION',
  'PORTFOLIO_REBALANCE',
  'DIVERSIFICATION',
  'CURRENCY_OPTIMIZATION',
  'DEBT_OPTIMIZATION',
  'GOAL_FUNDING',
  'EXPENSE_OPTIMIZATION',
  'INCOME_ALLOCATION',
] as const;

export function moneyView(currency: string, minorUnits: bigint): MoneyView {
  return Object.freeze({
    currency,
    minorUnits: minorUnits.toString(),
  });
}
