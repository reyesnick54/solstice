/**
 * HELIOS ALT11 — dynamic supply-chain knowledge graph and risk propagation.
 * Reference intelligence only; does not grant Execution Authority.
 */

export const HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA = 'sunrey.helios.supply-chain-graph.v1' as const;
export const HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY = 'REFERENCE_ONLY' as const;

export const HELIOS_ALT11 = 'HELIOS_ALT11' as const;

export const SUPPLY_CHAIN_NODE_KINDS = [
  'COMPANY',
  'SUBSIDIARY',
  'SUPPLIER',
  'CUSTOMER',
  'FACILITY',
  'PRODUCT',
  'PORT',
  'VESSEL',
  'COMMODITY',
  'COUNTRY',
  'PATENT',
  'GOVERNMENT_CONTRACT',
  'INDUSTRY',
] as const;
export type SupplyChainNodeKind = (typeof SUPPLY_CHAIN_NODE_KINDS)[number];

export const SUPPLY_CHAIN_EDGE_TYPES = [
  'SUPPLIES',
  'CUSTOMER_OF',
  'OWNS',
  'OPERATES',
  'SHIPS_THROUGH',
  'DEPENDS_ON',
  'COMPETES_WITH',
  'USES_COMMODITY',
  'PRODUCES_PRODUCT',
  'PATENT_EXPOSURE',
  'CONTRACT_EXPOSURE',
] as const;
export type SupplyChainEdgeType = (typeof SUPPLY_CHAIN_EDGE_TYPES)[number];

/** Upstream propagation uses reverse SUPPLIES; disruption travels along supply edges toward focal firms. */
export const RISK_UPSTREAM_EDGE_TYPES = ['SUPPLIES', 'DEPENDS_ON', 'SHIPS_THROUGH'] as const satisfies readonly SupplyChainEdgeType[];

export const EVIDENCE_REQUIRED_EDGE_TYPES = [
  ...SUPPLY_CHAIN_EDGE_TYPES,
] as const satisfies readonly SupplyChainEdgeType[];

export const SUPPLY_CHAIN_BASELINE_METHODS = [
  'WEIGHTED_PATH_PROPAGATION',
  'PAGERANK_LIKE',
  'BETWEENNESS',
  'SUPPLIER_CONCENTRATION',
  'CUSTOMER_CONCENTRATION',
] as const;
export type SupplyChainBaselineMethod = (typeof SUPPLY_CHAIN_BASELINE_METHODS)[number];

export const SUPPLY_CHAIN_RESEARCH_MODEL_KINDS = [
  'DIRECTION_SENSITIVE_GNN',
  'HETEROGENEOUS_GRAPH_ATTENTION',
  'TEMPORAL_GNN',
  'GRAPH_PATCH_TRANSFORMER',
] as const;
export type SupplyChainResearchModelKind = (typeof SUPPLY_CHAIN_RESEARCH_MODEL_KINDS)[number];

/** Default per-hop attenuation for multi-hop supplier disruption propagation (milli-scale: 850 = 0.85). */
export const DEFAULT_RISK_HOP_ATTENUATION_MILLI = 850 as const;

export const HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED =
  'HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED' as const;
export const HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_BLOCKED = 'HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_BLOCKED' as const;
