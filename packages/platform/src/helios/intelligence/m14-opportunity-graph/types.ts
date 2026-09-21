import type { UtcInstant } from '@solstice/domain';
import type { StrategyFamilyId } from '../m13-regime/taxonomy.ts';

export const HELIOS_M14_OPPORTUNITY_GRAPH_VERSION = 'HELIOS_M14_OPPORTUNITY_GRAPH_V1' as const;

export type OpportunityGraphNodeKind = 'INSTRUMENT' | 'STRATEGY_FAMILY' | 'CANDIDATE';

export type OpportunityGraphNode = {
  readonly nodeId: string;
  readonly kind: OpportunityGraphNodeKind;
  readonly instrumentId: string | null;
  readonly strategyFamily: StrategyFamilyId | null;
  readonly candidateId: string | null;
  readonly assetClass: string | null;
  readonly sector: string | null;
};

export type OpportunityGraphEdgeKind =
  | 'CORRELATION'
  | 'SAME_SECTOR'
  | 'SAME_ASSET_CLASS'
  | 'SAME_STRATEGY_FAMILY';

export type OpportunityGraphEdge = {
  readonly edgeId: string;
  readonly kind: OpportunityGraphEdgeKind;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly weightBps: number;
  readonly evidenceRef: string | null;
};

export type CrossAssetOpportunityGraph = {
  readonly graphId: string;
  readonly version: typeof HELIOS_M14_OPPORTUNITY_GRAPH_VERSION;
  readonly nodes: readonly OpportunityGraphNode[];
  readonly edges: readonly OpportunityGraphEdge[];
  readonly builtAt: UtcInstant;
};

export type CorrelationWarning = {
  readonly candidateId: string;
  readonly correlatedWith: readonly string[];
  readonly maxCorrelationBps: number;
  readonly reason: string;
};

export type GraphBuildInput = {
  readonly graphId: string;
  readonly candidates: readonly {
    readonly candidateId: string;
    readonly instrumentId: string;
    readonly assetClass: string;
    readonly sector: string;
    readonly strategyFamily: StrategyFamilyId;
  }[];
  readonly portfolioInstrumentIds: readonly string[];
  readonly correlationMatrix: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly now: UtcInstant;
};
