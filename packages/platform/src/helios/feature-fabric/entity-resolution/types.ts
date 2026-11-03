/**
 * AAF03 — temporal entity resolution graph types (HELIOS Adaptive Alpha Fabric).
 * Reference intelligence only; does not grant Execution Authority or mutate ledger state.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EconomicKnowledgeCanonicalEntityId, HeliosExternalIdentifier } from './ekg-bridge.ts';

export const HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA = 'sunrey.helios.temporal-entity-graph.v1' as const;

export const TEMPORAL_ENTITY_KINDS = [
  'LEGAL_ENTITY',
  'ISSUER',
  'SECURITY',
  'LISTING',
  'VENUE',
  'BRAND',
  'SUBSIDIARY',
  'PHYSICAL_LOCATION',
  'CRYPTO_ASSET',
  'CRYPTO_VENUE_INSTRUMENT',
  'ECONOMIC_SERIES',
] as const;
export type TemporalEntityKind = (typeof TEMPORAL_ENTITY_KINDS)[number];

export const TEMPORAL_RELATIONSHIP_TYPES = [
  'IDENTIFIED_BY',
  'ISSUES',
  'LISTS',
  'TRADES_ON',
  'SPONSORS',
  'OWNS_BRAND',
  'PARENT_OF',
  'SUBSIDIARY_OF',
  'SPIN_OFF_FROM',
  'MERGED_INTO',
  'REPLACED_BY',
  'SHARE_CLASS_OF',
  'ADR_OF',
  'DUAL_LISTED_AS',
  'PROVIDER_SYMBOL_FOR',
  'CONTINUOUS_SERIES_FOR',
  'DELISTED_AS_OF',
  'LOCATED_IN',
] as const;
export type TemporalRelationshipType = (typeof TEMPORAL_RELATIONSHIP_TYPES)[number];

export const ENTITY_RESOLUTION_STATES = [
  'RESOLVED',
  'AMBIGUOUS',
  'UNRESOLVED',
  'EXPIRED_MAPPING',
  'CONFLICTING_EVIDENCE',
] as const;
export type EntityResolutionState = (typeof ENTITY_RESOLUTION_STATES)[number];

export const CONFIDENCE_STATES = ['CONFIRMED', 'PROVISIONAL', 'DISPUTED', 'INFERRED'] as const;
export type ConfidenceState = (typeof CONFIDENCE_STATES)[number];

export const AMBIGUITY_STATES = ['UNAMBIGUOUS', 'AMBIGUOUS', 'SUPPRESSED'] as const;
export type AmbiguityState = (typeof AMBIGUITY_STATES)[number];

export type TemporalEntityNode = {
  readonly nodeId: string;
  readonly kind: TemporalEntityKind;
  readonly displayName: string;
  readonly jurisdiction: string | null;
  /** When set, links ORGANIZATION-class EKG canonical identity (not customer identity). */
  readonly economicKnowledgeEntityId: EconomicKnowledgeCanonicalEntityId | null;
  readonly payload: Readonly<Record<string, string>>;
  readonly grantsExecutionAuthority: false;
};

export type TemporalMappingEvidence = {
  readonly evidenceRefs: readonly string[];
  readonly source: string;
  readonly confidenceState: ConfidenceState;
  readonly ambiguityState: AmbiguityState;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly observedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly jurisdiction: string | null;
};

export type TemporalEntityEdge = TemporalMappingEvidence & {
  readonly edgeId: string;
  readonly relationshipType: TemporalRelationshipType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly providerMapping: ProviderInstrumentMapping | null;
};

export type ProviderInstrumentMapping = {
  readonly providerId: string;
  readonly providerSymbol: string;
  readonly providerInstrumentId: string | null;
};

export type ProviderSymbolLookup = ProviderInstrumentMapping & TemporalMappingEvidence & {
  readonly mappingId: string;
  readonly targetNodeId: string;
};

export type TemporalEntityGraphSnapshot = {
  readonly schemaVersion: typeof HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA;
  readonly graphVersion: number;
  readonly sealedAt: UtcInstant;
  readonly nodes: readonly TemporalEntityNode[];
  readonly edges: readonly TemporalEntityEdge[];
  readonly providerMappings: readonly ProviderSymbolLookup[];
  readonly contentDigest: string;
};

export type ResolveProviderSymbolInput = {
  readonly providerId: string;
  readonly providerSymbol: string;
  readonly asOf: UtcInstant;
  readonly knowableAtCutoff: UtcInstant;
};

export type ResolvedEntityBinding = {
  readonly resolutionState: EntityResolutionState;
  readonly canonicalEntityId: EconomicKnowledgeCanonicalEntityId | null;
  readonly canonicalInstrumentId: string | null;
  readonly resolvedNodeIds: readonly string[];
  readonly candidateNodeIds: readonly string[];
  readonly externalIdentifiers: readonly HeliosExternalIdentifier[];
  readonly message: string | null;
  readonly grantsExecutionAuthority: false;
};

export type AppendTemporalEdgeInput = Omit<
  TemporalEntityEdge,
  'edgeId' | 'providerMapping'
> & {
  readonly providerMapping?: ProviderInstrumentMapping | null;
};

export type RegisterProviderMappingInput = Omit<ProviderSymbolLookup, 'mappingId'>;
