/**
 * HELIOS Multi-Asset M17 — Dynamic Cross-Asset Correlation types.
 *
 * Portfolio-risk and research capability only. Does not approve or reject orders.
 */

import type { UtcInstant } from '@solstice/domain';
import type { BarTimeframe } from '../../market-observation/types.ts';
import type {
  CorrelationChangeKind,
  CorrelationDataQualityBand,
  CorrelationMethodology,
  CorrelationRelationshipState,
  CorrelationWindowHorizon,
} from './taxonomy.ts';

export const HELIOS_MULTI_ASSET_M17_CORRELATION_CONTEXT_SCHEMA =
  'sunrey.helios.multi-asset.m17.correlation-context.v1' as const;

export type CorrelationPairExposure = {
  readonly instrumentId: string;
  readonly correlationBps: number;
  readonly sharedFactorRefs: readonly string[];
};

export type CorrelationContextInput = {
  readonly schema: typeof HELIOS_MULTI_ASSET_M17_CORRELATION_CONTEXT_SCHEMA;
  readonly portfolioId: string;
  readonly targetInstrumentId: string;
  readonly averageCorrelationBps: number;
  readonly maxCorrelationBps: number;
  readonly correlatedExposureMinor: string;
  readonly pairExposures: readonly CorrelationPairExposure[];
  readonly stateVersion: string;
  readonly computedAt: string;
};

export function createCorrelationContextInput(
  input: Omit<CorrelationContextInput, 'schema'>,
): CorrelationContextInput {
  return Object.freeze({
    schema: HELIOS_MULTI_ASSET_M17_CORRELATION_CONTEXT_SCHEMA,
    ...input,
  });
}

export type CorrelationBarObservation = {
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly timeframe: BarTimeframe;
  readonly sourceEventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly closeMinor: bigint;
  readonly observationId: string;
  readonly providerId: string;
};

export type CorrelationWindowConfig = {
  readonly returnInterval: BarTimeframe;
  readonly shortLookback: number;
  readonly mediumLookback: number;
  readonly longLookback: number;
  readonly minSampleSize: number;
  readonly staleAfterMs: number;
  readonly validForMs: number;
};

export type CorrelationSourceBarRef = {
  readonly observationId: string;
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly closeMinor: bigint;
};

export type CorrelationArtifact = {
  readonly artifactId: string;
  readonly instrumentA: string;
  readonly instrumentB: string;
  readonly methodology: CorrelationMethodology;
  readonly returnInterval: BarTimeframe;
  readonly lookback: number;
  readonly windowHorizon: CorrelationWindowHorizon;
  readonly sampleSize: number;
  /** Basis points: -10000..+10000 maps to -1.0..+1.0. Null when insufficient data. */
  readonly correlationBps: number | null;
  readonly dataQuality: CorrelationDataQualityBand;
  readonly relationshipState: CorrelationRelationshipState;
  readonly calculationTimestamp: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly sourceBars: readonly CorrelationSourceBarRef[];
};

export type CorrelationMatrixCell = {
  readonly instrumentA: string;
  readonly instrumentB: string;
  readonly correlationBps: number | null;
  readonly relationshipState: CorrelationRelationshipState;
  readonly artifactId: string | null;
};

export type CorrelationMatrix = {
  readonly instrumentIds: readonly string[];
  readonly horizon: CorrelationWindowHorizon;
  readonly asOf: UtcInstant;
  readonly cells: readonly CorrelationMatrixCell[];
};

export type CorrelationCluster = {
  readonly clusterId: string;
  readonly instrumentIds: readonly string[];
  readonly horizon: CorrelationWindowHorizon;
  readonly minInternalCorrelationBps: number;
  readonly capturedAt: UtcInstant;
};

export type CorrelationChangeEvent = {
  readonly changeId: string;
  readonly instrumentA: string;
  readonly instrumentB: string;
  readonly kind: CorrelationChangeKind;
  readonly priorCorrelationBps: number | null;
  readonly currentCorrelationBps: number | null;
  readonly deltaBps: number | null;
  readonly detectedAt: UtcInstant;
};

export type PortfolioExposurePosition = {
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly notionalMinor: bigint;
};

export type PortfolioCorrelationLookup = {
  readonly proposedInstrumentId: string;
  readonly asOf: UtcInstant;
  readonly horizon: CorrelationWindowHorizon;
  readonly positionCorrelations: readonly {
    readonly instrumentId: string;
    readonly correlationBps: number | null;
    readonly relationshipState: CorrelationRelationshipState;
    readonly artifactId: string | null;
  }[];
  readonly maxCorrelationBps: number | null;
  readonly maxCorrelatedInstrumentId: string | null;
  readonly wouldMateriallyIncreaseCorrelatedExposure: boolean;
  readonly sharedRiskClusterIds: readonly string[];
  readonly researchOnly: true;
};

export type CorrelationEngineSnapshot = {
  readonly artifacts: readonly CorrelationArtifact[];
  readonly clusters: readonly CorrelationCluster[];
  readonly changes: readonly CorrelationChangeEvent[];
  readonly capturedAt: UtcInstant;
};
