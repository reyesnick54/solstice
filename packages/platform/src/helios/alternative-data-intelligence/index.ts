export * from './alt04-workforce/index.ts';
export * from './alt12/index.ts';

export {
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED,
  HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA,
  HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY,
  HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED,
  HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED,
  ALT_WORK_PACKAGES,
  SKEPTIC_ALT_ATTACK_VECTORS,
  AAF_CERTIFIED_ALT_FEATURE_IDS,
  ALT14_ADVERSARIAL_SCENARIO_IDS,
  ALT_MODALITIES,
  ALT_MISSING_REASONS,
  ALT_BASELINE_FUSION_MODELS,
  ALT_ADVANCED_FUSION_MODELS,
  ALT_FUSION_MODEL_KINDS,
  ALT12_FUSION_MODULE,
  type AltWorkPackageId,
  type AlternativeDataSkepticAttackVector,
  type AafCertifiedAltFeatureId,
  type Alt14AdversarialScenarioId,
  type AltModalityId,
  type AltMissingReason,
  type AltFusionModelKind,
} from './taxonomy.ts';

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
