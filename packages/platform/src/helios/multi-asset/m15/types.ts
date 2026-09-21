/**
 * HELIOS Multi-Asset Expansion M15 — cross-asset opportunity graph types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { MarketState } from '../market-state-types.ts';
import type {
  CrossAssetEdgeType,
  CrossAssetGraphNodeClass,
  EdgeConfidenceBand,
  EdgeEvidenceKind,
  EdgeMethodology,
  EdgeValidityState,
  OpportunityGraphQueryKind,
  RelationshipClass,
} from './taxonomy.ts';

export type CrossAssetGraphNodeId = string;
export type CrossAssetGraphEdgeId = string;

export type CrossAssetGraphNode = {
  readonly nodeId: CrossAssetGraphNodeId;
  readonly nodeClass: CrossAssetGraphNodeClass;
  readonly label: string;
  readonly externalRef: string | null;
  readonly payload: Readonly<Record<string, string>>;
  readonly createdAt: UtcInstant;
  readonly authoritative: false;
  readonly mutatesFinancialState: false;
};

export type CrossAssetEdgeEvidence = {
  readonly evidenceId: string;
  readonly kind: EdgeEvidenceKind;
  readonly sourceRef: string;
  readonly observedAt: UtcInstant;
  readonly provenanceRef: string;
  readonly summary: string;
};

export type CrossAssetRelationshipEdge = {
  readonly edgeId: CrossAssetGraphEdgeId;
  readonly relationshipType: CrossAssetEdgeType;
  readonly relationshipClass: RelationshipClass;
  readonly fromNodeId: CrossAssetGraphNodeId;
  readonly toNodeId: CrossAssetGraphNodeId;
  readonly source: string;
  readonly methodology: EdgeMethodology;
  readonly strength: number | null;
  readonly confidence: EdgeConfidenceBand;
  readonly lookback: string | null;
  readonly timestamp: UtcInstant;
  readonly evidence: readonly CrossAssetEdgeEvidence[];
  readonly expiration: UtcInstant | null;
  readonly validityState: EdgeValidityState;
  readonly customerId: string | null;
  readonly version: number;
  readonly authoritative: false;
  readonly mutatesFinancialState: false;
};

export type CrossAssetEdgeVersionRecord = {
  readonly edgeId: CrossAssetGraphEdgeId;
  readonly version: number;
  readonly edge: CrossAssetRelationshipEdge;
  readonly supersededAt: UtcInstant | null;
  readonly changeReason: string;
};

export type CrossAssetGraphSnapshot = {
  readonly schema: 'sunrey.helios.multi-asset.cross-asset-graph.v1';
  readonly nodes: readonly CrossAssetGraphNode[];
  readonly edges: readonly CrossAssetRelationshipEdge[];
  readonly edgeVersions: readonly CrossAssetEdgeVersionRecord[];
  readonly snapshotAt: UtcInstant;
  readonly snapshotHash: string;
};

/** M13 regime input port — consumed when available. */
export type MarketRegimeSnapshot = {
  readonly regimeId: string;
  readonly label: string;
  readonly scope: 'GLOBAL' | 'ASSET_CLASS' | 'INSTRUMENT';
  readonly instrumentId: string | null;
  readonly assetClass: string | null;
  readonly characteristics: readonly string[];
  readonly evaluatedAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
};

/** M14 macro/event input port — consumed when available. */
export type MacroEventSnapshot = {
  readonly eventId: string;
  readonly category: string;
  readonly displayName: string;
  readonly affectedInstrumentIds: readonly string[];
  readonly macroVariableIds: readonly string[];
  readonly scheduledAt: UtcInstant | null;
  readonly evaluatedAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
};

export type CrossAssetInstrumentInput = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly assetClass: string;
  readonly currency: string;
  readonly underlyingInstrumentId: string | null;
  readonly proxyForInstrumentId: string | null;
};

export type CrossAssetStructuralLinkInput = {
  readonly fromInstrumentId: string;
  readonly toInstrumentId: string;
  readonly relationshipType: CrossAssetEdgeType;
  readonly source: string;
  readonly evidenceRefs: readonly string[];
};

export type CrossAssetBarSeriesInput = {
  readonly instrumentId: string;
  readonly closes: readonly bigint[];
  readonly timestamps: readonly UtcInstant[];
  readonly providerId: string;
};

export type CrossAssetHypothesisEdgeInput = {
  readonly hypothesisId: string;
  readonly fromInstrumentId: string;
  readonly toInstrumentId: string;
  readonly relationshipType: CrossAssetEdgeType;
  readonly source: string;
  readonly rationale: string;
  readonly confidence: EdgeConfidenceBand;
  readonly expiration: UtcInstant | null;
  readonly customerId: string | null;
};

export type CrossAssetGraphBuildInput = {
  readonly instruments: readonly CrossAssetInstrumentInput[];
  readonly structuralLinks?: readonly CrossAssetStructuralLinkInput[];
  readonly marketStates?: readonly MarketState[];
  readonly regimeSnapshots?: readonly MarketRegimeSnapshot[];
  readonly macroEvents?: readonly MacroEventSnapshot[];
  readonly barSeries?: readonly CrossAssetBarSeriesInput[];
  readonly hypotheses?: readonly CrossAssetHypothesisEdgeInput[];
  readonly correlationLookback?: string;
  readonly correlationMinObservations?: number;
  readonly correlationThreshold?: number;
  readonly now: UtcInstant;
  readonly customerId?: string | null;
};

export type CrossAssetGraphBuildResult = {
  readonly nodes: readonly CrossAssetGraphNode[];
  readonly edges: readonly CrossAssetRelationshipEdge[];
  readonly warnings: readonly string[];
};

export type OpportunityGraphQueryInput = {
  readonly queryKind: OpportunityGraphQueryKind;
  readonly anchorNodeId: string;
  readonly asOf: UtcInstant;
  readonly customerId?: string | null;
  readonly includeHypotheses?: boolean;
  readonly includeDegraded?: boolean;
};

export type OpportunityGraphQueryHit = {
  readonly edge: CrossAssetRelationshipEdge;
  readonly relatedNode: CrossAssetGraphNode;
  readonly relevanceScore: number;
  readonly lineage: readonly CrossAssetEdgeEvidence[];
};

export type OpportunityGraphQueryResult = {
  readonly queryKind: OpportunityGraphQueryKind;
  readonly anchorNodeId: string;
  readonly hits: readonly OpportunityGraphQueryHit[];
  readonly contradictoryPairs: readonly {
    readonly left: CrossAssetRelationshipEdge;
    readonly right: CrossAssetRelationshipEdge;
    readonly reason: string;
  }[];
  readonly dataQualityNotes: readonly string[];
};

export type CrossAssetGraphResearchView = {
  readonly schema: 'sunrey.helios.multi-asset.cross-asset-graph.research-view.v1';
  readonly anchorInstrumentId: string;
  readonly relatedInstrumentIds: readonly string[];
  readonly hedgeCandidateIds: readonly string[];
  readonly macroContextNodeIds: readonly string[];
  readonly evidenceRefs: readonly {
    readonly evidenceId: string;
    readonly sourceKind: 'MARKET_OBSERVATION' | 'ASSERTION';
    readonly sourceRef: string;
    readonly observedAt: UtcInstant;
    readonly freshnessOk: boolean;
    readonly entitlementOk: boolean;
    readonly provenanceRef: string;
  }[];
  readonly generatedAt: UtcInstant;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type CrossAssetGraphStoreSnapshot = CrossAssetGraphSnapshot;
