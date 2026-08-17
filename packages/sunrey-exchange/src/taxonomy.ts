export const EXCHANGE_ACCOUNT_STATUSES = [
  'PENDING',
  'ACTIVE_SIMULATION',
  'RESTRICTED',
  'SUSPENDED',
  'CLOSED',
] as const;
export type ExchangeAccountStatus = (typeof EXCHANGE_ACCOUNT_STATUSES)[number];

export const MARKET_FAMILIES = [
  'DIGITAL_ASSET',
  'INFORMATION_ASSET',
  'INTELLIGENCE_COMPUTE',
] as const;
export type MarketFamily = (typeof MARKET_FAMILIES)[number];

export const LISTING_STATUSES = [
  'DRAFT',
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEW_REQUIRED',
  'SIMULATION_LISTED',
  'SUSPENDED',
  'DELISTED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const DIGITAL_ORDER_TYPES = ['LIMIT', 'MARKET', 'CANCEL'] as const;
export type DigitalOrderType = (typeof DIGITAL_ORDER_TYPES)[number];

export const CONTRACT_ORDER_TYPES = ['REQUEST', 'OFFER', 'ACCEPTANCE', 'CONTRACT'] as const;
export type ContractOrderType = (typeof CONTRACT_ORDER_TYPES)[number];

export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const TIME_IN_FORCE = ['GTC', 'IOC'] as const;
export type TimeInForce = (typeof TIME_IN_FORCE)[number];

export const ORDER_STATUSES = [
  'CREATED',
  'AUTHORIZED',
  'OPEN',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCEL_PENDING',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'SUSPENDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MARKET_STATES = ['PREOPEN', 'OPEN', 'HALTED', 'CANCEL_ONLY', 'CLOSED'] as const;
export type MarketState = (typeof MARKET_STATES)[number];

export const SELF_TRADE_POLICIES = ['CANCEL_INCOMING', 'PREVENT'] as const;
export type SelfTradePolicy = (typeof SELF_TRADE_POLICIES)[number];

export const RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'PENDING',
  'ORDER_HOLD_MISMATCH',
  'TRADE_SETTLEMENT_MISMATCH',
  'POSITION_MISMATCH',
  'DUPLICATE_SETTLEMENT',
  'MARKET_DATA_SEQUENCE_GAP',
  'INVESTIGATION_REQUIRED',
] as const;
export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[number];

export const LEGAL_REVIEW_STATES = ['RESEARCH_REQUIRED', 'COUNSEL_REVIEW_REQUIRED'] as const;
export type LegalReviewState = (typeof LEGAL_REVIEW_STATES)[number];

export const PRICE_LABEL = 'SIMULATION_MARKET_PRICE' as const;

export const EVIDENCE_KIND_EXCHANGE = 'sunrey-exchange';

export const SETTLEMENT_MODELS = [
  'DIGITAL_ASSET_DVP',
  'NATIVE_CHAIN_DVP',
  'INFORMATION_PERMISSION_CONTRACT',
  'COMPUTE_CONTRACT',
] as const;
export type SettlementModel = (typeof SETTLEMENT_MODELS)[number];

export const NATIVE_POSITION_COMPONENTS = [
  'AVAILABLE',
  'RESERVED',
  'PENDING_SETTLEMENT',
  'FINALIZED',
] as const;
export type NativePositionComponent = (typeof NATIVE_POSITION_COMPONENTS)[number];

export const NATIVE_SETTLEMENT_STATUSES = [
  'MATCHED',
  'SETTLEMENT_CREATED',
  'SUBMITTED',
  'SUBMISSION_UNKNOWN',
  'FINALIZED',
  'FAILED',
  'RECONCILIATION_REQUIRED',
] as const;
export type NativeSettlementStatus = (typeof NATIVE_SETTLEMENT_STATUSES)[number];

export const NATIVE_FINALITY = ['PENDING_PROPOSAL', 'BFT_FINALIZED'] as const;
export type NativeFinality = (typeof NATIVE_FINALITY)[number];
