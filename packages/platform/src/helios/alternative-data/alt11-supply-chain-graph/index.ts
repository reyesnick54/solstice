export {
  HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA,
  HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY,
  HELIOS_ALT11,
  SUPPLY_CHAIN_NODE_KINDS,
  SUPPLY_CHAIN_EDGE_TYPES,
  RISK_UPSTREAM_EDGE_TYPES,
  SUPPLY_CHAIN_BASELINE_METHODS,
  SUPPLY_CHAIN_RESEARCH_MODEL_KINDS,
  DEFAULT_RISK_HOP_ATTENUATION_MILLI,
  HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED,
  HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_BLOCKED,
  type SupplyChainNodeKind,
  type SupplyChainEdgeType,
  type SupplyChainBaselineMethod,
  type SupplyChainResearchModelKind,
} from './taxonomy.ts';

export type {
  SupplyChainMappingEvidence,
  SupplyChainNode,
  SupplyChainEdge,
  SupplyChainGraphSnapshot,
  SupplyChainConcentration,
  NetworkCentralityState,
  RiskPropagationPathStep,
  RiskPropagationPath,
  CriticalDependency,
  BottleneckExposure,
  SupplyChainExposure,
} from './types.ts';

export { confidenceScoreMilliFromState, combinePathConfidenceMilli } from './confidence.ts';

export {
  assertSupplyChainEdgeEvidence,
  createSupplyChainGraphStore,
  supplyChainNodeKindGuard,
  type SupplyChainGraphStore,
  type UpsertSupplyChainNodeInput,
  type AppendSupplyChainEdgeInput,
} from './graph-store.ts';

export { anchorSupplyChainNodeOnTemporalGraph, type AnchorSupplyChainNodeInput } from './temporal-bridge.ts';

export {
  computeSupplierConcentration,
  computeCustomerConcentration,
  computePagerankLikeScoresMilli,
  computeBetweennessScoresMilli,
  buildNetworkCentralityState,
  weightedPathPropagationScoreMilli,
  listCriticalDependencies,
  listBottleneckExposures,
  isUpstreamRiskEdge,
  SUPPLY_CHAIN_BASELINE_METHOD_LABELS,
} from './baselines.ts';

export {
  findRiskPropagationPaths,
  formatExplainablePathSummary,
  type PropagateSupplyChainRiskInput,
} from './risk-propagation.ts';

export {
  evaluateResearchModelPromotion,
  researchModelCatalog,
  type SupplyChainModelEvaluation,
  type ResearchModelScoreInput,
} from './research-models.ts';

export {
  createHeliosSupplyChainGraphFabric,
  type HeliosSupplyChainGraphFabric,
  type HeliosSupplyChainGraphFabricOptions,
} from './fabric.ts';

export { seedAlt11ReferenceSupplyChainGraph, type Alt11FixtureHandles } from './fixtures.ts';

export {
  evaluateAlt11SupplyChainGraphQualification,
  runAlt11QualificationHarness,
  type Alt11QualificationChecks,
  type Alt11QualificationResult,
} from './qualification.ts';
