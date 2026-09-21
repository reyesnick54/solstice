/**
 * HELIOS Multi-Asset M13 — market regime artifact and evaluation types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { MarketStateEvidenceRef } from '../market-state-types.ts';
import type {
  MarketFreshnessState,
  MarketLiquidityState,
  MarketSessionState,
  MarketVolatilityState,
} from '../taxonomy.ts';
import type {
  MarketRegimeDataQualityState,
  MarketRegimeDimension,
  MarketRegimeScope,
} from './taxonomy.ts';

export type RegimeBarInput = {
  readonly barId: string;
  readonly closeMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly volume?: string | null;
  readonly knowableAt: UtcInstant;
  readonly spreadBps?: number | null;
};

export type CrossAssetReturnInput = {
  readonly instrumentId: string;
  readonly returnBps: number;
};

export type CorrelationInput = {
  readonly pair: string;
  readonly correlationBps: number;
};

export type DetectedRegime = {
  readonly dimension: MarketRegimeDimension;
  /** Confidence/strength on 0..10000 scale. Zero means present but not actionable. */
  readonly strengthBps: number;
};

export type MarketRegimeObservation = {
  readonly observationId: string;
  readonly label: string;
  readonly value: string;
};

export type MarketRegime = {
  readonly regimeId: string;
  readonly scope: MarketRegimeScope;
  readonly scopeId: string;
  readonly assetClass: string | null;
  readonly asOf: UtcInstant;
  readonly detectedRegimes: readonly DetectedRegime[];
  readonly dataQualityState: MarketRegimeDataQualityState;
  readonly observationsUsed: readonly MarketRegimeObservation[];
  readonly methodologyVersion: string;
  readonly evidenceRefs: readonly MarketStateEvidenceRef[];
  readonly validUntil: UtcInstant;
  readonly invalidatingConditions: readonly string[];
};

export type MarketRegimeEvaluationInput = {
  readonly scope: MarketRegimeScope;
  readonly scopeId: string;
  readonly assetClass?: string | null;
  readonly now: UtcInstant;
  readonly sessionState: MarketSessionState;
  readonly freshness: MarketFreshnessState;
  readonly liquidityState: MarketLiquidityState;
  readonly volatilityState: MarketVolatilityState;
  readonly spreadBps: number | null;
  readonly bars: readonly RegimeBarInput[];
  readonly minBarsRequired?: number;
  readonly validForMs?: number;
  readonly crossAssetReturns?: readonly CrossAssetReturnInput[];
  readonly correlations?: readonly CorrelationInput[];
  readonly macroEventActive?: boolean;
  readonly longerTimeframeRegimes?: readonly MarketRegimeDimension[];
  readonly evidenceRefs?: readonly MarketStateEvidenceRef[];
};

export type MarketRegimeEvaluationResult = {
  readonly regime: MarketRegime;
  readonly insufficientData: boolean;
  readonly staleData: boolean;
  readonly conflictingIndicators: boolean;
  readonly multiTimeframeDisagreement: boolean;
};

export type RegimeTransition = {
  readonly transitionId: string;
  readonly scope: MarketRegimeScope;
  readonly scopeId: string;
  readonly dimension: MarketRegimeDimension;
  readonly startedAt: UtcInstant;
  readonly endedAt: UtcInstant | null;
  readonly startStrengthBps: number;
  readonly endStrengthBps: number | null;
  readonly startRegimeId: string;
  readonly endRegimeId: string | null;
};

export type MarketRegimeStoreSnapshot = {
  readonly activeTransitions: readonly RegimeTransition[];
  readonly completedTransitions: readonly RegimeTransition[];
  readonly latestRegimes: readonly MarketRegime[];
};
