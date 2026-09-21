/**
 * HELIOS Multi-Asset Expansion M15 — Cross-Asset Opportunity Graph.
 *
 * Research and opportunity-discovery graph with no execution authority.
 */

export {
  CROSS_ASSET_GRAPH_SCHEMA,
  CROSS_ASSET_GRAPH_AUTHORITY,
  CROSS_ASSET_GRAPH_NODE_CLASSES,
  CROSS_ASSET_EDGE_TYPES,
  RELATIONSHIP_CLASSES,
  EDGE_VALIDITY_STATES,
  EDGE_CONFIDENCE_BANDS,
  EDGE_METHODOLOGIES,
  EDGE_EVIDENCE_KINDS,
  OPPORTUNITY_GRAPH_QUERY_KINDS,
  type CrossAssetGraphNodeClass,
  type CrossAssetEdgeType,
  type RelationshipClass,
  type EdgeValidityState,
  type EdgeConfidenceBand,
  type EdgeMethodology,
  type EdgeEvidenceKind,
  type OpportunityGraphQueryKind,
} from './taxonomy.ts';

export type {
  CrossAssetGraphNode,
  CrossAssetRelationshipEdge,
  CrossAssetEdgeEvidence,
  CrossAssetEdgeVersionRecord,
  CrossAssetGraphSnapshot,
  MarketRegimeSnapshot,
  MacroEventSnapshot,
  CrossAssetInstrumentInput,
  CrossAssetStructuralLinkInput,
  CrossAssetBarSeriesInput,
  CrossAssetHypothesisEdgeInput,
  CrossAssetGraphBuildInput,
  CrossAssetGraphBuildResult,
  OpportunityGraphQueryInput,
  OpportunityGraphQueryHit,
  OpportunityGraphQueryResult,
  CrossAssetGraphResearchView,
  CrossAssetGraphStoreSnapshot,
} from './types.ts';

export {
  nodeIdForInstrument,
  nodeIdForAssetClass,
  nodeIdForCurrency,
  nodeIdForRegime,
  nodeIdForMacroVariable,
  nodeIdForEvent,
  nodeIdForStrategyCandidate,
  nodeIdForProvider,
  edgeIdForPair,
  snapshotHash,
} from './ids.ts';

export { computePairwiseCorrelations, confidenceBandForCorrelation } from './correlation.ts';
export { buildCrossAssetOpportunityGraph } from './build.ts';
export { InMemoryCrossAssetGraphStore } from './store.ts';
export {
  queryCrossAssetOpportunityGraph,
  anchorNodeIdForInstrument,
  anchorNodeIdForStrategyCandidate,
  relatedInstrumentIdsFromHits,
} from './query.ts';
export { bridgeCrossAssetGraphToOpportunityResearch } from './bridge.ts';
export {
  HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED,
  HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_BLOCKED,
  evaluateMultiAssetM15Qualification,
  type MultiAssetM15QualificationChecks,
  type MultiAssetM15QualificationResult,
} from './qualification.ts';
