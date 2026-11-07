/**
 * HELIOS ALT03 — alternative-data temporal entity, brand, facility, and product resolution.
 */

export const HELIOS_ALT03 = 'HELIOS_ALT03' as const;

export const HELIOS_ALT03_ENTITY_ASSET_GRAPH_SCHEMA =
  'sunrey.helios.alternative-data.entity-asset-graph.v1' as const;

export const HELIOS_ALT03_AUTHORITY = 'REFERENCE_ONLY' as const;

/** Asset entity kinds for alternative observations (stored on AAF03 temporal graph nodes). */
export const ALT_ASSET_ENTITY_KINDS = [
  'PUBLIC_COMPANY',
  'PRIVATE_COMPANY',
  'SUBSIDIARY',
  'BRAND',
  'PRODUCT',
  'FACILITY',
  'FACTORY',
  'WAREHOUSE',
  'PORT',
  'VESSEL',
  'MINE',
  'POWER_PLANT',
  'DATACENTER',
  'PATENT_ASSIGNEE',
  'GOVERNMENT_CONTRACTOR',
] as const;
export type AltAssetEntityKind = (typeof ALT_ASSET_ENTITY_KINDS)[number];

export const ALT_ASSET_RELATIONSHIP_TYPES = [
  'OWNS',
  'OWNED_BY',
  'SUBSIDIARY_OF',
  'BRAND_OF',
  'OPERATES',
  'LOCATED_AT',
  'SUPPLIES',
  'CUSTOMER_OF',
  'ASSIGNED_TO',
  'CONTRACT_AWARDED_TO',
] as const;
export type AltAssetRelationshipType = (typeof ALT_ASSET_RELATIONSHIP_TYPES)[number];

export const ALT_OBSERVATION_MATCH_STATES = [
  'EXACT',
  'HIGH_CONFIDENCE',
  'AMBIGUOUS',
  'UNRESOLVED',
  'CONFLICTING',
  'EXPIRED',
] as const;
export type AltObservationMatchState = (typeof ALT_OBSERVATION_MATCH_STATES)[number];

export const ALT_MATCH_CASCADE_STAGES = [
  'DETERMINISTIC_IDENTIFIER',
  'CURATED_CROSSWALK',
  'EXACT_NORMALIZED_IDENTIFIER',
  'PROBABILISTIC_MATCH',
  'LLM_ASSISTED_CANDIDATE',
] as const;
export type AltMatchCascadeStage = (typeof ALT_MATCH_CASCADE_STAGES)[number];

/** Surfaces that must not collapse to a listed parent without an explicit graph path. */
export const ALT_OBSERVATION_SURFACES = [
  'BRAND_MENTION',
  'FACILITY_ACTIVITY',
  'FACTORY_OUTPUT',
  'WAREHOUSE_THROUGHPUT',
  'PORT_CALL',
  'VESSEL_CARGO',
  'MINE_PRODUCTION',
  'POWER_GENERATION',
  'DATACENTER_UTILIZATION',
  'PATENT_FILING',
  'GOVERNMENT_CONTRACT',
  'JOB_POSTING',
  'WEBSITE_SIGNAL',
  'PRODUCT_MENTION',
] as const;
export type AltObservationSurface = (typeof ALT_OBSERVATION_SURFACES)[number];

export const HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED =
  'HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED' as const;

export const HELIOS_ALT03_ENTITY_ASSET_GRAPH_BLOCKED =
  'HELIOS_ALT03_ENTITY_ASSET_GRAPH_BLOCKED' as const;
