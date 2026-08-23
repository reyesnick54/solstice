import type { UtcInstant } from '../../../domain/src/time.ts';

export const CLEARING_STATES = [
  'PENDING',
  'VALIDATED',
  'READY_TO_SETTLE',
  'SETTLING',
  'SETTLED',
  'FAILED',
  'REQUIRES_REVIEW',
] as const;
export type ClearingState = (typeof CLEARING_STATES)[number];

export const SETTLEMENT_RAILS = [
  'LEDGER_FIAT',
  'CUSTODY_ASSET',
  'NATIVE_CHAIN',
  'APPLICATION_PORT',
] as const;
export type SettlementRail = (typeof SETTLEMENT_RAILS)[number];

export const SETTLEMENT_FAILURE_CODES = [
  'CUSTODY_UNAVAILABLE',
  'CHAIN_UNAVAILABLE',
  'LEDGER_FAILURE',
  'PROVIDER_PENDING',
  'PROVIDER_UNKNOWN',
  'INSUFFICIENT_RESERVED_ASSET',
  'REORG',
  'TIMEOUT',
  'DVP_PARTIAL',
  'WEBHOOK_UNVERIFIED',
  'AUTHORITY_MISSING',
  'DUPLICATE_TRANSFER_BLOCKED',
] as const;
export type SettlementFailureCode = (typeof SETTLEMENT_FAILURE_CODES)[number];

export const EXCHANGE_CAPABILITIES = ['CAN_TRADE', 'CAN_DEPOSIT', 'CAN_WITHDRAW'] as const;
export type ExchangeCapability = (typeof EXCHANGE_CAPABILITIES)[number];

export const PRODUCT_SELF_TRADE_POLICIES = [
  'CANCEL_INCOMING',
  'CANCEL_NEWEST',
  'CANCEL_OLDEST',
  'PREVENT',
  'REJECT',
] as const;
export type ProductSelfTradePolicy = (typeof PRODUCT_SELF_TRADE_POLICIES)[number];

export const SURVEILLANCE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type SurveillanceSeverity = (typeof SURVEILLANCE_SEVERITIES)[number];

export const MARKET_STREAM_TOPICS = [
  'ticker',
  'trade',
  'order-book',
  'order-status',
] as const;
export type MarketStreamTopic = (typeof MARKET_STREAM_TOPICS)[number];

/**
 * A fill is not final settlement. The obligation is the durable
 * clearing unit. `fillIsFinalSettlement` is true only when the
 * architecture performed atomic DVP in the same call and both
 * rails reported success.
 */
export type FillObligation = {
  readonly obligationId: string;
  readonly tradeId: string;
  readonly marketId: string;
  readonly buyerAccountId: string;
  readonly sellerAccountId: string;
  readonly buyerParticipantId: string;
  readonly sellerParticipantId: string;
  readonly buyerCashAccountId: string;
  readonly sellerCashAccountId: string;
  readonly buyerCustodyRef: string | null;
  readonly sellerCustodyRef: string | null;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly quoteKind: 'FIAT_MONEY' | 'ASSET';
  readonly quantity: bigint;
  readonly priceUnits: bigint;
  readonly quoteMinorUnits: bigint;
  readonly makerFeeMinorUnits: bigint;
  readonly takerFeeMinorUnits: bigint;
  readonly currency: string;
  readonly makerOrderId: string;
  readonly takerOrderId: string;
  readonly makerHoldId: string | null;
  readonly takerHoldId: string | null;
  readonly quoteRail: SettlementRail;
  readonly baseRail: SettlementRail;
  readonly createdAt: UtcInstant;
  readonly fillIsFinalSettlement: boolean;
};

export type SettlementReferences = {
  readonly ledger: {
    readonly cashJournalId: string | null;
    readonly feeJournalId: string | null;
    readonly reservationJournalId: string | null;
  };
  readonly custody: {
    readonly providerTxRef: string | null;
    readonly vaultId: string | null;
    readonly reservationId: string | null;
    readonly confirmation: 'UNVERIFIED' | 'PENDING' | 'CONFIRMED' | 'UNKNOWN' | 'UNAVAILABLE';
  };
  readonly chain: {
    readonly txId: string | null;
    readonly height: bigint | null;
    readonly finality: 'PENDING_PROPOSAL' | 'BFT_FINALIZED' | 'UNAVAILABLE' | 'NONE';
  };
};

export type ClearingRecord = {
  readonly clearingId: string;
  readonly obligationId: string;
  readonly tradeId: string;
  readonly state: ClearingState;
  readonly previousState: ClearingState | null;
  readonly refs: SettlementReferences;
  readonly failureCode: SettlementFailureCode | null;
  readonly reviewReason: string | null;
  readonly attemptCount: number;
  readonly lastAttemptAt: UtcInstant | null;
  readonly settledAt: UtcInstant | null;
  readonly idempotencyKey: string;
  readonly duplicateTransferBlocked: boolean;
  readonly updatedAt: UtcInstant;
};

export type SettlementAttempt = {
  readonly attemptId: string;
  readonly obligationId: string;
  readonly kind: 'SETTLE' | 'RETRY' | 'REPAIR';
  readonly outcome: ClearingState;
  readonly failureCode: SettlementFailureCode | null;
  readonly transferred: boolean;
  readonly at: UtcInstant;
};

export type PersistentBreak = {
  readonly breakId: string;
  readonly kind:
    | 'EXCHANGE_VS_LEDGER'
    | 'EXCHANGE_VS_CUSTODY'
    | 'EXCHANGE_VS_CHAIN'
    | 'TRADE_WITHOUT_OBLIGATION'
    | 'OBLIGATION_WITHOUT_SETTLEMENT'
    | 'ONE_SIDED_DVP';
  readonly exchangeRef: string;
  readonly externalRef: string | null;
  readonly exchangeQuantity: bigint;
  readonly externalQuantity: bigint;
  readonly notes: readonly string[];
  readonly autoCorrected: false;
  readonly createdAt: UtcInstant;
};

export type CapabilityDecision = {
  readonly capability: ExchangeCapability;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
};

export type ProductEligibilityDecision = {
  readonly ownerId: string;
  readonly marketId: string | null;
  readonly canTrade: CapabilityDecision;
  readonly canDeposit: CapabilityDecision;
  readonly canWithdraw: CapabilityDecision;
  readonly travelRule: {
    readonly applicable: boolean;
    readonly blocksWithdrawal: boolean;
    readonly state: 'NOT_REQUIRED' | 'REQUIRED' | 'PENDING' | 'DELIVERED' | 'FAILED';
  };
  readonly productionTradingEnabled: false;
};

export type TravelRuleHookInput = {
  readonly ownerId: string;
  readonly destination: string | null;
  readonly amountMinorUnits: bigint;
  readonly assetId: string;
  readonly requiredByPack: boolean;
  readonly messageState: 'NOT_REQUIRED' | 'REQUIRED' | 'PENDING' | 'DELIVERED' | 'FAILED';
};

export type MarketAbuseCase = {
  readonly caseId: string;
  readonly alertId: string;
  readonly detector: string;
  readonly severity: SurveillanceSeverity;
  readonly marketId: string;
  readonly accountIds: readonly string[];
  readonly orderIds: readonly string[];
  readonly fillIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly legalConclusion: false;
  readonly createdAt: UtcInstant;
};

export type ProductMarketTicker = {
  readonly marketId: string;
  readonly lastPriceUnits: bigint | null;
  readonly bestBidUnits: bigint | null;
  readonly bestAskUnits: bigint | null;
  readonly volume: bigint;
  readonly asOf: UtcInstant;
  readonly freshnessMs: bigint;
  readonly label: 'SIMULATION_MARKET_PRICE' | 'UNAVAILABLE';
};

export type ProductOrderBookLevel = {
  readonly priceUnits: bigint;
  readonly quantity: bigint;
};

export type ProductOrderBookView = {
  readonly marketId: string;
  readonly bids: readonly ProductOrderBookLevel[];
  readonly asks: readonly ProductOrderBookLevel[];
  readonly sequence: number;
  readonly asOf: UtcInstant;
  readonly freshnessMs: bigint;
};

export type ProductTradePrint = {
  readonly tradeId: string;
  readonly marketId: string;
  readonly priceUnits: bigint;
  readonly quantity: bigint;
  readonly asOf: UtcInstant;
};

export type ProductCandle = {
  readonly marketId: string;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly open: bigint;
  readonly high: bigint;
  readonly low: bigint;
  readonly close: bigint;
  readonly volume: bigint;
  readonly asOf: UtcInstant;
  readonly freshnessMs: bigint;
  readonly label: 'SIMULATION_MARKET_PRICE';
};

export type ProductMarketStatus = {
  readonly marketId: string;
  readonly state: string;
  readonly asOf: UtcInstant;
  readonly productionTradingEnabled: false;
};

export type StreamEvent = {
  readonly sequence: number;
  readonly topic: MarketStreamTopic;
  readonly marketId: string;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
  readonly asOf: UtcInstant;
};

export type OrderPreview = {
  readonly previewId: string;
  readonly marketId: string;
  readonly instrument: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly estimatedPriceUnits: bigint | null;
  readonly feeMinorUnits: bigint;
  readonly estimatedTotalMinorUnits: bigint | null;
  readonly marketState: string;
  readonly slippageWarning: string | null;
  readonly eligibility: ProductEligibilityDecision;
  readonly requiredApproval: 'EXECUTION_AUTHORITY' | 'APPROVED_PROPOSAL' | 'WALLET_AUTHORIZATION';
  readonly expiresAt: UtcInstant | null;
  readonly guaranteedExecutionPrice: false;
  readonly productionTradingEnabled: false;
};

export const PRODUCTION_TRADING_ENABLED = false;
