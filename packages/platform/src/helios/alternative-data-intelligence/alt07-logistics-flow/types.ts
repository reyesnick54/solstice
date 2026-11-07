/**
 * HELIOS ALT07 — logistics flow research observation and state types.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  AisFeatureKey,
  Alt07ForecastKind,
  Alt07GraphEdgeKind,
  Alt07GraphNodeKind,
  CargoEvidenceClass,
  HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA,
  ResearchGraphAdapterKind,
  SupplyDemandFeatureKey,
} from './taxonomy.ts';

export type CargoAttribution = {
  readonly evidenceClass: CargoEvidenceClass;
  readonly commodityCode: string | null;
  /** Research-facing label; must not claim observation when evidence is inferred. */
  readonly presentationLabel: string;
  readonly sourceObservationIds: readonly string[];
};

export type AisFeatureSet = {
  readonly licensed: boolean;
  readonly features: Readonly<Partial<Record<AisFeatureKey, number | string | null>>>;
};

export type VesselObservation = {
  readonly schema: typeof HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA;
  readonly observationId: string;
  readonly vesselRef: string;
  readonly knowableAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly ais: AisFeatureSet;
  readonly cargo: CargoAttribution;
  readonly sourceProvider: string;
  readonly grantsExecutionAuthority: false;
};

export type PortObservation = {
  readonly schema: typeof HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA;
  readonly observationId: string;
  readonly portId: string;
  readonly portName: string;
  readonly knowableAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly ais: AisFeatureSet;
  readonly cargo: CargoAttribution;
  readonly geographyCode: string | null;
  readonly sourceProvider: string;
  readonly grantsExecutionAuthority: false;
};

export type RouteObservation = {
  readonly schema: typeof HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA;
  readonly observationId: string;
  readonly routeId: string;
  readonly corridorLabel: string;
  readonly knowableAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly ais: AisFeatureSet;
  readonly cargo: CargoAttribution;
  readonly sourceProvider: string;
  readonly grantsExecutionAuthority: false;
};

export type ShipmentFlowState = {
  readonly stateId: string;
  readonly routeId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL' | 'UNKNOWN';
  readonly cargo: CargoAttribution;
  readonly vesselCount: number | null;
  readonly effectiveAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type PortCongestionState = {
  readonly stateId: string;
  readonly portId: string;
  readonly congestionScore: number;
  readonly anchorageHours: number | null;
  readonly dwellHours: number | null;
  readonly effectiveAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type ChokepointState = {
  readonly stateId: string;
  readonly chokepointId: string;
  readonly label: string;
  readonly flowIndex: number | null;
  readonly vesselCount: number | null;
  readonly diversionDetected: boolean;
  readonly effectiveAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type CommodityFlowEstimate = {
  readonly estimateId: string;
  readonly commodityCode: string;
  readonly cargo: CargoAttribution;
  readonly importFlowIndex: number | null;
  readonly exportFlowIndex: number | null;
  readonly inventoryProxyIndex: number | null;
  readonly effectiveAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type LogisticsDisruptionState = {
  readonly stateId: string;
  readonly scope: 'PORT' | 'ROUTE' | 'FACILITY' | 'CHOKEPOINT' | 'SUPPLY_CHAIN';
  readonly scopeRef: string;
  readonly severity: 'LOW' | 'ELEVATED' | 'SEVERE';
  readonly weatherInformed: boolean;
  readonly routeDisruptionIndex: number;
  readonly freightStressIndex: number;
  readonly evidenceRefs: readonly string[];
  readonly effectiveAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type FirmLogisticsExposure = {
  readonly exposureId: string;
  readonly companyId: string;
  readonly facilityId: string | null;
  readonly portId: string | null;
  readonly routeId: string | null;
  readonly commodityCode: string | null;
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly evidenceRefs: readonly string[];
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type SupplyDemandFeatureRow = {
  readonly featureKey: SupplyDemandFeatureKey;
  readonly value: number | null;
  readonly unit: string;
  readonly geographyOrScope: string;
  readonly knowableAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
};

export type Alt07GraphNode = {
  readonly nodeId: string;
  readonly kind: Alt07GraphNodeKind;
  readonly label: string;
  readonly knowableAt: UtcInstant;
  readonly evidenceRef: string | null;
  readonly grantsExecutionAuthority: false;
};

export type Alt07GraphEdge = {
  readonly edgeId: string;
  readonly kind: Alt07GraphEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly knowableAt: UtcInstant;
  readonly evidenceRef: string | null;
  readonly grantsExecutionAuthority: false;
};

export type Alt07SpatiotemporalGraphSnapshot = {
  readonly schema: typeof HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA;
  readonly graphVersion: number;
  readonly nodes: readonly Alt07GraphNode[];
  readonly edges: readonly Alt07GraphEdge[];
  readonly grantsExecutionAuthority: false;
};

export type Alt07ResearchForecastHint = {
  readonly forecastKind: Alt07ForecastKind;
  readonly targetRef: string;
  readonly score: number;
  readonly adapter: ResearchGraphAdapterKind;
  readonly rationale: string;
  readonly controlsExecution: false;
  readonly knowableAt: UtcInstant;
};

export type Alt07LogisticsFlowSnapshot = {
  readonly schema: typeof HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA;
  readonly snapshotId: string;
  readonly compiledAt: UtcInstant;
  readonly decisionTimeUtc: UtcInstant;
  readonly vessels: readonly VesselObservation[];
  readonly ports: readonly PortObservation[];
  readonly routes: readonly RouteObservation[];
  readonly shipmentFlows: readonly ShipmentFlowState[];
  readonly portCongestion: readonly PortCongestionState[];
  readonly chokepoints: readonly ChokepointState[];
  readonly commodityFlows: readonly CommodityFlowEstimate[];
  readonly disruptions: readonly LogisticsDisruptionState[];
  readonly firmExposures: readonly FirmLogisticsExposure[];
  readonly supplyDemandFeatures: readonly SupplyDemandFeatureRow[];
  readonly graph: Alt07SpatiotemporalGraphSnapshot;
  readonly researchForecasts: readonly Alt07ResearchForecastHint[];
  readonly grantsExecutionAuthority: false;
};
