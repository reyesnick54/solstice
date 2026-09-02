/**
 * Wave 4 — Federated Economic Query types.
 *
 * Controlled federation boundary for authorized cross-source queries.
 * Data may remain where it belongs. This layer is not a monetary
 * authority, mint, ledger, or second oracle consensus engine.
 */

import type { FabricGeography } from '../types.ts';

export const FEDERATED_QUERY_LAYER_ID = 'sunrey.oracle.economic-data-fabric.federation.v1' as const;
export const FEDERATED_QUERY_LAYER_VERSION = 1 as const;

/** Federation engines must never become monetary authorities. */
export const FEDERATION_NOT_MONETARY_AUTHORITY = true as const;
export const CHUNK_71_REMAINS_MONETARY_AUTHORITY = true as const;

export const FEDERATION_QUERY_PURPOSES = [
  'RESEARCH',
  'OPERATIONAL_MONITORING',
  'FEDERATED_CORRELATION',
  'ECONOMIC_AWARENESS',
  'PRODUCT_IMPROVEMENT',
  'AGGREGATED_ANALYTICS',
  'ECONOMIC_VALUATION',
  'MONETARY_PROPOSAL',
] as const;
export type FederationQueryPurpose = (typeof FEDERATION_QUERY_PURPOSES)[number];

export const FEDERATION_DOMAINS = [
  'ENERGY',
  'WEATHER',
  'MANUFACTURING',
  'LOGISTICS',
  'RESEARCH_PUBLICATION',
  'WORKFORCE',
  'EDUCATION',
  'COMPUTE',
  'BANDWIDTH',
  'AGRICULTURE',
  'REFERENCE',
] as const;
export type FederationDomain = (typeof FEDERATION_DOMAINS)[number];

export const FEDERATION_METRIC_KINDS = [
  'AGGREGATE_SUM',
  'AGGREGATE_AVG',
  'AGGREGATE_COUNT',
  'DERIVED_RATIO',
  'PROOF_COMMITMENT',
  'REFERENCE_FACT',
] as const;
export type FederationMetricKind = (typeof FEDERATION_METRIC_KINDS)[number];

export const FEDERATION_SOURCE_KINDS = [
  'POSTGRESQL',
  'PROVIDER_API',
  'FILE_DATASET',
  'IN_MEMORY_STORE',
  'GRAPH_PROJECTION',
  'SEARCH_INDEX',
  'WAREHOUSE_LAKE',
  'CONNECTOR_MEDIATED',
] as const;
export type FederationSourceKind = (typeof FEDERATION_SOURCE_KINDS)[number];

export const FEDERATION_ACCESS_MODES = [
  'DIRECT_QUERY',
  'CONNECTOR_MEDIATED',
  'FIXTURE_ONLY',
  'NOT_QUERYABLE',
] as const;
export type FederationAccessMode = (typeof FEDERATION_ACCESS_MODES)[number];

export const MATERIALIZATION_LEVELS = [
  'QUERIED_ONLY',
  'CACHED',
  'OBSERVATION',
  'EVIDENCE_VAULT',
  'GRAPH_PROJECTION',
] as const;
export type MaterializationLevel = (typeof MATERIALIZATION_LEVELS)[number];

export const FEDERATION_REJECTION_CODES = [
  'PURPOSE_DENIED',
  'PURPOSE_NOT_INHERITED',
  'LICENSE_DENIED',
  'RIGHTS_DENIED',
  'JURISDICTION_DENIED',
  'SOURCE_UNAVAILABLE',
  'SOURCE_NOT_REGISTERED',
  'SOURCE_NOT_PERMITTED',
  'QUERY_TOO_BROAD',
  'FIELD_NOT_PERMITTED',
  'ROW_LIMIT_EXCEEDED',
  'TIMEOUT',
  'SCHEMA_MISMATCH',
  'PARTIAL_RESULT_UNSAFE',
  'PERSISTENCE_DENIED',
  'ARBITRARY_QUERY_FORBIDDEN',
  'PRINCIPAL_UNAUTHORIZED',
] as const;
export type FederationRejectionCode = (typeof FEDERATION_REJECTION_CODES)[number];

export const FEDERATION_RESULT_COMPLETENESS = [
  'COMPLETE',
  'PARTIAL',
  'FAILED',
] as const;
export type FederationResultCompleteness = (typeof FEDERATION_RESULT_COMPLETENESS)[number];

export type FederationRejection = Readonly<{
  readonly code: FederationRejectionCode;
  readonly message: string;
  readonly sourceId?: string;
}>;

export type FederationPrincipal = Readonly<{
  readonly principalId: string;
  readonly principalKind: 'SERVICE' | 'ACTOR' | 'AGENT';
  readonly jurisdiction?: string;
}>;

export type FederationRightsContext = Readonly<{
  readonly licenseId?: string;
  readonly consentRef?: string;
  readonly permittedPurposes: readonly FederationQueryPurpose[];
  readonly permittedMaterialization: readonly MaterializationLevel[];
  readonly jurisdiction?: string;
}>;

export type FederationMetricRequest = Readonly<{
  readonly metricId: string;
  readonly kind: FederationMetricKind;
  readonly field?: string;
  readonly aggregationWindow?: string;
}>;

export type FederationSourceConstraint = Readonly<{
  readonly sourceId: string;
  readonly providerId?: string;
  readonly datasetId?: string;
  readonly minTrustTier?: 'FIXTURE' | 'SANDBOX' | 'CERTIFIED';
}>;

export type FederatedQueryRequest = Readonly<{
  readonly queryId: string;
  readonly purpose: FederationQueryPurpose;
  readonly principal: FederationPrincipal;
  readonly domain: FederationDomain;
  readonly metrics: readonly FederationMetricRequest[];
  readonly sourceConstraints: readonly FederationSourceConstraint[];
  readonly requestedFields: readonly string[];
  readonly timeRange: Readonly<{ readonly fromUnix: bigint; readonly toUnix: bigint }>;
  readonly geography?: FabricGeography;
  readonly rightsContext: FederationRightsContext;
  readonly rowLimit?: number;
  readonly timeoutMs?: number;
  readonly allowPartial?: boolean;
  readonly requestedMaterialization?: MaterializationLevel;
}>;

export type FederatedFactAttribution = Readonly<{
  readonly providerId: string;
  readonly sourceId: string;
  readonly datasetId: string;
  readonly observedAtUnix: bigint;
  readonly unit: string;
  readonly licenseRef: string;
  readonly provenanceRef: string;
  readonly contentCommitment: string;
}>;

export type FederatedMetricResult = Readonly<{
  readonly metricId: string;
  readonly kind: FederationMetricKind;
  readonly mantissa: bigint;
  readonly scale: number;
  readonly unit: string;
  readonly attribution: FederatedFactAttribution;
}>;

export type FederatedSourceOutcome = Readonly<{
  readonly sourceId: string;
  readonly status: 'OK' | 'UNAVAILABLE' | 'DENIED' | 'TIMEOUT' | 'SCHEMA_MISMATCH' | 'CONFLICT';
  readonly metrics: readonly FederatedMetricResult[];
  readonly rejection?: FederationRejection;
}>;

export type FederatedQueryResult = Readonly<{
  readonly queryId: string;
  readonly purpose: FederationQueryPurpose;
  readonly completeness: FederationResultCompleteness;
  readonly materialization: MaterializationLevel;
  readonly persistenceAuthorized: boolean;
  readonly sourceOutcomes: readonly FederatedSourceOutcome[];
  readonly metrics: readonly FederatedMetricResult[];
  readonly rejection?: FederationRejection;
  readonly partialWarning?: string;
}>;

export type FederationDataSourceRecord = Readonly<{
  readonly sourceId: string;
  readonly label: string;
  readonly kind: FederationSourceKind;
  readonly accessMode: FederationAccessMode;
  readonly ownerPackage: string;
  readonly domains: readonly FederationDomain[];
  readonly directQueryable: boolean;
  readonly connectorRequired: boolean;
  readonly notes: string;
}>;

export function federationRejection(
  code: FederationRejectionCode,
  message: string,
  sourceId?: string,
): FederationRejection {
  return Object.freeze({ code, message, ...(sourceId ? { sourceId } : {}) });
}
