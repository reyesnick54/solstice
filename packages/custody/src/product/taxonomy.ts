/**
 * Customer-wallet product vocabulary.
 * Extends packages/custody. Not a second custody, ledger, or key authority.
 */

export const WALLET_STATUSES = ['PENDING', 'ACTIVE', 'RESTRICTED', 'FROZEN', 'CLOSED'] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const CUSTODY_MODELS = ['SUNREY_NATIVE', 'EXTERNAL_CUSTODY', 'INTERNAL_OPERATIONAL'] as const;
export type CustodyModel = (typeof CUSTODY_MODELS)[number];

export const WALLET_ADDRESS_STATUSES = ['ASSIGNED', 'ACTIVE', 'RETIRED'] as const;
export type WalletAddressStatus = (typeof WALLET_ADDRESS_STATUSES)[number];

export const CLIENT_FINALITY_STATES = [
  'PENDING',
  'BROADCAST',
  'CONFIRMING',
  'FINALIZED',
  'FAILED',
  'REVIEW',
] as const;
export type ClientFinalityState = (typeof CLIENT_FINALITY_STATES)[number];

export const TRAVEL_RULE_CUSTOMER_STATES = [
  'NOT_REQUIRED',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'PROCESSING',
  'COMPLETE',
  'REVIEW',
] as const;
export type TravelRuleCustomerState = (typeof TRAVEL_RULE_CUSTOMER_STATES)[number];

export const WALLET_NETWORKS = ['SUNREY_CHAIN', 'EXTERNAL_BITCOIN', 'EXTERNAL_ETHEREUM'] as const;
export type WalletNetworkId = (typeof WALLET_NETWORKS)[number];

export const WALLET_TRANSACTION_KINDS = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'] as const;
export type WalletTransactionKind = (typeof WALLET_TRANSACTION_KINDS)[number];

export const WALLET_RECONCILIATION_PLANES = [
  'SUNREY_CHAIN_NATIVE',
  'CUSTODY_PROVIDER',
  'EXCHANGE_POSITION',
  'CUSTOMER_READ_MODEL',
] as const;
export type WalletReconciliationPlane = (typeof WALLET_RECONCILIATION_PLANES)[number];

export const PRODUCTION_SIGNING_AUTHORIZED = false as const;
export const PRODUCTION_MONEY_MOVEMENT = false as const;
