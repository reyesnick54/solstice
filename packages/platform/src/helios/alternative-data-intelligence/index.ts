export * from './taxonomy.ts';

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
  AlternativeDataResearchState,
  SignalFamilyState,
  SkepticFinding,
  AltStrategyGenomeFeatureRow,
  SourceContribution,
  ContradictingSignal,
  IncrementalInformationAssessment,
  AafQualificationLabel,
  AltResearchBuildInput,
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
} from './alt01-fixtures.ts';

export * from './alt04-workforce/index.ts';
export * from './geospatial-activity/index.ts';
export * from './alt09/index.ts';
export * from './alt12/index.ts';

export { buildAlternativeDataResearchState } from './alt09-synthesis.ts';
export {
  runAlternativeDataSkepticChecks,
  skepticGateBlocksAafCertification,
  type SkepticCheckInput,
} from './alt08-skeptic.ts';
export {
  compileAltStrategyGenomeFeatures,
  assertNoRawProviderRecordsInGenome,
} from './alt11-strategy-genome-features.ts';
export {
  runAdversarialScenario,
  runAllAlt14AdversarialScenarios,
  type AdversarialScenarioResult,
} from './adversarial-qualification.ts';
export {
  evaluateAlternativeDataIntelligenceQualification,
  listAltWorkPackages,
  type AlternativeDataIntelligenceQualificationInput,
  type AlternativeDataIntelligenceQualificationResult,
  type AltWorkPackageRow,
} from './alt14-qualification.ts';
export { demoAlternativeDataResearchState } from './fixtures.ts';
export { bindAltIntelligenceToAafV2, ALT10_AAF_V2_MANDATORY } from './alt10-aaf-bridge.ts';
export {
  assertEvol12MayProposeAlternativeFeatures,
  applyEvol09MultipleTestingNote,
  registerAltFeatureScreeningTrials,
} from './alt14-evol-bridge.ts';
export {
  HELIOS_ALT13_COUNTERFACTUAL_BRIDGE,
  linkAltResearchToCounterfactualAssessment,
} from './alt13-counterfactual-bridge.ts';
