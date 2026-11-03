/**
 * HELIOS Native OSS Assimilation NATIVE14 — unified cross-market intelligence.
 */

export {
  HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_SCHEMA,
  HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_AUTHORITY,
  HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED,
  HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_BLOCKED,
  CROSS_MARKET_SIGNAL_DOMAINS,
  CROSS_MARKET_GRAPH_NODE_KINDS,
  CROSS_MARKET_GRAPH_EDGE_KINDS,
  CROSS_MARKET_RESEARCH_TRIGGER_KINDS,
  DISLOCATION_SEVERITY_BANDS,
  MIN_DOMAINS_FOR_RESEARCH_TRIGGER,
  type CrossMarketSignalDomain,
  type CrossMarketGraphNodeKind,
  type CrossMarketGraphEdgeKind,
  type CrossMarketResearchTriggerKind,
  type DislocationSeverityBand,
} from './taxonomy.ts';

export type {
  CrossMarketSignalObservation,
  CrossMarketEvidenceGraphNode,
  CrossMarketEvidenceGraphEdge,
  CrossMarketEvidenceGraph,
  CrossMarketProbabilityState,
  CrossMarketDislocation,
  CrossAssetConfirmation,
  CrossAssetContradiction,
  CrossMarketIntelligenceEvaluateInput,
  CrossMarketResearchTriggerProposal,
  CrossMarketOpportunityCandidateBundle,
  CrossMarketIntelligenceResult,
} from './types.ts';

export { buildCrossMarketEvidenceGraph } from './build.ts';
export {
  evaluateCrossMarketProbabilityStates,
  detectCrossAssetConfirmations,
  detectCrossAssetContradictions,
  detectCrossMarketDislocations,
} from './evaluate.ts';
export { runCrossMarketIntelligence } from './pipeline.ts';
export {
  crossMarketDislocationToOpportunityCandidate,
  crossMarketBundleToM16CandidateInput,
} from './opportunity-bridge.ts';
export { buildCrossMarketResearchTriggerProposal } from './research-trigger-bridge.ts';
export {
  evaluateNative14CrossMarketQualification,
  type Native14CrossMarketQualificationChecks,
  type Native14CrossMarketQualificationResult,
} from './qualification.ts';
export {
  NATIVE14_FIXTURE_NOW,
  NATIVE14_CUSTOMER_ID,
  NATIVE14_WORK_ORDER_ID,
  NATIVE14_SUBJECT_ID,
  native14MacroDislocationObservations,
  native14CryptoDislocationObservations,
  native14WeakCorrelationOnlyObservations,
} from './fixtures.ts';
