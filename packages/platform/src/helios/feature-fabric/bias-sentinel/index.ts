export {
  BIAS_SENTINEL_SCHEMA,
  BIAS_SEVERITIES,
  BIAS_DIMENSIONS,
  BIAS_METRIC_KINDS,
  UNIVERSE_COMPARISON_MODES,
  type BiasSeverity,
  type BiasDimension,
  type BiasMetricKind,
  type UniverseComparisonMode,
  type UniverseMemberProfile,
  type UniverseComparison,
  type BiasEvidence,
  type BiasFinding,
  type CoverageBiasAssessment,
  type SurvivorshipAssessment,
  type ProviderBiasAssessment,
  type MissingnessModelDiagnostic,
  type BiasAssessment,
  type BiasAssessmentInput,
  type BiasPromotionDecision,
  type BiasPromotionPolicy,
  type BiasPromotionGateResult,
} from './types.ts';

export { assessResearchBias } from './assess.ts';

export {
  DEFAULT_BIAS_SENTINEL_PROMOTION_POLICY,
  evaluateBiasPromotionGate,
} from './promotion-policy.ts';

export { diagnoseMissingnessModel } from './missingness-model.ts';

export { sealBiasSentinelAssessmentEvidence } from './evidence.ts';

export { biasSentinelInputFromCoverageTensor } from './integrations/coverage-tensor.ts';
export { biasSentinelProfilesFromCompilerManifest } from './integrations/compiler-dataset.ts';
export {
  attachBiasAssessmentToStrategyGenome,
  type StrategyGenomeBiasSentinelRef,
} from './integrations/strategy-genome.ts';

export {
  buildCleanControlUniverse,
  observedIdsForCleanControl,
  buildMegaCapAltDataBiasUniverse,
  buildSurvivorshipBiasUniverse,
  buildSectorTechDoublingUniverse,
  buildProviderUsBiasUniverse,
  buildLiquidityBiasUniverse,
  buildDelistingOmissionUniverse,
  buildCorporateActionBiasUniverse,
} from './fixtures.ts';

export {
  HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED,
  HELIOS_AAFV2_05_BIAS_SENTINEL_BLOCKED,
  evaluateAafv205Qualification,
  type Aafv205QualificationChecks,
  type Aafv205QualificationResult,
} from './qualification.ts';
