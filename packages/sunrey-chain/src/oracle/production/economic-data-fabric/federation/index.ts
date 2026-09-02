/**
 * Wave 4 — Federated Economic Query public interface.
 */

export {
  FEDERATED_QUERY_LAYER_ID,
  FEDERATED_QUERY_LAYER_VERSION,
  FEDERATION_NOT_MONETARY_AUTHORITY,
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
  FEDERATION_QUERY_PURPOSES,
  FEDERATION_DOMAINS,
  FEDERATION_METRIC_KINDS,
  FEDERATION_SOURCE_KINDS,
  FEDERATION_ACCESS_MODES,
  MATERIALIZATION_LEVELS,
  FEDERATION_REJECTION_CODES,
  FEDERATION_RESULT_COMPLETENESS,
  federationRejection,
} from './types.ts';
export type {
  FederationQueryPurpose,
  FederationDomain,
  FederationMetricKind,
  FederationSourceKind,
  FederationAccessMode,
  MaterializationLevel,
  FederationRejectionCode,
  FederationResultCompleteness,
  FederationRejection,
  FederationPrincipal,
  FederationRightsContext,
  FederationMetricRequest,
  FederationSourceConstraint,
  FederatedQueryRequest,
  FederatedFactAttribution,
  FederatedMetricResult,
  FederatedSourceOutcome,
  FederatedQueryResult,
  FederationDataSourceRecord,
} from './types.ts';

export { CANONICAL_FEDERATION_SOURCES, FederationSourceRegistry } from './source-registry.ts';

export {
  TRINO_EVALUATION_VERSION,
  TRINO_OPERATIONALLY_JUSTIFIED,
  TRINO_INTEGRATION_ACTIVE,
  TRINO_EVALUATION,
  createDefaultFederationAdapter,
  InMemoryFederationAdapter,
  TrinoFederationAdapterPlaceholder,
} from './adapter.ts';
export type {
  TrinoEvaluationDecision,
  FederationAdapter,
  FederationSourceQueryInput,
  FederationSourceQueryOutcome,
  InMemorySourceHandler,
} from './adapter.ts';

export {
  HEIGHTENED_FEDERATION_PURPOSES,
  NON_INHERITING_PURPOSES,
  purposePermitsUse,
  refusePurposeExpansion,
  evaluateFederationPurpose,
  propagateQueryPurpose,
} from './purpose-gate.ts';

export {
  DEFAULT_ROW_LIMIT,
  MAX_ROW_LIMIT,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MAX_FIELDS_PER_QUERY,
  MAX_METRICS_PER_QUERY,
  MAX_SOURCES_PER_QUERY,
  applyMinimizationDefaults,
  validateQueryMinimization,
  prefersAggregates,
} from './minimization.ts';

export {
  defaultMaterializationForPurpose,
  resolveMaterialization,
  materializationAllowed,
  describeMaterialization,
  maxMaterializationFromRights,
  isWithinLicenseCeiling,
} from './materialization.ts';

export {
  FEDERATION_AUDIT_RECEIPT_VERSION,
  resultReferenceOf,
  recordFederationAuditReceipt,
  FederationAuditJournal,
} from './audit.ts';
export type { FederationAuditReceipt } from './audit.ts';

export { executeFederatedQuery } from './executor.ts';
export type { FederationExecuteInput, FederationExecuteOutput } from './executor.ts';

export {
  FEDERATION_FIXTURE_NOW_UNIX,
  RESEARCH_RIGHTS_CONTEXT,
  ECONOMIC_AWARENESS_RIGHTS_CONTEXT,
  VALUATION_RIGHTS_CONTEXT,
  ENERGY_WEATHER_CROSS_SOURCE_QUERY,
  MANUFACTURING_LOGISTICS_CROSS_SOURCE_QUERY,
  RESEARCH_PUBLICATION_CROSS_SOURCE_QUERY,
  WORKFORCE_EDUCATION_CROSS_SOURCE_QUERY,
  registerFederationFixtureHandlers,
  registerUnavailableSourceHandler,
  registerLicenseDeniedHandler,
} from './fixtures.ts';
