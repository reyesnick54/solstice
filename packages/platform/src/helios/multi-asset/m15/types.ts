/**
 * HELIOS Multi-Asset Expansion M15 — economic relationship types.
 *
 * Reference relationships between instruments, factors, and macro clusters.
 * Not a second PEG or personal economic graph.
 */

export const ECONOMIC_RELATIONSHIP_KINDS = [
  'TRACKS_INDEX',
  'UNDERLIES',
  'SAME_SECTOR',
  'RISK_ON_CLUSTER',
  'HEDGE_TO',
  'COMMODITY_LINK',
  'FX_PAIR',
  'PROVIDER_VENUE',
] as const;

export type EconomicRelationshipKind = (typeof ECONOMIC_RELATIONSHIP_KINDS)[number];

export const ECONOMIC_FACTOR_TAGS = [
  'TECHNOLOGY',
  'GROWTH',
  'RISK_ON',
  'DEFENSIVE',
  'ENERGY',
  'METALS',
  'CRYPTO',
  'VOLATILITY',
  'USD',
  'COMMODITY',
] as const;

export type EconomicFactorTag = (typeof ECONOMIC_FACTOR_TAGS)[number];

export type InstrumentEconomicMetadata = {
  readonly instrumentId: string;
  readonly sector: string | null;
  readonly industry: string | null;
  readonly factorTags: readonly EconomicFactorTag[];
  readonly benchmarkInstrumentId: string | null;
  readonly equityBetaToBenchmark: number | null;
  readonly volatilitySensitivity: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  readonly metadataAuthority: 'REFERENCE_ONLY' | 'SANDBOX';
  readonly sourceRefs: readonly string[];
};

export type EconomicRelationship = {
  readonly relationshipId: string;
  readonly kind: EconomicRelationshipKind;
  readonly fromInstrumentId: string;
  readonly toInstrumentId: string;
  readonly weightBps: number | null;
  readonly provenanceKind: 'DIRECTLY_MEASURED' | 'DERIVED' | 'MODEL_ESTIMATED';
  readonly sourceRefs: readonly string[];
};

export type EconomicRelationshipGraph = {
  readonly asOf: string;
  readonly metadataByInstrument: Readonly<Record<string, InstrumentEconomicMetadata>>;
  readonly relationships: readonly EconomicRelationship[];
  readonly simulationOnly: true;
};
