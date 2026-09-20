/**
 * HELIOS Multi-Asset Expansion M04 — canonical market state types.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MultiAssetInstrumentRecord } from './m01/types.ts';
import type { MultiAssetObservationBundle, MultiAssetPriceQuote } from './m02/types.ts';
import type { MultiAssetSessionContractRecord } from './m03/types.ts';
import type {
  BarTimeframe,
  FuturesRollState,
  MarketConfidenceBand,
  MarketDataQualityDimension,
  MarketDataQualityState,
  MarketEntitlementState,
  MarketExecutionCapabilityState,
  MarketFreshnessState,
  MarketLiquidityState,
  MarketProviderHealthState,
  MarketSessionState,
  MarketVolatilityState,
  TradabilityReasonCode,
  TradabilityState,
} from './taxonomy.ts';

export type MarketStateEvidenceRef = {
  readonly refType: 'quote' | 'bar' | 'session' | 'instrument' | 'route';
  readonly refId: string;
};

export type MarketDataQualityAssessment = {
  readonly state: MarketDataQualityState;
  readonly dimensions: Readonly<Record<MarketDataQualityDimension, 'PASS' | 'WARN' | 'FAIL'>>;
  readonly flags: readonly TradabilityReasonCode[];
};

/** Canonical usable market state bridging raw observations to research intelligence. */
export type MarketState = {
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly venue: string;
  readonly sessionState: MarketSessionState;
  readonly referencePrice: MultiAssetPriceQuote | null;
  readonly bid: MultiAssetPriceQuote | null;
  readonly ask: MultiAssetPriceQuote | null;
  readonly spread: MultiAssetPriceQuote | null;
  readonly spreadBps: number | null;
  readonly recentVolume: string | null;
  readonly availableBarTimeframes: readonly BarTimeframe[];
  readonly latestObservationTimestamp: UtcInstant | null;
  readonly freshness: MarketFreshnessState;
  readonly dataQuality: MarketDataQualityAssessment;
  readonly volatilityState: MarketVolatilityState;
  readonly liquidityState: MarketLiquidityState;
  readonly futuresRollState: FuturesRollState;
  readonly entitlementState: MarketEntitlementState;
  readonly providerHealth: MarketProviderHealthState;
  readonly executionCapability: MarketExecutionCapabilityState;
  readonly confidence: MarketConfidenceBand;
  readonly evidenceRefs: readonly MarketStateEvidenceRef[];
  readonly evaluatedAt: UtcInstant;
};

/**
 * Capability dimensions kept separate from tradability classification.
 * A price existing does not imply executable capability.
 */
export type MarketCapabilityFlags = {
  readonly observable: boolean;
  readonly researchable: boolean;
  readonly proposalEligible: boolean;
  readonly executable: boolean;
};

export type MarketTradabilityDecision = {
  readonly tradability: TradabilityState;
  readonly capabilities: MarketCapabilityFlags;
  readonly reasonCodes: readonly TradabilityReasonCode[];
  readonly primaryReason: TradabilityReasonCode;
};

export type MarketStateEvaluationInput = {
  readonly instrument: MultiAssetInstrumentRecord;
  readonly observations: MultiAssetObservationBundle;
  readonly sessionContract: MultiAssetSessionContractRecord;
  readonly now: UtcInstant;
};

export type MarketStateEvaluationResult = {
  readonly marketState: MarketState;
  readonly tradability: MarketTradabilityDecision;
};

export type {
  MultiAssetInstrumentRecord,
  MultiAssetObservationBundle,
  MultiAssetPriceQuote,
  MultiAssetQuoteObservation,
  MultiAssetSessionContractRecord,
};
