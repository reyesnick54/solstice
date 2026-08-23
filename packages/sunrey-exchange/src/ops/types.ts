import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CaseManagementPort } from '../../../kernel/src/regulated/case-management.ts';
import type { ExchangeAccountId, ExchangeMarketId, OrderId, TradeId } from '../ids.ts';
import type { ExchangePrice } from '../price.ts';
import type { DigitalOrder, ImmutableTrade } from '../types.ts';
import type { ExchangeKillSwitch } from '../regulated/kill-switches.ts';
import type { NativeClearingEngine } from '../native-clearing/engine.ts';
import type {
  CanonicalMarketFamily,
  CircuitBreakerState,
  GatewayProtocol,
  MarketDataStream,
  MarketDataTier,
  MarketSessionMode,
  MarketState,
  OperationalOrderType,
  ProductionActivationGate,
  ReferencePriceSource,
  TradingEnvironment,
} from './taxonomy.ts';

export type MarketOperationsPolicy = {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly focusFamily: 'DIGITAL_ASSET';
  readonly nativeMarket: {
    readonly baseAsset: 'SUNREY_COIN';
    readonly quoteAsset: 'MOONREY_COIN';
    readonly fixedPeg: false;
    readonly guaranteedPriceRelationship: false;
  };
  readonly sessionModeByMarket: Readonly<Record<string, MarketSessionMode>>;
  readonly orderTypes: readonly OperationalOrderType[];
  readonly selfTradePolicy: import('../taxonomy.ts').SelfTradePolicy;
  readonly priceCollarBps: bigint;
  readonly protectionCollarBps: bigint;
  readonly volatilityTriggerBps: bigint;
  readonly circuitBreakerTarget: CircuitBreakerState;
  readonly reopenWithAuction: boolean;
  readonly settlementQueueLimit: bigint;
  readonly cancelOnDisconnectDefault: boolean;
  readonly marketMakerHiddenPriority: false;
  readonly aiMayAuthorizeMarketRestriction: false;
  readonly productionActivated: false;
};

export type MarketSession = {
  readonly sessionId: string;
  readonly marketId: ExchangeMarketId;
  readonly mode: MarketSessionMode;
  readonly timezone: 'UTC';
  readonly openUtc: string | null;
  readonly closeUtc: string | null;
  readonly continuous: boolean;
};

export type OperationalMarketState = {
  readonly marketId: ExchangeMarketId;
  readonly family: CanonicalMarketFamily;
  readonly state: MarketState;
  readonly previousState: MarketState | null;
  readonly reason: string;
  readonly actorKind: 'HUMAN' | 'SECURITY_AUTHORITY' | 'POLICY' | 'AI';
  readonly accepted: boolean;
  readonly updatedAt: UtcInstant;
};

export type DepthLevel = {
  readonly priceUnits: bigint;
  readonly quantity: bigint;
  readonly orderCount: number;
};

export type MarketDataBook = {
  readonly marketId: ExchangeMarketId;
  readonly bids: readonly DepthLevel[];
  readonly asks: readonly DepthLevel[];
};

export type MarketDataSnapshot = {
  readonly marketId: ExchangeMarketId;
  readonly stream: MarketDataStream;
  readonly sequence: bigint;
  readonly snapshotId: string;
  readonly at: UtcInstant;
  readonly state: MarketState;
  readonly auctionState: AuctionState | null;
  readonly bestBid: bigint | null;
  readonly bestAsk: bigint | null;
  readonly lastTradePrice: bigint | null;
  readonly lastTradeQuantity: bigint | null;
  readonly depth: MarketDataBook;
  readonly volume: bigint;
  readonly tradeCount: bigint;
  readonly digest: string;
  readonly lastPriceLabel: 'SIMULATION_MARKET_PRICE' | 'UNAVAILABLE';
};

export type MarketDataSequence = {
  readonly marketId: ExchangeMarketId;
  readonly stream: MarketDataStream;
  readonly sessionId: string;
  readonly nextSequence: bigint;
};

export type MarketDataIncrement = {
  readonly marketId: ExchangeMarketId;
  readonly stream: MarketDataStream;
  readonly sequence: bigint;
  readonly snapshotSeq: bigint;
  readonly kind: 'TRADE' | 'BBO' | 'DEPTH' | 'STATE' | 'AUCTION' | 'STATISTICS';
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
  readonly digest: string;
  readonly at: UtcInstant;
};

export type TradingCredential = {
  readonly credentialId: string;
  readonly participantId: string;
  readonly accountId: ExchangeAccountId;
  readonly marketPermissions: readonly CanonicalMarketFamily[];
  readonly environment: TradingEnvironment;
  readonly sessionId: string;
  readonly protocol: GatewayProtocol;
  readonly cancelOnDisconnect: boolean;
  readonly marketMaker: boolean;
  readonly custodyPrivateKeyPresent: false;
};

export type TradingSession = {
  readonly sessionId: string;
  readonly credentialId: string;
  readonly participantId: string;
  readonly accountId: ExchangeAccountId;
  readonly environment: TradingEnvironment;
  readonly protocol: GatewayProtocol;
  readonly inboundSeq: bigint;
  readonly outboundSeq: bigint;
  readonly authenticated: boolean;
  readonly cancelOnDisconnect: boolean;
  readonly lastHeartbeatAt: UtcInstant;
};

export type OrderRatePolicy = {
  readonly participantId: string;
  readonly accountId: ExchangeAccountId;
  readonly marketId: ExchangeMarketId;
  readonly ordersPerSecond: bigint;
  readonly cancelsPerSecond: bigint;
  readonly maxOpenOrders: bigint;
  readonly maxQuantity: bigint;
  readonly maxNotional: bigint;
};

export type MarketRiskControl = {
  readonly marketId: ExchangeMarketId;
  readonly participantEligible: boolean;
  readonly marketEligible: boolean;
  readonly accountRestricted: boolean;
  readonly reservationAvailable: boolean;
  readonly quantityWithinLimit: boolean;
  readonly priceWithinCollar: boolean;
  readonly killSwitchClear: boolean;
  readonly complianceClear: boolean;
  readonly settlementHealthy: boolean;
  readonly custodyHealthy: boolean;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
};

export type VolatilityControl = {
  readonly marketId: ExchangeMarketId;
  readonly windowTrades: number;
  readonly highPriceUnits: bigint | null;
  readonly lowPriceUnits: bigint | null;
  readonly triggerBps: bigint;
  readonly triggered: boolean;
  readonly reason: string | null;
};

export type CircuitBreaker = {
  readonly breakerId: string;
  readonly marketId: ExchangeMarketId;
  readonly engaged: boolean;
  readonly targetState: CircuitBreakerState;
  readonly actorKind: 'HUMAN' | 'SECURITY_AUTHORITY' | 'POLICY' | 'AI';
  readonly accepted: boolean;
  readonly reasonCodes: readonly string[];
};

export type AuctionState = {
  readonly auctionId: string;
  readonly marketId: ExchangeMarketId;
  readonly phase: 'COLLECTING' | 'PRICE_DISCOVERY' | 'ALLOCATED' | 'TRANSITIONED' | 'IDLE';
  readonly eligibleOrderTypes: readonly OperationalOrderType[];
  readonly indicativePrice: bigint | null;
  readonly allocatedQuantity: bigint;
  readonly unfilledBidQuantity: bigint;
  readonly unfilledOfferQuantity: bigint;
  readonly tieBreak: 'PRICE_THEN_SEQUENCE';
  readonly method: 'UNIFORM_PRICE';
};

export type LiquidityMetric = {
  readonly marketId: ExchangeMarketId;
  readonly spreadUnits: bigint | null;
  readonly bidDepth: bigint;
  readonly askDepth: bigint;
  readonly turnover: bigint;
  readonly imbalanceBps: bigint | null;
  readonly priceImpactBps: bigint | null;
  readonly activeParticipants: number;
  readonly marketMakerParticipationBps: bigint;
  readonly commercialPricing: false;
};

export type MarketMakerSession = {
  readonly sessionId: string;
  readonly participantId: string;
  readonly accountId: ExchangeAccountId;
  readonly marketId: ExchangeMarketId;
  readonly designation: 'OPERATIONAL_CONTRACTUAL_ROLE';
  readonly protocolPrivilege: false;
  readonly hiddenPriority: false;
  readonly twoSidedRequired: boolean;
  readonly active: boolean;
};

export type MarketMakerQuote = {
  readonly quoteId: string;
  readonly sessionId: string;
  readonly marketId: ExchangeMarketId;
  readonly bidPriceUnits: bigint;
  readonly bidQuantity: bigint;
  readonly askPriceUnits: bigint;
  readonly askQuantity: bigint;
  readonly bidOrderId: OrderId | null;
  readonly askOrderId: OrderId | null;
};

export type ExchangeOperationalReport = {
  readonly marketId: ExchangeMarketId;
  readonly state: MarketState;
  readonly orderRatePerSecond: bigint;
  readonly tradeRatePerSecond: bigint;
  readonly spreadUnits: bigint | null;
  readonly bidDepth: bigint;
  readonly askDepth: bigint;
  readonly settlementQueueDepth: bigint;
  readonly surveillanceAlertCount: number;
  readonly providerHealth: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
  readonly killSwitches: readonly ExchangeKillSwitch[];
  readonly secretsPresent: false;
};

export type OperationalCheckpoint = {
  readonly orders: number;
  readonly reservations: number;
  readonly trades: number;
  readonly settlementIntents: number;
  readonly finalizedDvp: number;
  readonly custodyAttribution: bigint;
  readonly outcome: 'MATCHED' | 'INVESTIGATION_REQUIRED';
  readonly notes: readonly string[];
  readonly balancingEntries: false;
};

export type MarketReplayEvent = {
  readonly seq: bigint;
  readonly kind: 'ORDER' | 'CANCEL' | 'STATE' | 'POLICY' | 'TRADE';
  readonly at: UtcInstant;
  readonly payload: Readonly<Record<string, string>>;
};

export type InstitutionalOrderRequest = {
  readonly clOrdId: string;
  readonly marketId: ExchangeMarketId;
  readonly side: 'BUY' | 'SELL';
  readonly orderType: OperationalOrderType;
  readonly quantity: bigint;
  readonly priceUnits: bigint | null;
  readonly origClOrdId?: string;
};

export type InstitutionalOrderAck = {
  readonly outcome: 'ACK' | 'REJECT' | 'IDEMPOTENT_REPLAY';
  readonly clOrdId: string;
  readonly orderId: OrderId | null;
  readonly status: DigitalOrder['status'] | 'UNKNOWN';
  readonly inboundSeq: bigint;
  readonly reason: string | null;
  readonly order: DigitalOrder | null;
};

export type GatewayRecovery = {
  readonly sessionId: string;
  readonly lastInboundSeq: bigint;
  readonly lastOutboundSeq: bigint;
  readonly openOrders: readonly DigitalOrder[];
};

export type CustodyHealthView = {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
  readonly reconciled: boolean;
  readonly attributedQuantity: bigint;
};

export type SettlementHealthView = {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly pendingIntents: bigint;
  readonly queueLimit: bigint;
};

export type SurveillanceCandidate = {
  readonly kind: string;
  readonly marketId: string;
  readonly subjectRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly outputClass: 'CANDIDATE_ALERT';
  readonly legalConclusion: false;
};

export type SurveillancePort = {
  observe(input: {
    readonly marketId: string;
    readonly orders: readonly DigitalOrder[];
    readonly trades: readonly ImmutableTrade[];
    readonly now: UtcInstant;
  }): readonly SurveillanceCandidate[];
};

export type CustodyHealthPort = {
  health(): CustodyHealthView;
};

export type MarketOpsPorts = {
  readonly clearing?: NativeClearingEngine;
  readonly cases?: CaseManagementPort;
  readonly surveillance?: SurveillancePort;
  readonly custody?: CustodyHealthPort;
};

export type ProductionMarketActivation = {
  readonly gates: Readonly<Record<ProductionActivationGate, boolean>>;
  readonly engineeringComplete: boolean;
  readonly productionActivated: false;
  readonly liveFlagsRemainDisabled: true;
  readonly reasonCodes: readonly string[];
};

export type PublicMarketDataView = {
  readonly tier: MarketDataTier;
  readonly marketId: ExchangeMarketId;
  readonly delayedMs: number;
  readonly depthLevels: number;
  readonly bestBid: bigint | null;
  readonly bestAsk: bigint | null;
  readonly lastTradePrice: bigint | null;
  readonly state: MarketState;
  readonly sequence: bigint;
};

export type DeveloperSandboxContext = {
  readonly apiKeyId: string;
  readonly environment: 'SANDBOX';
  readonly canTradeProductionFunds: false;
  readonly requiresTradingAuthorityForProduction: true;
};
