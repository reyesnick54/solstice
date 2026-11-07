export { ALT09_SCHEMA, HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED, HELIOS_ALT09_INNOVATION_INTELLIGENCE_BLOCKED, PATENT_UTILIZATION_CLASSES, TECHNOLOGY_GRAPH_EDGE_KINDS } from './taxonomy.ts';
export type { PatentUtilizationClass, TechnologyGraphEdgeKind } from './taxonomy.ts';

export type {
  PatentObservation,
  PatentFamily,
  TechnologyEmbeddingRecord,
  InnovationFeatureBundle,
  PatentQualityState,
  CommercializationEvidenceRef,
  PatentProductUtilizationState,
  CommercializationState,
  TechnologyPortfolio,
  InnovationMomentum,
  TechnologyExpansion,
  TechnologyConvergence,
  InnovationCommercializationGap,
  InnovationState,
  TechnologyGraph,
  TechnologyGraphNode,
  TechnologyGraphEdge,
  TechnologyGraphNodeKind,
  Alt09PipelineResult,
  Alt09PipelineStageResult,
  PatentStatus,
} from './types.ts';

export {
  computePatentKnowableAt,
  isPatentVisibleAt,
  filterKnowablePatents,
  assertNoPatentLeakage,
} from './knowable-at.ts';

export { wave6PatentToObservation, ingestPatentsFromWave6 } from './wave6-bridge.ts';

export {
  ALT09_EMBEDDING_MODEL_ID,
  ALT09_EMBEDDING_MODEL_VERSION,
  ALT09_EMBEDDING_MODEL_EFFECTIVE_AT,
  buildPatentEmbeddingRecord,
  buildPatentEmbeddings,
  embeddingCosineDissimilarity,
} from './embeddings.ts';

export {
  buildPatentFamilies,
  computeInnovationFeatures,
  computeInnovationMomentum,
  computeTechnologyExpansion,
  computeTechnologyConvergence,
  computeInnovationCommercializationGap,
} from './features.ts';

export { classifyPatentUtilization, buildCommercializationState } from './commercialization.ts';
export { buildTechnologyGraph } from './graph.ts';
export { buildTechnologyPortfolio, buildInnovationState } from './portfolio.ts';
export {
  buildInnovationIntelligenceForCompany,
  DEFAULT_FIXTURE_COMPANY,
  type InnovationIntelligenceServiceResult,
} from './service.ts';

export { runAlt09InnovationIntelligencePipeline, type Alt09PipelineInput } from './pipeline.ts';

export {
  evaluateAlt09InnovationIntelligenceQualification,
  deriveAlt09QualificationChecks,
  type Alt09QualificationChecks,
  type Alt09QualificationResult,
} from './qualification.ts';

export {
  FIXTURE_COMPANY_SIM_LABS,
  FIXTURE_COMPANY_EXAMPLE_CORP,
  FIXTURE_COMPETITOR,
  ALT09_FIXTURE_AS_OF,
  FIXTURE_UNPUBLISHED_APPLICATION,
  FIXTURE_PATENTS,
  FIXTURE_PRODUCT_AGENT_MESH,
  FIXTURE_COMMERCIALIZATION_EVIDENCE,
  FIXTURE_PATENT_UTILIZATION,
} from './fixtures.ts';
