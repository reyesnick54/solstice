/**
 * Wave 4 Economic Knowledge Graph — minimal shared ontology.
 *
 * Intelligence and relationship layer only. Not blockchain, not monetary authority.
 * Feeds Information Consensus without duplicating PEG, HIN, or productive registry semantics.
 */

export const ECONOMIC_KNOWLEDGE_GRAPH_ONTOLOGY_ID = 'sunrey-economic-knowledge-graph' as const;
export const ECONOMIC_KNOWLEDGE_GRAPH_ONTOLOGY_VERSION = '1' as const;

/** Node classes in the cross-domain economic knowledge graph. */
export const KNOWLEDGE_NODE_CLASSES = [
  'PSEUDONYMOUS_PERSON',
  'ORGANIZATION',
  'FACILITY',
  'PRODUCTIVE_ASSET',
  'RESOURCE',
  'DATASET',
  'PROVIDER',
  'ECONOMIC_EVENT',
  'OBSERVATION',
  'EVIDENCE',
  'VERIFIED_FACT',
  'ECONOMIC_CLAIM',
  'METHODOLOGY',
  'RIGHTS_GRANT',
] as const;
export type KnowledgeNodeClass = (typeof KNOWLEDGE_NODE_CLASSES)[number];

/** Directed relationship kinds between knowledge nodes. */
export const KNOWLEDGE_RELATION_KINDS = [
  'OBSERVED_BY',
  'OPERATED_BY',
  'OWNED_BY',
  'DERIVED_FROM',
  'LOCATED_IN',
  'PRODUCED',
  'CONSUMED',
  'CONTRIBUTED',
  'SUPPORTED_BY',
  'CONTRADICTS',
  'ATTESTED_BY',
  'AUTHORIZED_BY',
  'USES_METHODOLOGY',
  'SAME_AS',
  'POSSIBLE_MATCH',
  'GENERATES',
  'EXECUTES',
  'HANDLES',
  'LINKS_CLAIM',
] as const;
export type KnowledgeRelationKind = (typeof KNOWLEDGE_RELATION_KINDS)[number];

export const KNOWLEDGE_GRAPH_DOMAINS = ['HUMAN_ECONOMY', 'PRODUCTIVE_ECONOMY', 'SHARED_REFERENCE'] as const;
export type KnowledgeGraphDomain = (typeof KNOWLEDGE_GRAPH_DOMAINS)[number];

/** Human-economy node classes that must use pseudonymous identifiers. */
export const PSEUDONYMOUS_NODE_CLASSES = Object.freeze(
  new Set<KnowledgeNodeClass>(['PSEUDONYMOUS_PERSON']),
);

/** Relations that require explicit authorization before materializing (e.g. ownership). */
export const AUTHORIZATION_GATED_RELATIONS = Object.freeze(
  new Set<KnowledgeRelationKind>(['OWNED_BY', 'AUTHORIZED_BY']),
);

/** Productive-economy event relationship templates for Wave 5 preparation. */
export const PRODUCTIVE_EVENT_TEMPLATES = Object.freeze([
  Object.freeze({ assetClass: 'FACILITY', eventClass: 'ECONOMIC_EVENT', relation: 'GENERATES' as KnowledgeRelationKind, label: 'PowerPlant→EnergyEvent' }),
  Object.freeze({ assetClass: 'FACILITY', eventClass: 'ECONOMIC_EVENT', relation: 'PRODUCED' as KnowledgeRelationKind, label: 'Factory→ManufacturingEvent' }),
  Object.freeze({ assetClass: 'PRODUCTIVE_ASSET', eventClass: 'ECONOMIC_EVENT', relation: 'EXECUTES' as KnowledgeRelationKind, label: 'ComputeCluster→ComputeEvent' }),
  Object.freeze({ assetClass: 'FACILITY', eventClass: 'ECONOMIC_EVENT', relation: 'HANDLES' as KnowledgeRelationKind, label: 'Port→LogisticsEvent' }),
]);

export function isKnowledgeNodeClass(value: string): value is KnowledgeNodeClass {
  return (KNOWLEDGE_NODE_CLASSES as readonly string[]).includes(value);
}

export function isKnowledgeRelationKind(value: string): value is KnowledgeRelationKind {
  return (KNOWLEDGE_RELATION_KINDS as readonly string[]).includes(value);
}
