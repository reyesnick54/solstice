import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type { AssembledOpportunityCandidate } from '../../intelligence/m15-opportunity-assembly/types.ts';
import type { ResearchMonitorTriggerEvent } from '../../open-source-integration/os07/research-monitor-contract.ts';
import type {
  CrossMarketGraphEdgeKind,
  CrossMarketGraphNodeKind,
  CrossMarketResearchTriggerKind,
  CrossMarketSignalDomain,
  DislocationSeverityBand,
  HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_AUTHORITY,
  HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_SCHEMA,
} from './taxonomy.ts';

/** Normalized cross-market observation (one domain, one entity). */
export type CrossMarketSignalObservation = {
  readonly observationId: string;
  readonly domain: CrossMarketSignalDomain;
  readonly entityId: string;
  readonly entityLabel: string;
  readonly metricId: string;
  /** Signed move in basis points (price return, yield change, vol change, etc.). */
  readonly moveBps: number;
  /** Optional implied probability in ppm when domain is prediction market. */
  readonly impliedProbabilityPpm: bigint | null;
  readonly volumeAccelerationScore: number | null;
  readonly evidenceRef: string;
  readonly observedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
};

export type CrossMarketEvidenceGraphNode = {
  readonly nodeId: string;
  readonly kind: CrossMarketGraphNodeKind;
  readonly domain: CrossMarketSignalDomain;
  readonly entityId: string;
  readonly label: string;
  readonly evidenceRefs: readonly string[];
};

export type CrossMarketEvidenceGraphEdge = {
  readonly edgeId: string;
  readonly kind: CrossMarketGraphEdgeKind;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly weightBps: number;
  readonly evidenceRefs: readonly string[];
};

/** Evidence-linked graph tying heterogeneous market domains. */
export type CrossMarketEvidenceGraph = {
  readonly schema: typeof HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_SCHEMA;
  readonly authority: typeof HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_AUTHORITY;
  readonly graphId: string;
  readonly nodes: readonly CrossMarketEvidenceGraphNode[];
  readonly edges: readonly CrossMarketEvidenceGraphEdge[];
  readonly builtAt: UtcInstant;
};

export type CrossMarketProbabilityState = {
  readonly stateId: string;
  readonly subjectEntityId: string;
  readonly predictionMarketPpm: bigint | null;
  readonly venueImpliedPpm: bigint | null;
  readonly researchPriorPpm: bigint | null;
  readonly divergencePpm: bigint;
  readonly evidenceRefs: readonly string[];
  readonly evaluatedAt: UtcInstant;
};

export type CrossMarketDislocation = {
  readonly dislocationId: string;
  readonly severity: DislocationSeverityBand;
  readonly involvedNodeIds: readonly string[];
  readonly involvedDomains: readonly CrossMarketSignalDomain[];
  readonly compositeMagnitudeBps: number;
  readonly evidenceRefs: readonly string[];
  readonly researchTriggerKind: CrossMarketResearchTriggerKind | null;
  readonly correlationIsNotTradeSignal: true;
  readonly detectedAt: UtcInstant;
};

export type CrossAssetConfirmation = {
  readonly confirmationId: string;
  readonly theme: string;
  readonly directionalSign: 'UP' | 'DOWN' | 'NEUTRAL';
  readonly nodeIds: readonly string[];
  readonly alignedMoveBps: readonly number[];
  readonly evidenceRefs: readonly string[];
  readonly confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type CrossAssetContradiction = {
  readonly contradictionId: string;
  readonly theme: string;
  readonly nodeIds: readonly string[];
  readonly opposingMoveBps: readonly number[];
  readonly evidenceRefs: readonly string[];
  readonly severity: DislocationSeverityBand;
};

export type CrossMarketIntelligenceEvaluateInput = {
  readonly runId: string;
  readonly graphId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly observations: readonly CrossMarketSignalObservation[];
  readonly now: UtcInstant;
};

export type CrossMarketResearchTriggerProposal = {
  readonly proposalId: string;
  readonly kind: CrossMarketResearchTriggerKind;
  readonly dislocationId: string;
  readonly triggerEvent: ResearchMonitorTriggerEvent;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type CrossMarketOpportunityCandidateBundle = {
  readonly opportunityId: string;
  readonly candidate: AssembledOpportunityCandidate;
  readonly dislocationId: string;
  readonly evidenceRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
  readonly correlationIsNotTradeSignal: true;
};

export type CrossMarketIntelligenceResult = {
  readonly runId: string;
  readonly graph: CrossMarketEvidenceGraph;
  readonly probabilityStates: readonly CrossMarketProbabilityState[];
  readonly dislocations: readonly CrossMarketDislocation[];
  readonly confirmations: readonly CrossAssetConfirmation[];
  readonly contradictions: readonly CrossAssetContradiction[];
  readonly opportunityCandidates: readonly CrossMarketOpportunityCandidateBundle[];
  readonly researchTriggers: readonly CrossMarketResearchTriggerProposal[];
  readonly evaluatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};
