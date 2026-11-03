import type { UtcInstant } from '@solstice/domain';
import type { OrderBookLevel, OrderBookSnapshot } from '../market-observation/types.ts';
import type {
  HELIOS_PREDICTION_MARKET_AUTHORITY,
  HELIOS_PREDICTION_MARKET_SCHEMA,
  PredictionExecutionTwinMode,
  PredictionInstrumentKind,
  PredictionMarketStatus,
  PredictionOutcomeSide,
  PredictionResolutionStatus,
} from './taxonomy.ts';

export type PredictionVenueRef = {
  readonly venueId: 'polymarket_clob_research';
  readonly displayName: string;
  readonly liveTradingEnabled: false;
};

export type PredictionEventMarket = {
  readonly schema: typeof HELIOS_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_PREDICTION_MARKET_AUTHORITY;
  readonly kind: 'prediction_event';
  readonly instrumentId: string;
  readonly slug: string;
  readonly title: string;
  readonly category: string | null;
  readonly markets: readonly PredictionMarketSummary[];
};

export type PredictionMarketSummary = {
  readonly instrumentId: string;
  readonly conditionId: string;
  readonly question: string;
  readonly status: PredictionMarketStatus;
  readonly resolutionStatus: PredictionResolutionStatus;
  readonly expiresAt: UtcInstant | null;
  readonly resolvesAt: UtcInstant | null;
};

export type OutcomeContract = {
  readonly schema: typeof HELIOS_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_PREDICTION_MARKET_AUTHORITY;
  readonly kind: 'outcome_contract';
  readonly instrumentId: string;
  readonly conditionId: string;
  readonly outcomeIndex: number;
  readonly label: string;
  readonly tokenId: string;
};

export type YesNoContract = {
  readonly schema: typeof HELIOS_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_PREDICTION_MARKET_AUTHORITY;
  readonly kind: 'yes_no_contract';
  readonly instrumentId: string;
  readonly conditionId: string;
  readonly side: PredictionOutcomeSide;
  readonly tokenId: string;
  readonly complementarySide: PredictionOutcomeSide;
};

export type PredictionInstrumentRef = {
  readonly instrumentId: string;
  readonly kind: PredictionInstrumentKind;
  readonly conditionId: string;
  readonly tokenId: string | null;
  readonly side: PredictionOutcomeSide | null;
};

export type CloOrderBookSnapshot = {
  readonly contractInstrumentId: string;
  readonly tokenId: string;
  readonly book: OrderBookSnapshot;
  readonly volume24hContracts: bigint;
};

export type CloBookMetrics = {
  readonly contractInstrumentId: string;
  readonly bestBidMinor: bigint | null;
  readonly bestAskMinor: bigint | null;
  readonly midMinor: bigint | null;
  readonly spreadMinor: bigint | null;
  readonly spreadBps: number | null;
  readonly bidDepthContracts: bigint;
  readonly askDepthContracts: bigint;
  readonly imbalanceScaled: number;
  readonly volume24hContracts: bigint;
};

export type PredictionMarketBrowserQuery = {
  readonly status?: PredictionMarketStatus;
  readonly category?: string;
  readonly search?: string;
  readonly limit?: number;
};

export type EntityResolutionBinding = {
  readonly resolutionKey: string;
  readonly providerId: string;
  readonly providerNativeConditionId: string;
  readonly providerNativeTokenId: string;
  readonly canonicalInstrumentId: string;
  readonly resolvedAt: UtcInstant;
};

export type PredictionFeatureVector = {
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly features: Readonly<Record<string, bigint | number | null>>;
};

export type PaperPositionLeg = {
  readonly side: PredictionOutcomeSide;
  readonly quantityContracts: bigint;
  readonly averagePriceMinor: bigint;
};

export type PaperPositionRecord = {
  readonly positionId: string;
  readonly conditionId: string;
  readonly legs: readonly PaperPositionLeg[];
  readonly openedAt: UtcInstant;
  readonly lastUpdatedAt: UtcInstant;
  readonly markPriceMinor: bigint | null;
  readonly unrealizedPnlMinor: bigint;
};

export type SimulatedFillInput = {
  readonly contractInstrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly orderSide: PredictionOutcomeSide;
  readonly quantityContracts: bigint;
  readonly book: CloOrderBookSnapshot;
  readonly asOf: UtcInstant;
};

export type SimulatedFillResult = {
  readonly filled: boolean;
  readonly partial: boolean;
  readonly filledQuantity: bigint;
  readonly averagePriceMinor: bigint;
  readonly spreadCostMinor: bigint;
  readonly reason: string;
};

export type ExposureMetrics = {
  readonly conditionId: string;
  readonly grossContracts: bigint;
  readonly netYesContracts: bigint;
  readonly notionalAtRiskMinor: bigint;
  readonly maxLossMinor: bigint;
  readonly concentrationBySide: Readonly<Record<PredictionOutcomeSide, bigint>>;
};

export type PredictionRiskAssessment = {
  readonly permitted: boolean;
  readonly reasonCodes: readonly string[];
  readonly exposure: ExposureMetrics;
};

export type ExecutionTwinOrder = {
  readonly twinOrderId: string;
  readonly mode: PredictionExecutionTwinMode;
  readonly contractInstrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly outcomeSide: PredictionOutcomeSide;
  readonly quantityContracts: bigint;
  readonly limitPriceMinor: bigint | null;
  readonly submittedAt: UtcInstant;
  readonly status: 'SUBMITTED' | 'SIMULATED_FILL' | 'REJECTED' | 'CANCELLED';
  readonly fill: SimulatedFillResult | null;
};

export type PredictionMarketStoreSnapshot = {
  readonly events: readonly PredictionEventMarket[];
  readonly books: readonly CloOrderBookSnapshot[];
  readonly positions: readonly PaperPositionRecord[];
  readonly twinOrders: readonly ExecutionTwinOrder[];
  readonly entityBindings: readonly EntityResolutionBinding[];
};

export type PredictionMarketEvidenceRecord = {
  readonly evidenceId: string;
  readonly kind: string;
  readonly payloadHash: string;
  readonly sealedAt: UtcInstant;
};

export type OrderBookLevelInput = OrderBookLevel;
