/**
 * HELIOS ALT11 — supply-chain graph domain types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { AmbiguityState, ConfidenceState } from '../../feature-fabric/entity-resolution/types.ts';
import type {
  HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY,
  HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA,
  SupplyChainBaselineMethod,
  SupplyChainEdgeType,
  SupplyChainNodeKind,
  SupplyChainResearchModelKind,
} from './taxonomy.ts';

export type SupplyChainMappingEvidence = {
  readonly evidenceRefs: readonly string[];
  readonly source: string;
  readonly confidenceState: ConfidenceState;
  readonly ambiguityState: AmbiguityState;
  readonly confidenceScoreMilli: number;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly observedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly jurisdiction: string | null;
};

export type SupplyChainNode = {
  readonly nodeId: string;
  readonly kind: SupplyChainNodeKind;
  readonly displayName: string;
  /** Link into AAF03 temporal entity graph when the node is a firm or facility anchor. */
  readonly temporalAnchorNodeId: string | null;
  readonly payload: Readonly<Record<string, string>>;
  readonly grantsExecutionAuthority: false;
};

export type SupplyChainEdge = SupplyChainMappingEvidence & {
  readonly edgeId: string;
  readonly edgeType: SupplyChainEdgeType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly edgeWeightMilli: number;
  readonly grantsExecutionAuthority: false;
};

export type SupplyChainGraphSnapshot = {
  readonly schemaVersion: typeof HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA;
  readonly graphVersion: number;
  readonly sealedAt: UtcInstant;
  readonly nodes: readonly SupplyChainNode[];
  readonly edges: readonly SupplyChainEdge[];
  readonly temporalEntityGraphDigest: string | null;
  readonly contentDigest: string;
};

export type SupplyChainConcentration = {
  readonly focalNodeId: string;
  readonly asOf: UtcInstant;
  readonly method: 'SUPPLIER_CONCENTRATION' | 'CUSTOMER_CONCENTRATION';
  readonly hhiMilli: number;
  readonly topCounterpartyShareMilli: number;
  readonly counterpartyCount: number;
  readonly baselineMethod: SupplyChainBaselineMethod;
  readonly grantsExecutionAuthority: false;
};

export type NetworkCentralityState = {
  readonly asOf: UtcInstant;
  readonly pagerankLikeScoresMilli: Readonly<Record<string, number>>;
  readonly betweennessScoresMilli: Readonly<Record<string, number>>;
  readonly baselineMethod: SupplyChainBaselineMethod;
  readonly grantsExecutionAuthority: false;
};

export type RiskPropagationPathStep = {
  readonly stepIndex: number;
  readonly nodeId: string;
  readonly nodeKind: SupplyChainNodeKind;
  readonly displayName: string;
  readonly edgeType: SupplyChainEdgeType | null;
  readonly narrative: string;
  readonly hopAttenuationMilli: number;
  readonly cumulativeConfidenceMilli: number;
};

export type RiskPropagationPath = {
  readonly pathId: string;
  readonly originNodeId: string;
  readonly focalNodeId: string;
  readonly asOf: UtcInstant;
  readonly disruptionKind: string;
  readonly propagationScoreMilli: number;
  readonly uncertaintyMilli: number;
  readonly steps: readonly RiskPropagationPathStep[];
  readonly baselineMethod: SupplyChainBaselineMethod;
  readonly researchModel: SupplyChainResearchModelKind | null;
  readonly grantsExecutionAuthority: false;
};

export type CriticalDependency = {
  readonly focalNodeId: string;
  readonly supplierNodeId: string;
  readonly dependencyWeightMilli: number;
  readonly singleSource: boolean;
  readonly evidenceRefs: readonly string[];
  readonly asOf: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type BottleneckExposure = {
  readonly nodeId: string;
  readonly displayName: string;
  readonly betweennessMilli: number;
  readonly affectedPathCount: number;
  readonly asOf: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type SupplyChainExposure = {
  readonly schema: typeof HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA;
  readonly authority: typeof HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY;
  readonly focalNodeId: string;
  readonly asOf: UtcInstant;
  readonly knowableCutoff: UtcInstant;
  readonly propagationScoreMilli: number;
  readonly concentration: SupplyChainConcentration;
  readonly criticalDependencies: readonly CriticalDependency[];
  readonly bottleneckExposures: readonly BottleneckExposure[];
  readonly explainablePaths: readonly RiskPropagationPath[];
  readonly centrality: NetworkCentralityState;
  readonly baselineMethods: readonly SupplyChainBaselineMethod[];
  readonly promotedResearchModel: SupplyChainResearchModelKind | null;
  readonly grantsExecutionAuthority: false;
};
