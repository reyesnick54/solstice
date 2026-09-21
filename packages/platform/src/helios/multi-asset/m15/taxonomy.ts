/**
 * HELIOS Multi-Asset Expansion M15 — cross-asset opportunity graph taxonomy.
 *
 * Research and opportunity-discovery only. No execution authority.
 */

export const CROSS_ASSET_GRAPH_SCHEMA = 'sunrey.helios.multi-asset.cross-asset-graph.v1' as const;
export const CROSS_ASSET_GRAPH_AUTHORITY = 'REFERENCE_ONLY' as const;

export const CROSS_ASSET_GRAPH_NODE_CLASSES = [
  'instrument',
  'asset_class',
  'currency',
  'market_regime',
  'macro_variable',
  'event',
  'strategy_candidate',
  'provider_data_source',
] as const;
export type CrossAssetGraphNodeClass = (typeof CROSS_ASSET_GRAPH_NODE_CLASSES)[number];

export const CROSS_ASSET_EDGE_TYPES = [
  'correlated_with',
  'inversely_correlated_with',
  'underlying_of',
  'proxy_for',
  'denominated_in',
  'exposed_to',
  'historically_sensitive_to',
  'regime_linked_to',
  'event_impacted_by',
  'hedge_candidate_for',
  'relative_value_candidate_with',
] as const;
export type CrossAssetEdgeType = (typeof CROSS_ASSET_EDGE_TYPES)[number];

/** Structural facts, measured statistics, and research hypotheses are never conflated. */
export const RELATIONSHIP_CLASSES = ['STRUCTURAL', 'MEASURED', 'HYPOTHESIS'] as const;
export type RelationshipClass = (typeof RELATIONSHIP_CLASSES)[number];

export const EDGE_VALIDITY_STATES = [
  'ACTIVE',
  'EXPIRED',
  'SUPERSEDED',
  'CONTRADICTED',
  'DEGRADED',
  'HYPOTHESIS_ONLY',
] as const;
export type EdgeValidityState = (typeof EDGE_VALIDITY_STATES)[number];

export const EDGE_CONFIDENCE_BANDS = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'] as const;
export type EdgeConfidenceBand = (typeof EDGE_CONFIDENCE_BANDS)[number];

export const EDGE_METHODOLOGIES = [
  'M01_REGISTRY',
  'M04_MARKET_STATE',
  'M13_REGIME',
  'M14_MACRO_EVENT',
  'PEARSON_CORRELATION',
  'RESEARCH_HYPOTHESIS',
  'PROVIDER_MAPPING',
  'MANUAL_RESEARCH',
] as const;
export type EdgeMethodology = (typeof EDGE_METHODOLOGIES)[number];

export const EDGE_EVIDENCE_KINDS = [
  'MARKET_OBSERVATION',
  'INSTRUMENT_REGISTRY',
  'REGIME_SNAPSHOT',
  'MACRO_EVENT',
  'STATISTICAL_SERIES',
  'RESEARCH_NOTE',
  'PROVIDER_ATTESTATION',
] as const;
export type EdgeEvidenceKind = (typeof EDGE_EVIDENCE_KINDS)[number];

export const OPPORTUNITY_GRAPH_QUERY_KINDS = [
  'related_instruments',
  'possible_hedges',
  'correlated_risks',
  'macro_context',
  'competing_opportunities',
  'contradictory_signals',
] as const;
export type OpportunityGraphQueryKind = (typeof OPPORTUNITY_GRAPH_QUERY_KINDS)[number];
