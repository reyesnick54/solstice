/**
 * HELIOS Market Data MD07 — U.S. equity consolidated/direct market-state types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { OrderBookLevel } from '../../market-observation/types.ts';
import { HELIOS_MD07_SCHEMA } from './taxonomy.ts';
import type {
  QuoteTopologyState,
  ShortSaleReferenceState,
  UsEquityAuctionKind,
  UsEquityFeedViewKind,
  UsEquityHaltReason,
  UsEquityImbalanceSide,
  UsEquityLotClassification,
  UsEquityTradingStatusCode,
} from './taxonomy.ts';

export type UsEquityQuoteSide = {
  readonly priceMinorUnits: bigint;
  readonly sizeShares: bigint;
  readonly lotClassification: UsEquityLotClassification;
  readonly venueId: string | null;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
};

export type UsEquityVenueBbo = {
  readonly venueId: string;
  readonly bid: UsEquityQuoteSide | null;
  readonly ask: UsEquityQuoteSide | null;
  readonly topology: QuoteTopologyState;
};

export type UsEquityNbbo = {
  readonly bid: UsEquityQuoteSide | null;
  readonly ask: UsEquityQuoteSide | null;
  readonly topology: QuoteTopologyState;
  readonly contributingVenueIds: readonly string[];
};

export type UsEquityOddLotBest = {
  readonly bestOddLotBid: UsEquityQuoteSide | null;
  readonly bestOddLotAsk: UsEquityQuoteSide | null;
};

export type UsEquityTradePrint = {
  readonly priceMinorUnits: bigint;
  readonly sizeShares: bigint;
  readonly lotClassification: UsEquityLotClassification;
  readonly venueId: string;
  readonly tradeId: string | null;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
};

export type UsEquityDepthSnapshot = {
  readonly bids: readonly OrderBookLevel[];
  readonly asks: readonly OrderBookLevel[];
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly sequence: bigint | null;
};

export type UsEquityAuctionImbalance = {
  readonly auctionKind: UsEquityAuctionKind;
  readonly pairedShares: bigint | null;
  readonly imbalanceShares: bigint | null;
  readonly imbalanceSide: UsEquityImbalanceSide;
  readonly indicativeClearingPriceMinorUnits: bigint | null;
  readonly nearPriceMinorUnits: bigint | null;
  readonly farPriceMinorUnits: bigint | null;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
};

export type UsEquityTradingStatus = {
  readonly status: UsEquityTradingStatusCode;
  readonly haltReason: UsEquityHaltReason;
  readonly haltActive: boolean;
  readonly shortSaleRestriction: boolean;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
};

export type UsEquityAuctionState = {
  readonly auctionKind: UsEquityAuctionKind;
  readonly imbalance: UsEquityAuctionImbalance | null;
  readonly sourceTimestamp: UtcInstant;
};

export type UsEquityFeedView = {
  readonly viewKind: UsEquityFeedViewKind;
  readonly venueBbos: readonly UsEquityVenueBbo[];
  readonly nbbo: UsEquityNbbo | null;
  readonly oddLot: UsEquityOddLotBest;
  readonly lastTrade: UsEquityTradePrint | null;
  readonly depth: UsEquityDepthSnapshot | null;
  readonly auctionImbalance: UsEquityAuctionImbalance | null;
  readonly tradingStatus: UsEquityTradingStatus | null;
  readonly shortSaleState: ShortSaleReferenceState | null;
  readonly observedAt: UtcInstant;
  readonly sourceProviderId: string;
};

export type UsEquityViewDivergence = {
  readonly quoteDivergenceBps: number | null;
  readonly latencyDifferenceMs: number | null;
  readonly directVenueCoverageCount: number;
  readonly consolidatedVenueCoverageCount: number;
  readonly venueCoverageDifference: number;
  /** Always false — one feed view is never silently substituted for the other. */
  readonly substituted: false;
};

export type RoundLotPolicyTier = {
  readonly minPriceMinorUnits: bigint;
  readonly maxPriceMinorUnits: bigint | null;
  readonly roundLotShares: bigint;
};

export type RoundLotPolicyVersion = {
  readonly policyId: string;
  readonly version: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly tiers: readonly RoundLotPolicyTier[];
};

export type RoundLotPolicyRef = {
  readonly policyId: string;
  readonly version: string;
};

export type UsEquityMarketState = {
  readonly schema: typeof HELIOS_MD07_SCHEMA;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly currency: string;
  readonly priceScale: number;
  readonly roundLotPolicyRef: RoundLotPolicyRef;
  readonly directFeedView: UsEquityFeedView | null;
  readonly consolidatedView: UsEquityFeedView | null;
  readonly divergence: UsEquityViewDivergence | null;
  readonly activeAuction: UsEquityAuctionState | null;
  readonly evaluatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type UsEquityVenueQuoteObservation = {
  readonly venueId: string;
  readonly bidPriceMinorUnits: bigint | null;
  readonly bidSizeShares: bigint | null;
  readonly askPriceMinorUnits: bigint | null;
  readonly askSizeShares: bigint | null;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
};

export type UsEquityFeedObservationBundle = {
  readonly viewKind: UsEquityFeedViewKind;
  readonly providerId: string;
  readonly observedAt: UtcInstant;
  readonly venueQuotes: readonly UsEquityVenueQuoteObservation[];
  readonly lastTrade: UsEquityTradePrint | null;
  readonly depth: UsEquityDepthSnapshot | null;
  readonly auctionImbalance: UsEquityAuctionImbalance | null;
  readonly tradingStatus: UsEquityTradingStatus | null;
  readonly shortSaleState: ShortSaleReferenceState | null;
};

export type ComposeUsEquityMarketStateInput = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly currency: string;
  readonly priceScale: number;
  readonly evaluatedAt: UtcInstant;
  readonly referencePriceMinorUnits: bigint | null;
  readonly directFeed: UsEquityFeedObservationBundle | null;
  readonly consolidatedFeed: UsEquityFeedObservationBundle | null;
  readonly roundLotPolicyAsOf: UtcInstant;
};
