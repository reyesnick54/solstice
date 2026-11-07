/**
 * HELIOS MD12 canonical state and event types.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  HELIOS_MD12_AUTHORITY,
  HELIOS_MD12_SCHEMA,
  Md12AnomalyClassification,
  Md12AnomalyKind,
  Md12LiquidityRegime,
  Md12MarketEventKind,
  Md12MicrostructureFeatureName,
  Md12QualityBand,
} from './taxonomy.ts';

export type Md12MarketEventRef = {
  readonly eventId: string;
  readonly kind: Md12MarketEventKind;
  readonly sequence: bigint | null;
  readonly venueId: string;
  readonly providerId: string;
  readonly sourceTimestamp: UtcInstant;
  readonly knowableAt: UtcInstant;
};

export type Md12BookLevel = {
  readonly priceMinorUnits: bigint;
  readonly sizeUnits: bigint;
};

export type Md12MarketEvent = Md12MarketEventRef & {
  readonly instrumentId: string;
  readonly arrivalTimestamp: UtcInstant;
  readonly ingestLatencyMs: number;
  readonly bid: Md12BookLevel | null;
  readonly ask: Md12BookLevel | null;
  readonly tradePriceMinorUnits: bigint | null;
  readonly tradeSizeUnits: bigint | null;
  readonly tradeId: string | null;
  readonly bookBidLevels: readonly Md12BookLevel[];
  readonly bookAskLevels: readonly Md12BookLevel[];
  readonly priorMidMinorUnits: bigint | null;
  readonly referenceMidMinorUnits: bigint | null;
  readonly duplicateTradeFingerprint: string | null;
};

export type MarketDataAnomaly = {
  readonly schema: typeof HELIOS_MD12_SCHEMA;
  readonly authority: typeof HELIOS_MD12_AUTHORITY;
  readonly anomalyId: string;
  readonly kind: Md12AnomalyKind;
  readonly classification: Md12AnomalyClassification;
  readonly instrumentId: string;
  readonly detectedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly summary: string;
  readonly sourceEvent: Md12MarketEventRef;
  readonly relatedEventIds: readonly string[];
  readonly superseded: false;
  readonly retired: false;
};

export type Md12MicrostructureFeature = {
  readonly name: Md12MicrostructureFeatureName;
  readonly valuePpm: bigint | null;
  readonly valueMinorUnits: bigint | null;
  readonly valueUnits: bigint | null;
  readonly knowableAt: UtcInstant;
  readonly lineage: readonly Md12MarketEventRef[];
};

export type MicrostructureState = {
  readonly schema: typeof HELIOS_MD12_SCHEMA;
  readonly authority: typeof HELIOS_MD12_AUTHORITY;
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly features: readonly Md12MicrostructureFeature[];
};

export type LiquidityState = {
  readonly schema: typeof HELIOS_MD12_SCHEMA;
  readonly authority: typeof HELIOS_MD12_AUTHORITY;
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly regime: Md12LiquidityRegime;
  readonly visibleBidDepthUnits: bigint;
  readonly visibleAskDepthUnits: bigint;
  readonly shortHorizonLiquidityScorePpm: bigint;
  readonly lineage: readonly Md12MarketEventRef[];
};

export type MarketDataQualityScoreComponents = {
  readonly freshnessPpm: bigint;
  readonly bookIntegrityPpm: bigint;
  readonly tradeIntegrityPpm: bigint;
  readonly sequenceIntegrityPpm: bigint;
  readonly corroborationPpm: bigint;
  readonly anomalyPenaltyPpm: bigint;
};

export type MarketDataQualityState = {
  readonly schema: typeof HELIOS_MD12_SCHEMA;
  readonly authority: typeof HELIOS_MD12_AUTHORITY;
  readonly instrumentId: string;
  readonly venueId: string;
  readonly providerId: string;
  readonly asOf: UtcInstant;
  readonly band: Md12QualityBand;
  readonly compositeScorePpm: bigint;
  readonly components: MarketDataQualityScoreComponents;
  readonly anomalyCounts: Readonly<Partial<Record<Md12AnomalyClassification, number>>>;
  readonly openAnomalyIds: readonly string[];
  readonly sufficientForResearch: boolean;
  readonly microstructure: MicrostructureState | null;
  readonly liquidity: LiquidityState | null;
};

export type Md12AnomalyStoreSnapshot = {
  readonly anomalies: readonly MarketDataAnomaly[];
  readonly anomalyCount: number;
};
