/**
 * Chunk 138 — unified multi-provider economic data fabric.
 *
 * Selective named exports. This module does not re-export provider-family
 * barrels (those collide on shared helper names).
 */

export {
  ADMISSION_MODES,
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
  CONSENSUS_CALLED_HTTP,
  DATA_FABRIC_AUTHORIZES_ISSUANCE,
  DATA_FABRIC_CREATES_PRODUCTIVE_CONTRIBUTION,
  DATA_FABRIC_FINALIZES_FACTS,
  DATA_FABRIC_MINTS_MOONREY,
  ECONOMIC_DATA_FABRIC_ID,
  ECONOMIC_DATA_FABRIC_VERSION,
  FABRIC_CONNECTOR_RUNTIME_VERSION,
  FABRIC_MAX_BATCH_SIZE,
  FABRIC_NORMALIZATION_VERSION,
  FABRIC_REJECTION_CODES,
  FABRIC_SOURCE_TAXONOMY_VERSION,
  FACT_COVERAGE_CLASSES,
  LIVE_PROVIDER_CONNECTED,
  PRODUCTION_ACTIVE,
  PRODUCTION_LIVE_ADMISSION_EXISTS,
  PROVIDER_FAMILY_IDS,
  fabricRejection,
  isAdmissionMode,
  isProviderFamilyId,
} from './types.ts';
export type {
  AdmissionMode,
  BatchIngestResult,
  BatchRecordResult,
  CollectionCandidate,
  CorrelationConfidence,
  CoverageFlags,
  CrossDomainLineageLink,
  CrossProviderConflictCandidate,
  EconomicDataCollectionEnvelope,
  EconomicDataFabricCoverageReport,
  EconomicDataProviderFamilyRecord,
  EconomicEventCorrelationCandidate,
  FabricGeography,
  FabricRejection,
  FabricRejectionCode,
  FactCoverageClass,
  FamilyHealthSnapshot,
  ObservationGroup,
  OracleObservationDraftBatch,
  PrivacyClass,
  ProviderFamilyId,
  SourceQuantity,
} from './types.ts';
export { CANONICAL_PROVIDER_FAMILIES } from './family.ts';
export {
  CANONICAL_FAMILY_REGISTRY,
  EconomicDataProviderFamilyRegistry,
  everyCanonicalFamilyRegistered,
  familySupportsSource,
  registeredFamilyCount,
} from './registry.ts';
export {
  everyActiveSourceCategoryHasRoute,
  everyProductiveFactTypeHasRoute,
  familyForFactType,
  familyForSourceCategory,
  routeCollection,
} from './routing.ts';
export { admitCollection, envelopeOmitsRawPayload } from './admission.ts';
export {
  buildCoverageReport,
  documentedCoverageGaps,
  everyActiveSourceCategoryHasFamilyRouting,
  everyFactTypeHasDeliberateRouting,
  everyProductiveCategoryHasStatus,
  liveProviderConnectedCount,
} from './coverage.ts';
export {
  analyzeIndependentSources,
  detectCorrelationCandidates,
  groupObservations,
  observationGroupKeyOf,
  prepareObservationBatch,
  reportCrossProviderConflicts,
} from './reconciliation.ts';
export { collectLineage, lineageRelation, linkLineage } from './lineage.ts';
export { aggregateFamilyHealth, familyHealth, healthIsNotMoonReyFactor } from './health.ts';
export { EconomicDataFabricStore, ingestBatch } from './batch.ts';
export { operationalReport, projectFabricAssets } from './report.ts';
export {
  agricultureFixture,
  aiInferenceFixture,
  arbitraryUrlFixture,
  bandwidthFixture,
  computeUsageFixture,
  conflictingEnergyQuantities,
  credentialFixture,
  energyProductionFixture,
  FABRIC_NOW_UNIX,
  fixtureCandidate,
  overlayCandidate,
  goodsOutputFixture,
  infrastructureFixture,
  logisticsDeliveryFixture,
  manufacturingOutputFixture,
  multiDomainScenario,
  privacyLeakFixture,
  rawPayloadFixture,
  realEstateFixture,
  referencePriceFixture,
  resourceExtractionFixture,
  sameControllerSources,
  serviceDeliveryFixture,
  storageFixture,
  waterFixture,
} from './fixtures.ts';
export { runUnifiedEconomicDataFabricDemo, simulateGovernedPath, submitEnvelopeGroupToOracle } from './demo.ts';
export {
  FEDERATED_QUERY_LAYER_ID,
  FEDERATED_QUERY_LAYER_VERSION,
  FEDERATION_NOT_MONETARY_AUTHORITY,
  CANONICAL_FEDERATION_SOURCES,
  FederationSourceRegistry,
  TRINO_EVALUATION,
  TRINO_OPERATIONALLY_JUSTIFIED,
  TRINO_INTEGRATION_ACTIVE,
  createDefaultFederationAdapter,
  InMemoryFederationAdapter,
  evaluateFederationPurpose,
  refusePurposeExpansion,
  applyMinimizationDefaults,
  validateQueryMinimization,
  resolveMaterialization,
  executeFederatedQuery,
  FederationAuditJournal,
  ENERGY_WEATHER_CROSS_SOURCE_QUERY,
  MANUFACTURING_LOGISTICS_CROSS_SOURCE_QUERY,
  RESEARCH_PUBLICATION_CROSS_SOURCE_QUERY,
  WORKFORCE_EDUCATION_CROSS_SOURCE_QUERY,
  registerFederationFixtureHandlers,
  FEDERATION_FIXTURE_NOW_UNIX,
} from './federation/index.ts';
export type {
  FederatedQueryRequest,
  FederatedQueryResult,
  FederationQueryPurpose,
  MaterializationLevel,
  FederationAuditReceipt,
} from './federation/index.ts';
