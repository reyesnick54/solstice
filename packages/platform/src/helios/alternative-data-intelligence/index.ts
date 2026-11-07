export * from './taxonomy.ts';
export * from './alt04-workforce/index.ts';
export * from './alt09/index.ts';
export * from './alt12/index.ts';

export type {
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
