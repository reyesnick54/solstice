/**
 * HELIOS Multi-Asset Expansion M18 — portfolio factor and economic exposure graph.
 */

import type { UtcInstant } from '@solstice/domain';

import type { CorrelationCluster, CorrelationMatrix } from '../m17/types.ts';
import type { EconomicRelationshipGraph } from './economic-relationships/types.ts';

export const EXPOSURE_DIMENSIONS = [
  'GROSS_EXPOSURE',
  'NET_EXPOSURE',
  'ASSET_CLASS_EXPOSURE',
  'INSTRUMENT_EXPOSURE',
  'EQUITY_BETA',
  'SECTOR_EXPOSURE',
  'TECHNOLOGY_GROWTH_EXPOSURE',
  'CRYPTO_EXPOSURE',
  'GOLD_METALS_EXPOSURE',
  'ENERGY_EXPOSURE',
  'COMMODITY_EXPOSURE',
  'CURRENCY_EXPOSURE',
  'USD_EXPOSURE',
  'VOLATILITY_EXPOSURE',
  'LONG_EXPOSURE',
  'SHORT_EXPOSURE',
  'VENUE_CONCENTRATION',
  'STRATEGY_CONCENTRATION',
  'DURATION',
  'RATES',
  'OPTIONS_GREEKS',
  'GEOGRAPHIC',
] as const;

export type ExposureDimension = (typeof EXPOSURE_DIMENSIONS)[number];

export const EXPOSURE_PROVENANCE_KINDS = [
  'DIRECTLY_MEASURED',
  'DERIVED',
  'MODEL_ESTIMATED',
] as const;

export type ExposureProvenanceKind = (typeof EXPOSURE_PROVENANCE_KINDS)[number];

export type PortfolioPositionFact = {
  readonly positionId: string;
  readonly instrumentId: string;
  readonly strategyId: string;
  readonly venueId: string;
  readonly providerId: string;
  readonly assetClass: string;
  readonly currency: string;
  readonly quantityUnits: bigint;
  readonly marketValueMinor: bigint;
  readonly side: 'LONG' | 'SHORT';
  readonly status: 'OPEN' | 'CLOSED';
  readonly openedAt: UtcInstant;
  readonly closedAt: UtcInstant | null;
};

export type InstrumentExposureMetadata = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly assetClass: string;
  readonly venueId: string;
  readonly tradingCurrency: string;
  readonly settlementCurrency: string;
  readonly underlyingInstrumentId: string | null;
  readonly sourceRefs: readonly string[];
};

export type ExposureContribution = {
  readonly contributionId: string;
  readonly positionId: string;
  readonly instrumentId: string;
  readonly dimension: ExposureDimension;
  readonly bucketKey: string;
  readonly signedExposureMinor: bigint;
  readonly grossExposureMinor: bigint;
  readonly provenanceKind: ExposureProvenanceKind;
  readonly sourceRefs: readonly string[];
};

export type ExposureAggregate = {
  readonly dimension: ExposureDimension;
  readonly bucketKey: string;
  readonly netExposureMinor: bigint;
  readonly grossExposureMinor: bigint;
  readonly concentrationBps: number;
  readonly provenanceKind: ExposureProvenanceKind;
  readonly sourceRefs: readonly string[];
};

export type AppliedEconomicRelationship = {
  readonly relationshipId: string;
  readonly kind: string;
  readonly fromInstrumentId: string;
  readonly toInstrumentId: string;
  readonly contributingPositionIds: readonly string[];
  readonly provenanceKind: ExposureProvenanceKind;
  readonly sourceRefs: readonly string[];
};

export type PortfolioExposureGraph = {
  readonly graphId: string;
  readonly portfolioId: string;
  readonly asOf: UtcInstant;
  readonly reportingCurrency: string;
  readonly totalGrossExposureMinor: bigint;
  readonly totalNetExposureMinor: bigint;
  readonly positions: readonly PortfolioPositionFact[];
  readonly contributions: readonly ExposureContribution[];
  readonly aggregates: Readonly<Partial<Record<ExposureDimension, readonly ExposureAggregate[]>>>;
  readonly correlationMatrix: CorrelationMatrix | null;
  readonly topCorrelatedCluster: CorrelationCluster | null;
  readonly economicRelationships: EconomicRelationshipGraph;
  readonly appliedRelationships: readonly AppliedEconomicRelationship[];
  readonly simulationOnly: true;
};

export type ProposedTradeInput = {
  readonly instrumentId: string;
  readonly strategyId: string;
  readonly venueId: string;
  readonly providerId: string;
  readonly assetClass: string;
  readonly currency: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: bigint;
  readonly marketValueMinor: bigint;
};

export type ProvisionalExposureThreshold = {
  readonly thresholdId: string;
  readonly dimension: ExposureDimension;
  readonly bucketKey?: string;
  readonly maxGrossExposureMinor?: bigint;
  readonly maxNetExposureMinor?: bigint;
  readonly maxConcentrationBps?: number;
};

export type BreachedProvisionalThreshold = {
  readonly thresholdId: string;
  readonly dimension: ExposureDimension;
  readonly bucketKey: string;
  readonly observedGrossExposureMinor: bigint;
  readonly observedNetExposureMinor: bigint;
  readonly observedConcentrationBps: number;
  readonly message: string;
};

export type PreTradeExposureSimulationResult = {
  readonly before: PortfolioExposureGraph;
  readonly proposedChange: readonly ExposureContribution[];
  readonly after: PortfolioExposureGraph;
  readonly warnings: readonly string[];
  readonly breachedThresholds: readonly BreachedProvisionalThreshold[];
  readonly simulationOnly: true;
};

export type PortfolioExposureGraphBuildInput = {
  readonly graphId: string;
  readonly portfolioId: string;
  readonly asOf: UtcInstant;
  readonly reportingCurrency: string;
  readonly positions: readonly PortfolioPositionFact[];
  readonly instruments: readonly InstrumentExposureMetadata[];
  readonly economicRelationships: EconomicRelationshipGraph;
  readonly correlationMatrix?: CorrelationMatrix | null;
};

export type PortfolioExposureGraphSnapshot = {
  readonly graphs: readonly PortfolioExposureGraph[];
};

export type PortfolioExposureGraphStorePort = {
  save(graph: PortfolioExposureGraph): void;
  latestForPortfolio(portfolioId: string): PortfolioExposureGraph | undefined;
  snapshot(): PortfolioExposureGraphSnapshot;
  restore(snapshot: PortfolioExposureGraphSnapshot): void;
};
