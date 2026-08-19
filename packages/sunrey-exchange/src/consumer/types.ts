import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExchangeAccountId, ExchangeMarketId, OrderId, TradeId } from '../ids.ts';
import type { DigitalOrder, ImmutableTrade } from '../types.ts';
import type { MarketState } from '../taxonomy.ts';
import type { NativeSettlementStatus } from '../taxonomy.ts';
import type {
  ConsumerAccountStatus,
  ConsumerEnvironment,
  ConsumerFlow,
  ConsumerIdentityClass,
  ConsumerNativeAsset,
  ConsumerNotificationKind,
  ConsumerOrderStatusView,
  ConsumerOrderType,
  ConsumerOrigin,
  ConsumerQuoteKind,
  ConsumerSettlementView,
  ConsumerSide,
  LiquidityWarningCode,
  ValueSourceKind,
} from './taxonomy.ts';

export type ConsumerTradingProfile = {
  readonly profileId: string;
  readonly participantId: string;
  readonly accountId: ExchangeAccountId;
  readonly identityClass: ConsumerIdentityClass;
  readonly jurisdiction: string;
  readonly accountStatus: ConsumerAccountStatus;
  readonly custodyReady: boolean;
  readonly walletReady: boolean;
  readonly complianceState: 'CLEAR' | 'RESTRICTED' | 'BLOCKED';
  readonly environment: ConsumerEnvironment;
  readonly exchangeCapabilityActive: boolean;
};

export type ConsumerEligibilityDecision = {
  readonly profileId: string;
  readonly identityEligible: boolean;
  readonly jurisdictionEligible: boolean;
  readonly accountEligible: boolean;
  readonly marketAvailable: boolean;
  readonly custodyReady: boolean;
  readonly walletReady: boolean;
  readonly exchangeCapabilityActive: boolean;
  readonly complianceClear: boolean;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
};

export type ConsumerHoldingProjection = {
  readonly assetId: ConsumerNativeAsset | 'APPLICATION_FIAT';
  readonly quantity: bigint;
  readonly source: 'CHAIN' | 'CUSTODY' | 'CANONICAL_LEDGER' | 'APPLICATION_FIAT_PRODUCT';
  readonly reserved: bigint;
  readonly pendingSettlement: bigint;
  readonly informationalMarketValue: bigint | null;
  readonly valueSource: ValueSourceKind;
  readonly valueTimestamp: UtcInstant | null;
  readonly redemptionValueGuaranteed: false;
};

export type ConsumerCostBasisAnalytics = {
  readonly informational: true;
  readonly jurisdictionDependent: true;
  readonly taxCorrectnessClaimed: false;
  readonly quantity: bigint;
  readonly assumption: 'DETERMINISTIC_FILL_HISTORY';
};

export type ConsumerPerformanceAnalytics = {
  readonly informationalQuantityChange: bigint;
  readonly calculationAssumption: 'DETERMINISTIC_TRANSACTION_HISTORY';
  readonly investmentPromise: false;
};

export type ConsumerPortfolioProjection = {
  readonly accountId: ExchangeAccountId;
  readonly environment: ConsumerEnvironment;
  readonly productionLabel: 'NON_PRODUCTION' | 'SIMULATION';
  readonly holdings: readonly ConsumerHoldingProjection[];
  readonly openOrders: readonly ConsumerOrderStatus[];
  readonly recentTrades: ConsumerTradeReceipt['fills'];
  readonly pendingSettlement: readonly ConsumerSettlementProjection[];
  readonly costBasis: ConsumerCostBasisAnalytics | null;
  readonly performance: ConsumerPerformanceAnalytics | null;
  readonly createdIndependentStore: false;
  readonly asOf: UtcInstant;
};

export type ConsumerMarketStatistics = {
  readonly valid: boolean;
  readonly reason: 'OK' | 'INSUFFICIENT_HISTORY';
  readonly tradeCount: bigint;
  readonly volume: bigint | null;
  readonly highPriceUnits: bigint | null;
  readonly lowPriceUnits: bigint | null;
};

export type ConsumerMarketView = {
  readonly marketId: ExchangeMarketId;
  readonly baseAsset: 'SUNREY_COIN';
  readonly quoteAsset: 'MOONREY_COIN';
  readonly fixedExchangeRate: false;
  readonly lastEligibleTrade: bigint | null;
  readonly bestBid: bigint | null;
  readonly bestAsk: bigint | null;
  readonly spreadUnits: bigint | null;
  readonly statistics: ConsumerMarketStatistics;
  readonly depthSummary: { readonly bidDepth: bigint; readonly askDepth: bigint };
  readonly marketState: MarketState;
  readonly liquidityWarnings: readonly LiquidityWarningCode[];
  readonly dataTimestamp: UtcInstant;
  readonly marketDataSequence: bigint;
  readonly circuitBreakerExplanation: string;
  readonly confidentialSurveillanceExposed: false;
};

export type ConsumerFeeDisclosure = {
  readonly exchangeFeeQuantity: bigint;
  readonly exchangeFeeAsset: string;
  readonly exchangeFeeConfigured: boolean;
  readonly networkFeeQuantity: bigint;
  readonly networkFeeApplicable: boolean;
  readonly otherKnownCharges: readonly { readonly label: string; readonly quantity: bigint }[];
  readonly productionRatesInvented: false;
  readonly scheduleId: string;
};

export type ConsumerRiskDisclosure = {
  readonly disclosureIds: readonly string[];
  readonly noGuaranteedPrice: true;
  readonly noInvestmentPromise: true;
};

export type ConsumerPriceProtection = {
  readonly kind: 'MAX_ADVERSE_BPS';
  readonly maxAdverseBps: bigint;
  readonly referencePriceUnits: bigint;
  readonly referenceSource: ValueSourceKind;
  readonly limitPriceUnits: bigint;
  readonly guaranteed: false;
};

export type ConsumerQuote = {
  readonly quoteId: string;
  readonly marketId: ExchangeMarketId;
  readonly side: ConsumerSide;
  readonly requestedQuantity: bigint;
  readonly requestedNotional: bigint | null;
  readonly kind: ConsumerQuoteKind;
  readonly informational: boolean;
  readonly guaranteedExecution: false;
  readonly estimatedExecutionPriceUnits: bigint | null;
  readonly estimatedFilledQuantity: bigint;
  readonly estimatedPriceImpactBps: bigint | null;
  readonly fees: ConsumerFeeDisclosure;
  readonly expiresAt: UtcInstant;
  readonly marketDataSequence: bigint;
  readonly marketDataReference: string;
  readonly createdAt: UtcInstant;
};

export type ConsumerTradePreview = {
  readonly previewId: string;
  readonly flow: ConsumerFlow;
  readonly side: ConsumerSide;
  readonly assetReceived: ConsumerNativeAsset;
  readonly assetSpent: ConsumerNativeAsset;
  readonly quantity: bigint;
  readonly estimatedExecutionPriceUnits: bigint | null;
  readonly priceProtection: ConsumerPriceProtection | null;
  readonly estimatedFee: ConsumerFeeDisclosure;
  readonly custodyWalletEffect: string;
  readonly marketState: MarketState;
  readonly riskDisclosure: ConsumerRiskDisclosure;
  readonly humanReadableIntent: string;
  readonly quoteId: string | null;
  readonly marketDataSequence: bigint;
};

export type ConsumerOrderRequest = {
  readonly clientOrderId: string;
  readonly marketId: ExchangeMarketId;
  readonly flow: ConsumerFlow;
  readonly side: ConsumerSide;
  readonly orderType: ConsumerOrderType;
  readonly quantity: bigint;
  readonly limitPriceUnits: bigint | null;
  readonly priceProtectionBps: bigint | null;
  readonly quoteId: string | null;
  readonly previewId: string | null;
};

export type ConsumerConversionRequest = {
  readonly clientOrderId: string;
  readonly fromAsset: ConsumerNativeAsset;
  readonly toAsset: ConsumerNativeAsset;
  readonly quantity: bigint;
  readonly priceProtectionBps: bigint;
  readonly quoteId: string | null;
};

export type ConsumerOrderStatus = {
  readonly clientOrderId: string;
  readonly orderId: OrderId | null;
  readonly canonicalOrderId: OrderId | null;
  readonly view: ConsumerOrderStatusView | 'UNKNOWN';
  readonly side: ConsumerSide;
  readonly orderType: ConsumerOrderType;
  readonly quantity: bigint;
  readonly remaining: bigint;
  readonly marketId: ExchangeMarketId;
  readonly environment: ConsumerEnvironment;
  readonly origin: ConsumerOrigin;
  readonly matchingPriority: 'NONE';
  readonly order: DigitalOrder | null;
};

export type ConsumerSettlementProjection = {
  readonly settlementId: string;
  readonly view: ConsumerSettlementView;
  readonly canonicalStatus: NativeSettlementStatus | 'NONE';
  readonly tradeIds: readonly string[];
  readonly duplicateInstructionCreated: false;
};

export type ConsumerTradeReceipt = {
  readonly receiptId: string;
  readonly orderId: OrderId;
  readonly clientOrderId: string;
  readonly fills: readonly {
    readonly tradeId: TradeId;
    readonly quantity: bigint;
    readonly priceUnits: bigint;
  }[];
  readonly fees: ConsumerFeeDisclosure;
  readonly settlementReference: string | null;
  readonly chainFinalityReference: string | null;
  readonly marketPolicyVersion: number;
  readonly trades: readonly ImmutableTrade[];
};

export type ConsumerFavoriteMarket = {
  readonly favoriteId: string;
  readonly participantId: string;
  readonly marketId: ExchangeMarketId;
  readonly applicationMetadata: true;
};

export type ConsumerPriceAlert = {
  readonly alertId: string;
  readonly participantId: string;
  readonly marketId: ExchangeMarketId;
  readonly direction: 'ABOVE' | 'BELOW';
  readonly thresholdPriceUnits: bigint;
  readonly source: ValueSourceKind;
  readonly marketDataSequence: bigint;
  readonly observedAt: UtcInstant;
  readonly informational: true;
  readonly canTradeAutomatically: false;
};

export type ConsumerWalletAuthorization = {
  readonly walletId: string;
  readonly signedIntentHex: string;
  readonly intentDisplay: string;
  readonly authorizationKind: 'WALLET_SIGNATURE' | 'MOBILE_CONFIRMATION';
};

export type ConsumerAgentMandate = {
  readonly mandateId: string;
  readonly capability: 'CONSUMER_TRADE';
  readonly matchingPriority: 'NONE';
  readonly privilegedPrice: false;
};

export type ConsumerAuthorization = {
  readonly sessionId: string;
  readonly sessionAuthenticated: boolean;
  readonly wallet: ConsumerWalletAuthorization | null;
  readonly origin: ConsumerOrigin;
  readonly agentMandate: ConsumerAgentMandate | null;
};

export type ConsumerAuthorizationDecision = {
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly sessionSufficientToSpend: false;
};

export type ConsumerExchangeReport = {
  readonly marketId: ExchangeMarketId;
  readonly marketState: MarketState;
  readonly openOrders: number;
  readonly alerts: number;
  readonly notifications: number;
  readonly sandboxAccounts: number;
  readonly productionActivated: false;
  readonly secretsPresent: false;
};

export type ConsumerReconciliationReport = {
  readonly projectionHoldings: number;
  readonly exchangeReservations: number;
  readonly trades: number;
  readonly dvpIntents: number;
  readonly custodyAttributed: bigint;
  readonly chainHoldings: bigint;
  readonly outcome: 'MATCHED' | 'INVESTIGATION_REQUIRED';
  readonly notes: readonly string[];
  readonly balancingEntries: false;
  readonly portfolioCreatedBalance: false;
};

export type ConsumerNotification = {
  readonly notificationId: string;
  readonly kind: ConsumerNotificationKind;
  readonly participantId: string;
  readonly body: string;
  readonly at: UtcInstant;
  readonly confidentialSurveillance: false;
};

export type ConsumerApiRejection = {
  readonly ok: false;
  readonly reason: string;
  readonly reasonCodes: readonly string[];
};

export type ConsumerMobileView<T> = {
  readonly canonical: T;
  readonly mobile: Readonly<Record<string, string | boolean | null>>;
};
