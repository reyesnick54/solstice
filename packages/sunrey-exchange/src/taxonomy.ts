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
  'HUMAN_INFORMATION_RIGHT',
  'INTELLIGENCE_COMPUTE',
  'PRODUCTIVE_CAPACITY',
] as const;
export type MarketFamily = (typeof MARKET_FAMILIES)[number];

/** Canonical Chunk 49 families. INFORMATION_ASSET remains the historical compute-contract alias. */
export const CANONICAL_MARKET_FAMILIES = [
  'DIGITAL_ASSET',
  'HUMAN_INFORMATION_RIGHT',
  'INTELLIGENCE_COMPUTE',
  'PRODUCTIVE_CAPACITY',
] as const;
export type CanonicalMarketFamily = (typeof CANONICAL_MARKET_FAMILIES)[number];

export const LISTING_STATUSES = [
  'DRAFT',
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEW_REQUIRED',
  'SIMULATION_LISTED',
  'SUSPENDED',
  'DELISTED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const DIGITAL_ORDER_TYPES = [
  'LIMIT',
  'MARKET',
  'MARKET_WITH_PROTECTION',
  'CANCEL',
  'IOC',
  'FOK',
  'POST_ONLY',
] as const;
export type DigitalOrderType = (typeof DIGITAL_ORDER_TYPES)[number];

export const GOVERNED_ORDER_TYPES = ['LIMIT', 'IOC', 'FOK', 'POST_ONLY'] as const;
export type GovernedOrderType = (typeof GOVERNED_ORDER_TYPES)[number];

export const CONTRACT_ORDER_TYPES = ['REQUEST', 'OFFER', 'ACCEPTANCE', 'CONTRACT'] as const;
export type ContractOrderType = (typeof CONTRACT_ORDER_TYPES)[number];

export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const TIME_IN_FORCE = ['GTC', 'IOC', 'FOK', 'POST_ONLY'] as const;
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

/**
 * Canonical market states. Existing Chunk 29 names remain:
 * PREOPEN, OPEN, HALTED, CANCEL_ONLY, CLOSED.
 * Chunk 95 operational names AUCTION, PAUSED, CLOSE_ONLY, RESTRICTED
 * sit alongside them. PAUSED is the circuit-breaker pause; HALTED is
 * the existing emergency halt. CLOSE_ONLY is the operational alias of
 * CANCEL_ONLY for reduce-only sessions.
 */
export const MARKET_STATES = [
  'PREOPEN',
  'OPEN',
  'AUCTION',
  'PAUSED',
  'HALTED',
  'CLOSE_ONLY',
  'CANCEL_ONLY',
  'RESTRICTED',
  'CLOSED',
] as const;
export type MarketState = (typeof MARKET_STATES)[number];

export const SELF_TRADE_POLICIES = [
  'CANCEL_INCOMING',
  'CANCEL_NEWEST',
  'CANCEL_OLDEST',
  'PREVENT',
  'REJECT',
] as const;
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
  'NATIVE_ASSET_DVP',
  'NATIVE_CHAIN_DVP',
  'INFORMATION_PERMISSION_CONTRACT',
  'DELIVERY_VERSUS_RIGHT',
  'COMPUTE_CONTRACT',
  'CAPACITY_ESCROW_ORACLE',
] as const;
export type SettlementModel = (typeof SETTLEMENT_MODELS)[number];

export const MARKET_MODES = ['CONTINUOUS', 'BATCH_AUCTION'] as const;
export type MarketMode = (typeof MARKET_MODES)[number];

export const MARKET_ACCESS_POLICIES = [
  'PUBLIC_DEVELOPMENT',
  'VERIFIED_ACCOUNT',
  'INSTITUTIONAL_ONLY',
  'ELIGIBLE_COUNTERPARTY',
  'MACHINE_ALLOWED',
  'HUMAN_ONLY',
] as const;
export type MarketAccessPolicy = (typeof MARKET_ACCESS_POLICIES)[number];

export const EXCHANGE_DISPUTE_KINDS = [
  'DELIVERY_MISMATCH',
  'ORACLE_CONFLICT',
  'RIGHTS_FAILURE',
  'CONSENT_REVOKED',
  'SETTLEMENT_FAILURE',
] as const;
export type ExchangeDisputeKind = (typeof EXCHANGE_DISPUTE_KINDS)[number];

export const ELIGIBILITY_REASON_CODES = [
  'ELIGIBLE',
  'IDENTITY_INELIGIBLE',
  'RIGHTS_FAILURE',
  'CONSENT_MISSING',
  'CONSENT_REVOKED',
  'PURPOSE_MISMATCH',
  'JURISDICTION_DENIED',
  'CAPABILITY_MISSING',
  'COUNTERPARTY_CLASS_DENIED',
  'DELIVERY_GEOGRAPHY_DENIED',
  'ORACLE_REQUIREMENT_UNMET',
  'INSTRUMENT_EXPIRED',
  'MARKET_ACCESS_DENIED',
  'MACHINE_NOT_ALLOWED',
  'HUMAN_ONLY_MARKET',
  'RAW_INFORMATION_UNAVAILABLE',
  'RISK_LIMIT_BREACH',
] as const;
export type EligibilityReasonCode = (typeof ELIGIBILITY_REASON_CODES)[number];

export const INSTRUMENT_STATUSES = [
  'DRAFT',
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEW_REQUIRED',
  'SIMULATION_LISTED',
  'SUSPENDED',
  'DELISTED',
  'EXPIRED',
] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];

export const CONTRACT_TEMPLATE_IDS = [
  'COMPUTE_SPOT_V1',
  'ENERGY_DELIVERY_V1',
  'MANUFACTURING_CAPACITY_V1',
  'STORAGE_CAPACITY_V1',
  'INFORMATION_COMPUTE_RIGHT_V1',
] as const;
export type ContractTemplateId = (typeof CONTRACT_TEMPLATE_IDS)[number];

export const COMPUTE_SERVICE_CLASSES = [
  'GPU_COMPUTE',
  'CPU_COMPUTE',
  'AI_INFERENCE',
  'STORAGE',
  'BANDWIDTH',
  'SPECIALIZED_MODEL_EXECUTION',
] as const;
export type ComputeServiceClass = (typeof COMPUTE_SERVICE_CLASSES)[number];

export const CAPACITY_CATEGORIES = [
  'ENERGY',
  'MANUFACTURING',
  'STORAGE',
  'LOGISTICS',
  'REAL_ESTATE_USE',
  'AGRICULTURAL_OUTPUT',
] as const;
export type CapacityCategory = (typeof CAPACITY_CATEGORIES)[number];

export const REVOCATION_BEHAVIORS = [
  'BLOCK_FUTURE_USE',
  'ALLOW_IN_FLIGHT_ONLY',
  'REQUIRE_RECONFIRMATION',
] as const;
export type RevocationBehavior = (typeof REVOCATION_BEHAVIORS)[number];

export const ORACLE_FACT_POLICIES = [
  'REQUIRE_FINALIZED',
  'BLOCK_ON_CONFLICT',
  'BLOCK_ON_STALE',
] as const;
export type OracleFactPolicy = (typeof ORACLE_FACT_POLICIES)[number];

export const PARTIAL_DELIVERY_POLICIES = [
  'PAY_VERIFIED_RELEASE_UNUSED',
  'PAY_VERIFIED_HOLD_REMAINDER',
  'ALL_OR_NOTHING',
] as const;
export type PartialDeliveryPolicy = (typeof PARTIAL_DELIVERY_POLICIES)[number];

export const AUCTION_CLEARING_METHODS = ['UNIFORM_PRICE', 'DISCRIMINATORY'] as const;
export type AuctionClearingMethod = (typeof AUCTION_CLEARING_METHODS)[number];

export const COUNTERPARTY_CLASSES = [
  'HUMAN',
  'MACHINE',
  'INSTITUTION',
  'ELIGIBLE_COUNTERPARTY',
  'DEVELOPMENT',
] as const;
export type ExchangeCounterpartyClass = (typeof COUNTERPARTY_CLASSES)[number];
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
