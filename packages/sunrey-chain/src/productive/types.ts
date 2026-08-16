/**
 * Chunk 44 — Global Productive Capacity Graph and MoonRey issuance types.
 *
 * The graph is a derived projection. Authoritative facts are registered
 * objects, rights, oracle facts, productive claims, verified contributions,
 * and finalized MoonRey issuance transactions.
 *
 * Category weights in development fixtures are
 * ENGINEERING_SIMULATION_PARAMETERS. They are not market prices or
 * economic promises.
 */

export const PRODUCTIVE_SCHEMA_VERSION = 1 as const;
export const WEIGHT_SCALE = 1_000_000n;
export const FORMULA_VERSION = 'moonrey.issuance.formula.v1' as const;
export const POLICY_PARAMETER_CLASS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;
export const HASH_DOMAIN_PRODUCTIVE = 'SUNREY_PRODUCTIVE_V1' as const;

export const PRODUCTIVE_CATEGORIES = [
  'ENERGY',
  'FOOD_AGRICULTURE',
  'WATER',
  'MINERALS_RAW_MATERIALS',
  'REAL_ESTATE_USE',
  'COMPUTE',
  'AI_COMPUTE',
  'MANUFACTURING',
  'LOGISTICS_TRANSPORTATION',
  'STORAGE',
  'BANDWIDTH_COMMUNICATIONS',
  'INFRASTRUCTURE',
  'GOODS',
  'SERVICES',
  'AUTOMATED_MACHINE_OUTPUT',
] as const;
export type ProductiveCategory = (typeof PRODUCTIVE_CATEGORIES)[number];

export const CLAIM_TYPES = ['CAPACITY', 'OUTPUT', 'DELIVERY', 'USAGE', 'RESERVE'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const OBJECT_STATUSES = ['REGISTERED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'SUPERSEDED'] as const;
export type ObjectStatus = (typeof OBJECT_STATUSES)[number];

export const CLAIM_STATUSES = ['SUBMITTED', 'VERIFIED', 'REJECTED', 'SUPERSEDED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CONTRIBUTION_STATUSES = ['ELIGIBLE', 'REJECTED', 'ISSUED', 'SUPERSEDED'] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export const ORACLE_FACT_STATUSES = ['FINALIZED', 'STALE', 'CONFLICTED', 'SUPERSEDED'] as const;
export type OracleFactStatus = (typeof ORACLE_FACT_STATUSES)[number];

export const ROUNDING_MODES = ['FLOOR', 'CEIL', 'ROUND_HALF_EVEN'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

export const GRAPH_NODE_KINDS = [
  'PRODUCTIVE_OBJECT',
  'OWNER',
  'CONTROLLER',
  'LOCATION',
  'RESOURCE_CLASS',
  'CAPACITY_CLAIM',
  'OUTPUT_CLAIM',
  'DELIVERY_CLAIM',
  'USAGE_CLAIM',
  'RESERVE_CLAIM',
  'VERIFIED_CONTRIBUTION',
  'ORACLE_FACT',
] as const;
export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number];

export const GRAPH_EDGE_KINDS = [
  'OWNS',
  'CONTROLS',
  'OPERATES',
  'PRODUCES',
  'CONSUMES',
  'DELIVERS',
  'DEPENDS_ON',
  'LOCATED_IN',
  'VERIFIED_BY',
  'DERIVED_FROM',
  'SUPPLIES',
  'USES_RESOURCE',
  'HAS_CAPACITY',
] as const;
export type GraphEdgeKind = (typeof GRAPH_EDGE_KINDS)[number];

export const REJECTION_CODES = [
  'UNREGISTERED_OBJECT',
  'OBJECT_NOT_ACTIVE',
  'MISSING_RIGHTS',
  'RIGHTS_EXPIRED',
  'RIGHTS_REVOKED',
  'INSUFFICIENT_ORACLE_QUORUM',
  'STALE_ORACLE_FACT',
  'CONFLICTED_ORACLE_FACT',
  'UNIT_MISMATCH',
  'MEASUREMENT_PERIOD_UNDEFINED',
  'DUPLICATE_CONTRIBUTION',
  'DUPLICATE_ISSUANCE',
  'POLICY_INELIGIBLE_CATEGORY',
  'POLICY_INELIGIBLE_CLAIM_TYPE',
  'POLICY_NOT_ACTIVE',
  'EPOCH_CATEGORY_CAP',
  'EPOCH_GLOBAL_CAP',
  'OBJECT_ISSUANCE_CAP',
  'CONTROLLER_ISSUANCE_CAP',
  'QUALITY_BELOW_MINIMUM',
  'AUTHORIZATION_NOT_FINALIZED',
  'CORRECTION_REQUIRED',
] as const;
export type ProductiveRejectionCode = (typeof REJECTION_CODES)[number];

export type MeasurementPeriod = {
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly epoch: number;
};

export type GeographyRef = {
  readonly geographyId: string;
  readonly jurisdiction: string;
};

export type CategoryExtension = {
  readonly categoryId: string;
  readonly parentCategory: ProductiveCategory;
  readonly unitSchemaId: string;
  readonly activationHeight: number;
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
  readonly governed: true;
};

export function isProductiveCategory(value: string): value is ProductiveCategory {
  return (PRODUCTIVE_CATEGORIES as readonly string[]).includes(value);
}

export function isClaimType(value: string): value is ClaimType {
  return (CLAIM_TYPES as readonly string[]).includes(value);
}

export function claimNodeKind(claimType: ClaimType): GraphNodeKind {
  switch (claimType) {
    case 'CAPACITY':
      return 'CAPACITY_CLAIM';
    case 'OUTPUT':
      return 'OUTPUT_CLAIM';
    case 'DELIVERY':
      return 'DELIVERY_CLAIM';
    case 'USAGE':
      return 'USAGE_CLAIM';
    case 'RESERVE':
      return 'RESERVE_CLAIM';
  }
}
