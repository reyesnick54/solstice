/**
 * OS14 canonical prediction-market / CLOB microstructure types.
 *
 * Implied market prices are market consensus — not objective probability.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  CrossOutcomeConsistencyCode,
  HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
  HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
  HELIOS_OS14_FEATURE_FABRIC_SCHEMA,
  PredictionMarketCategory,
  PredictionMarketResolutionState,
  PredictionObservationKind,
  PredictionOutcomeSide,
  ResearchSignalKind,
} from './taxonomy.ts';

export type PredictionMarketResolutionMetadata = {
  readonly resolutionState: PredictionMarketResolutionState;
  readonly resolveAt: UtcInstant | null;
  readonly resolvedAt: UtcInstant | null;
  readonly resolutionSourceId: string | null;
  readonly resolutionCriteriaHash: string | null;
};

/** Canonical instrument for a binary prediction market (paired YES/NO outcomes). */
export type PredictionMarketInstrument = {
  readonly schema: typeof HELIOS_OS14_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_OS14_PREDICTION_MARKET_AUTHORITY;
  readonly instrumentId: string;
  readonly marketSlug: string;
  readonly question: string;
  readonly category: PredictionMarketCategory;
  readonly venueId: string;
  readonly currency: 'USDC';
  readonly outcomes: readonly PredictionOutcome[];
  readonly resolution: PredictionMarketResolutionMetadata;
  readonly researchOnly: true;
  readonly permitsLiveWagering: false;
};

export type PredictionOutcome = {
  readonly outcomeId: string;
  readonly side: PredictionOutcomeSide;
  readonly complementaryOutcomeId: string;
  readonly tokenSymbol: string | null;
};

export type PredictionBookLevel = {
  readonly impliedProbabilityPpm: bigint;
  readonly sizeUsdcMinor: bigint;
  readonly depthRank: number;
};

export type PredictionOrderBookSide = {
  readonly levels: readonly PredictionBookLevel[];
  readonly totalUsdcMinor: bigint;
  readonly bestImpliedProbabilityPpm: bigint | null;
};

/** Normalized central limit order book for paired YES/NO tokens. */
export type PredictionOrderBook = {
  readonly schema: typeof HELIOS_OS14_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_OS14_PREDICTION_MARKET_AUTHORITY;
  readonly instrumentId: string;
  readonly marketSlug: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly yesBids: PredictionOrderBookSide;
  readonly yesAsks: PredictionOrderBookSide;
  readonly noBids: PredictionOrderBookSide;
  readonly noAsks: PredictionOrderBookSide;
  readonly sequence: bigint | null;
};

export type PredictionMicrostructureMetrics = {
  readonly impliedMarketMidPpm: bigint;
  readonly yesSpreadPpm: bigint;
  readonly bookImbalancePpm: bigint;
  readonly bidDepthUsdcMinor: bigint;
  readonly askDepthUsdcMinor: bigint;
  readonly totalVisibleLiquidityUsdcMinor: bigint;
  readonly crossOutcomeConsistency: CrossOutcomeConsistencyCode;
  readonly complementSumBestAskPpm: bigint | null;
  readonly complementSumBestBidPpm: bigint | null;
};

export type PredictionMarketProvenance = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly observationId: string;
  readonly rawPayloadHash: string;
  readonly upstreamSourceRef: string;
  readonly upstreamRepository: string;
  readonly upstreamReferenceSha: string;
  readonly upstreamLicense: string;
};

export type PredictionMarketObservation = {
  readonly schema: typeof HELIOS_OS14_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_OS14_PREDICTION_MARKET_AUTHORITY;
  readonly observationKind: PredictionObservationKind;
  readonly observationId: string;
  readonly instrumentId: string;
  readonly marketSlug: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly provenance: PredictionMarketProvenance;
  readonly impliedMarketMidPpm: bigint | null;
  readonly volumeUsdcMinor: bigint | null;
  readonly orderBook: PredictionOrderBook | null;
  readonly microstructure: PredictionMicrostructureMetrics | null;
};

/** Aggregated research state for one market at a knowable time. */
export type PredictionMarketState = {
  readonly schema: typeof HELIOS_OS14_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_OS14_PREDICTION_MARKET_AUTHORITY;
  readonly instrument: PredictionMarketInstrument;
  readonly asOfKnowableAt: UtcInstant;
  readonly latestObservation: PredictionMarketObservation | null;
  readonly orderBook: PredictionOrderBook | null;
  readonly microstructure: PredictionMicrostructureMetrics | null;
  readonly relatedMarketInstrumentIds: readonly string[];
};

/** Fee-adjusted research edge vs a stated prior — not execution intent. */
export type ProbabilityEdgeObservation = {
  readonly schema: typeof HELIOS_OS14_PREDICTION_MARKET_SCHEMA;
  readonly authority: typeof HELIOS_OS14_PREDICTION_MARKET_AUTHORITY;
  readonly observationId: string;
  readonly instrumentId: string;
  readonly marketSlug: string;
  readonly computedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly impliedMarketMidPpm: bigint;
  readonly researchPriorPpm: bigint;
  readonly rawEdgePpm: bigint;
  readonly feePpmPerSide: bigint;
  readonly feeAdjustedEdgePpm: bigint;
  readonly suggestedResearchSide: PredictionOutcomeSide | null;
  readonly researchSignalKind: ResearchSignalKind;
  readonly detail: string;
  readonly provenance: PredictionMarketProvenance;
};

export type PredictionMarketFeatureSnapshot = {
  readonly schema: typeof HELIOS_OS14_FEATURE_FABRIC_SCHEMA;
  readonly authority: typeof HELIOS_OS14_PREDICTION_MARKET_AUTHORITY;
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly impliedMarketMidPpm: bigint | null;
  readonly yesSpreadPpm: bigint | null;
  readonly bookImbalancePpm: bigint | null;
  readonly totalVisibleLiquidityUsdcMinor: bigint | null;
  readonly crossOutcomeConsistency: CrossOutcomeConsistencyCode | null;
  readonly feeAdjustedEdgePpm: bigint | null;
};

export type SealedPredictionMarketObservation = {
  readonly observation: PredictionMarketObservation;
  readonly envelopeObservationId: string;
  readonly sealedAt: UtcInstant;
};

export type IngestPredictionMarketObservationInput = {
  readonly instrument: PredictionMarketInstrument;
  readonly orderBook: PredictionOrderBook;
  readonly volumeUsdcMinor?: bigint | null;
  readonly provenance: Omit<
    PredictionMarketProvenance,
    'upstreamRepository' | 'upstreamReferenceSha' | 'upstreamLicense'
  >;
  readonly relatedMarketInstrumentIds?: readonly string[];
};

export type IngestPredictionMarketObservationResult =
  | {
      readonly ok: true;
      readonly sealed: SealedPredictionMarketObservation;
      readonly state: PredictionMarketState;
      readonly features: PredictionMarketFeatureSnapshot;
      readonly probabilityEdge: ProbabilityEdgeObservation | null;
      readonly evidenceId: string | null;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type PredictionMarketStoreSnapshot = {
  readonly states: Readonly<Record<string, PredictionMarketState>>;
  readonly observations: readonly PredictionMarketObservation[];
};
