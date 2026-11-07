/**
 * HELIOS ALT07 — maritime, logistics, and commodity flow intelligence taxonomy.
 */

export const HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA = 'sunrey.helios.alt07.logistics-flow.v1' as const;

export const HELIOS_ALT07_LOGISTICS_FLOW_AUTHORITY =
  'packages/platform/src/helios/alternative-data-intelligence/alt07-logistics-flow' as const;

export const HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED = 'HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED' as const;
export const HELIOS_ALT07_LOGISTICS_FLOW_BLOCKED = 'HELIOS_ALT07_LOGISTICS_FLOW_BLOCKED' as const;

export const ALT07_EXECUTION_MODE = 'DISABLED_RESEARCH_ONLY' as const;

export const CARGO_EVIDENCE_CLASSES = [
  'OBSERVED_CARGO',
  'DECLARED_CARGO',
  'INFERRED_CARGO',
  'UNKNOWN',
] as const;

export type CargoEvidenceClass = (typeof CARGO_EVIDENCE_CLASSES)[number];

export const AIS_FEATURE_KEYS = [
  'vesselCount',
  'vesselClass',
  'arrivalRate',
  'departureRate',
  'anchorageTime',
  'portDwellTime',
  'routeTravelTime',
  'speedAnomaly',
  'congestion',
  'routeDiversion',
  'chokepointFlow',
] as const;

export type AisFeatureKey = (typeof AIS_FEATURE_KEYS)[number];

export const ALT07_GRAPH_NODE_KINDS = [
  'COMPANY',
  'FACILITY',
  'PORT',
  'ROUTE',
  'COMMODITY',
  'VESSEL',
  'CHOKEPOINT',
  'WEATHER_ZONE',
] as const;

export type Alt07GraphNodeKind = (typeof ALT07_GRAPH_NODE_KINDS)[number];

export const ALT07_GRAPH_EDGE_KINDS = [
  'OPERATES',
  'EXPOSED_AT',
  'ROUTES_THROUGH',
  'LOADED_WITH',
  'ANCHORS_AT',
  'CONNECTS',
  'DISRUPTED_BY',
  'FLOWS_TO',
] as const;

export type Alt07GraphEdgeKind = (typeof ALT07_GRAPH_EDGE_KINDS)[number];

export const SUPPLY_DEMAND_FEATURE_KEYS = [
  'importFlow',
  'exportFlow',
  'inventoryProxy',
  'portThroughput',
  'routeDisruption',
  'freightStress',
] as const;

export type SupplyDemandFeatureKey = (typeof SUPPLY_DEMAND_FEATURE_KEYS)[number];

export const ALT07_FORECAST_KINDS = [
  'PORT_DISRUPTION',
  'FLOW_ANOMALY',
  'SUPPLIER_DISRUPTION',
] as const;

export type Alt07ForecastKind = (typeof ALT07_FORECAST_KINDS)[number];

export const RESEARCH_GRAPH_ADAPTER_KINDS = [
  'SPATIOTEMPORAL_GNN',
  'TEMPORAL_GRAPH_ATTENTION',
] as const;

export type ResearchGraphAdapterKind = (typeof RESEARCH_GRAPH_ADAPTER_KINDS)[number];
