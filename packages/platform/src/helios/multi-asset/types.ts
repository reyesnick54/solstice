/**
 * HELIOS Multi-Asset Expansion — shared identity, authority, and M04 market state types.
 *
 * Reference and research intelligence only. Does not grant Execution Authority.
 */

import type { UtcInstant } from '@solstice/domain';
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

export const HELIOS_MULTI_ASSET_SCHEMA = 'sunrey.helios.multi-asset.v1' as const;
export const HELIOS_MULTI_ASSET_AUTHORITY = 'REFERENCE_ONLY' as const;

export const MULTI_ASSET_IDENTITY_KINDS = [
  'security_etf_proxy',
  'commodity_reference',
  'futures_family',
  'futures_contract',
  'futures_continuous',
] as const;
export type MultiAssetIdentityKind = (typeof MULTI_ASSET_IDENTITY_KINDS)[number];

export const BAR_INTERVALS = ['1h', '4h', '1d'] as const;
export type BarInterval = (typeof BAR_INTERVALS)[number];

export const SESSION_STATUSES = ['OPEN', 'CLOSED', 'PRE_OPEN', 'HALTED', 'UNKNOWN'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ROUTE_STATUSES = [
  'QUALIFIED',
  'DEGRADED',
  'UNAVAILABLE',
  'NOT_CONFIGURED',
  'NOT_QUALIFIED',
  'STALE',
  'ENTITLEMENT_DENIED',
] as const;
export type MultiAssetRouteStatus = (typeof ROUTE_STATUSES)[number];

export type MultiAssetEntitlement = {
  readonly entitlementClass: 'realtime' | 'delayed' | 'end_of_day' | 'sandbox' | 'indicative' | 'unknown';
  readonly licensedForRealtime: boolean;
  readonly delayedMinutes: number | null;
  readonly unavailable: boolean;
};

export type OhlcvBar = {
  readonly interval: BarInterval;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint;
  readonly barOpenTime: string;
  readonly barCloseTime: string;
  readonly priceScale: number;
  readonly currency: string;
};

export type MarketQuote = {
  readonly bidMinorUnits: bigint | null;
  readonly askMinorUnits: bigint | null;
  readonly lastMinorUnits: bigint | null;
  readonly openMinorUnits: bigint | null;
  readonly highMinorUnits: bigint | null;
  readonly lowMinorUnits: bigint | null;
  readonly previousCloseMinorUnits: bigint | null;
  readonly volumeUnits: bigint | null;
  readonly priceScale: number;
  readonly currency: string;
  readonly sessionStatus: SessionStatus;
};

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
