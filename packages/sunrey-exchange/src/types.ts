import type { CustomerId } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { Money } from '../../money/src/money.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type {
  ClearingInstructionId,
  ExchangeAccountId,
  ExchangeHoldId,
  ExchangeMarketId,
  ExecutionId,
  FeeScheduleId,
  ListingId,
  ListingVersion,
  MarketDataSequence,
  OrderBookId,
  OrderId,
  OrderVersion,
  ReconciliationId,
  SettlementId,
  TradeId,
} from './ids.ts';
import type { ExchangePrice } from './price.ts';
import type {
  DigitalOrderType,
  ExchangeAccountStatus,
  LegalReviewState,
  ListingStatus,
  MarketFamily,
  MarketState,
  OrderSide,
  OrderStatus,
  ReconciliationOutcome,
  SelfTradePolicy,
  SettlementModel,
  TimeInForce,
} from './taxonomy.ts';

export type ExchangeFailure = {
  readonly code: string;
  readonly message: string;
};

export type ExchangeOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision?: AuthorizationDecision }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision?: AuthorizationDecision | null;
    };

export type ExchangeAccount = {
  readonly accountId: ExchangeAccountId;
  readonly customerId: CustomerId;
  readonly identityId: string;
  readonly legalEntityId: string;
  readonly jurisdiction: Jurisdiction;
  readonly custodyAccountId: string;
  readonly cashAccountId: string;
  readonly marketPermissions: readonly MarketFamily[];
  readonly status: ExchangeAccountStatus;
  readonly createdAt: UtcInstant;
};

export type ExchangeListing = {
  readonly listingId: ListingId;
  readonly listingVersion: ListingVersion;
  readonly family: MarketFamily;
  readonly underlyingRef: string;
  readonly settlementModel: SettlementModel;
  readonly jurisdictionEligibility: readonly Jurisdiction[];
  readonly legalReviewState: LegalReviewState;
  readonly enabledCapabilities: readonly string[];
  readonly riskClassification: 'SIMULATION_ONLY';
  readonly minQuantity: AssetQuantity | null;
  readonly maxQuantity: AssetQuantity | null;
  readonly precision: number;
  readonly status: ListingStatus;
  readonly tokenClassificationClaim: 'NONE';
};

export type ExchangeMarket = {
  readonly marketId: ExchangeMarketId;
  readonly family: MarketFamily;
  readonly bookId: OrderBookId;
  readonly baseListingId: ListingId;
  readonly quoteListingId: ListingId | null;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly quoteKind: 'FIAT_MONEY' | 'ASSET';
  readonly state: MarketState;
  readonly selfTradePolicy: SelfTradePolicy;
  readonly feeScheduleId: FeeScheduleId;
  readonly maxSlippageUnits: bigint | null;
  readonly maxNotionalMinor: bigint | null;
};

export type DigitalOrder = {
  readonly orderId: OrderId;
  readonly version: OrderVersion;
  readonly exchangeAccountId: ExchangeAccountId;
  readonly beneficialParticipantId: string;
  readonly marketId: ExchangeMarketId;
  readonly family: 'DIGITAL_ASSET';
  readonly side: OrderSide;
  readonly orderType: DigitalOrderType;
  readonly quantity: AssetQuantity;
  readonly remaining: AssetQuantity;
  readonly limitPrice: ExchangePrice | null;
  readonly createdAt: UtcInstant;
  readonly timeInForce: TimeInForce;
  readonly status: OrderStatus;
  readonly clientIdempotencyKey: string;
  readonly authorizationRef: string | null;
  readonly holdId: ExchangeHoldId | null;
  readonly coinHoldId: string | null;
  readonly sourceAccountId: string;
  readonly sequence: number;
  readonly filledQuantity?: AssetQuantity;
  readonly complianceRef?: string | null;
  readonly feeContext?: {
    readonly scheduleId: FeeScheduleId;
    readonly makerBps: bigint;
    readonly takerBps: bigint;
    readonly clientOverrideForbidden: true;
  };
};

export type ExchangeHold = {
  readonly holdId: ExchangeHoldId;
  readonly orderId: OrderId;
  readonly exchangeAccountId: ExchangeAccountId;
  readonly assetKind: 'QUOTE_FIAT' | 'BASE_ASSET';
  readonly fiatAmount: Money | null;
  readonly remainingFiat: Money | null;
  readonly assetAmount: AssetQuantity | null;
  readonly remainingAsset: AssetQuantity | null;
  readonly coinHoldId: string | null;
  readonly state: 'ACTIVE' | 'CAPTURED' | 'RELEASED' | 'PARTIAL';
};

export type ImmutableTrade = {
  readonly tradeId: TradeId;
  readonly executionId: ExecutionId;
  readonly marketId: ExchangeMarketId;
  readonly makerOrderId: OrderId;
  readonly takerOrderId: OrderId;
  readonly quantity: AssetQuantity;
  readonly price: ExchangePrice;
  readonly quoteAmount: Money;
  readonly makerFee: Money;
  readonly takerFee: Money;
  readonly feeScheduleId: FeeScheduleId;
  readonly matchedAt: UtcInstant;
  readonly sequence: MarketDataSequence;
};

export type ClearingInstruction = {
  readonly clearingId: ClearingInstructionId;
  readonly tradeId: TradeId;
  readonly baseDelivery: AssetQuantity;
  readonly quoteDelivery: Money;
  readonly makerFee: Money;
  readonly takerFee: Money;
  readonly makerHoldId: ExchangeHoldId;
  readonly takerHoldId: ExchangeHoldId;
};

export type SettlementRecord = {
  readonly settlementId: SettlementId;
  readonly tradeId: TradeId;
  readonly clearingId: ClearingInstructionId;
  readonly coinJournalId: string | null;
  readonly cashJournalId: string | null;
  readonly feeJournalId: string | null;
  readonly settledAt: UtcInstant;
  readonly atomic: true;
};

export type FeeSchedule = {
  readonly scheduleId: FeeScheduleId;
  readonly version: number;
  readonly makerFeeMinor: bigint;
  readonly takerFeeMinor: bigint;
  readonly listingFeeMinor: bigint;
  readonly computeFeeMinor: bigint;
  readonly makerBps?: bigint;
  readonly takerBps?: bigint;
  readonly commercialPermanence: 'SIMULATION_CONFIGURATION';
};

export type MarketDataSnapshot = {
  readonly marketId: ExchangeMarketId;
  readonly sequence: MarketDataSequence;
  readonly bestBid: ExchangePrice | null;
  readonly bestAsk: ExchangePrice | null;
  readonly lastTrade: ImmutableTrade | null;
  readonly lastPriceLabel: 'SIMULATION_MARKET_PRICE' | 'UNAVAILABLE';
  readonly volume: AssetQuantity;
  readonly depth: {
    readonly bids: readonly { readonly price: ExchangePrice; readonly quantity: AssetQuantity }[];
    readonly asks: readonly { readonly price: ExchangePrice; readonly quantity: AssetQuantity }[];
  };
};

export type Candle = {
  readonly marketId: ExchangeMarketId;
  readonly open: ExchangePrice;
  readonly high: ExchangePrice;
  readonly low: ExchangePrice;
  readonly close: ExchangePrice;
  readonly volume: AssetQuantity;
  readonly label: 'SIMULATION_MARKET_PRICE';
};

export type HaltScope =
  | 'GLOBAL'
  | 'MARKET'
  | 'ASSET'
  | 'PARTICIPANT'
  | 'NEW_ORDERS'
  | 'CANCEL_ONLY'
  | 'WITHDRAWAL_HALT'
  | 'DEPOSIT_CREDIT_HALT';

export type ListingDecision = {
  readonly listingId: ListingId;
  readonly listingVersion: ListingVersion;
  readonly status: ListingStatus;
  readonly legalReviewState: LegalReviewState;
  readonly rdtDisposition: 'RESEARCH_REQUIRED' | 'COUNSEL_REVIEW_REQUIRED';
  readonly actorKind: 'HUMAN_OPERATOR';
  readonly liveApproved: false;
};

export type HaltRecord = {
  readonly scope: HaltScope;
  readonly targetId: string;
  readonly active: boolean;
  readonly reason: string;
};

export type ReconciliationReport = {
  readonly reconciliationId: ReconciliationId;
  readonly outcome: ReconciliationOutcome;
  readonly notes: readonly string[];
  readonly createdAt: UtcInstant;
  readonly autoCorrected: false;
};

export type BookEvent = {
  readonly sequence: number;
  readonly kind: 'ACCEPT' | 'TRADE' | 'CANCEL' | 'HALT' | 'RESUME';
  readonly orderId?: OrderId;
  readonly tradeId?: TradeId;
  readonly at: UtcInstant;
};
