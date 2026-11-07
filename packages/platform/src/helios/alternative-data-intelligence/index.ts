export {
  HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
  ALTERNATIVE_DATA_SIGNAL_FAMILIES,
  ALT_DATA_PROVIDER_SURFACES,
  ALT01_CANONICAL_FEATURE_IDS,
  ALT01_FORMULA_VERSIONS,
  ALT01_AUTHORITY_CLASS,
  type AlternativeDataSignalFamily,
  type AltDataProviderSurface,
  type Alt01CanonicalFeatureId,
} from './taxonomy.ts';

export type {
  AlternativeDataLicenseClass,
  AlternativeDataQualityState,
  AlternativeDataGeographicCoverage,
  AlternativeDataEntitlement,
  AlternativeDataEntityLink,
  AlternativeDataRevision,
  AlternativeDataCoverageState,
  AlternativeDataSourceManifest,
  AlternativeDataSeries,
  AlternativeDataObservation,
  AlternativeDataFeature,
  AlternativeDataIntelligencePlane,
  AlternativeDataIntelligenceStoreSnapshot,
  AlternativeDataObservationInput,
} from './types.ts';

export { ALT01_REFERENCE_AND_RESEARCH_ONLY, ALT01_GRANTS_EXECUTION_AUTHORITY, type Alt01AuthorityClass } from './authority.ts';
export { ALT01_CANONICAL_OWNER_REUSE, ALT01_EXPLICIT_NON_OWNERS } from './canonical-owners.ts';

export {
  isAlternativeDataVisibleAtDecision,
  filterKnowableAlternativeDataObservations,
  assertNoBackfillBeforeHistoricalAvailability,
  assertAlternativeDataKnowableAtDecision,
} from './knowable-at.ts';

export { buildAlternativeDataCoverageState } from './coverage.ts';
export { computeAlternativeDataFeatures } from './features.ts';

export {
  AlternativeDataIntelligenceFabric,
  createAlternativeDataIntelligenceFabric,
  type AlternativeDataIntelligenceFabricOptions,
} from './service.ts';

export {
  wave6CategoryToSignalFamily,
  wave5CategoryToSignalFamily,
  ALT01_PRESERVED_ASSETS,
} from './external-data-bridge.ts';

export { alternativeDataPlaneToAdaptiveAlphaContext, type AdaptiveAlphaAltDataContext } from './adaptive-alpha-bridge.ts';

export {
  HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED,
  HELIOS_ALT01_CANONICAL_FABRIC_BLOCKED,
  evaluateAlt01Qualification,
  type Alt01QualificationChecks,
  type Alt01QualificationResult,
} from './qualification.ts';

export {
  wave6WorkforceManifestFixture,
  wave5GeospatialSeriesFixture,
  workforceObservationInitialFixture,
  workforceObservationFollowOnFixture,
  illegalBackfillObservationFixture,
  delayedProviderObservationFixture,
} from './fixtures.ts';

export * from './alt04-workforce/index.ts';
export * from './alt09/index.ts';
export * from './alt12/index.ts';
export { listAltWorkPackages, type AltWorkPackageRow } from './work-package-registry.ts';
