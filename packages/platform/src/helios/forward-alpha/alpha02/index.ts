/**
 * HELIOS Forward Alpha — ALPHA02 strategy pre-registration and campaign freeze.
 */

export {
  HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
  HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED,
  HELIOS_ALPHA02_PREREGISTRATION_BLOCKED,
  FORWARD_CAMPAIGN_LIFECYCLE_STATES,
  PERMITTED_ADAPTATION_RULE_KINDS,
  FORBIDDEN_ADAPTATION_RULE_KINDS,
  type ForwardCampaignLifecycleState,
  type PermittedAdaptationRuleKind,
  type ForbiddenAdaptationRuleKind,
} from './taxonomy.ts';

export type {
  ForwardCampaignId,
  FrozenStrategyGenomeRef,
  FrozenFeatureRef,
  FrozenRuleBundleRef,
  FrozenEvaluationMetricRef,
  FrozenStatisticalTestRef,
  FrozenPromotionThreshold,
  FrozenStrategyManifest,
  FrozenHypothesis,
  FrozenBenchmarkPolicy,
  FrozenCostPolicy,
  FrozenSizingPolicy,
  FrozenAdaptationRule,
  FrozenAdaptationPolicy,
  AdaptationEventRecord,
  ForwardCampaignLifecycle,
  ForwardCampaignRegistration,
  Alpha02PreregistrationEvidence,
} from './types.ts';

export { computeCampaignFingerprint, digestRuleContent, stableStringify } from './fingerprint.ts';

export {
  asForwardCampaignId,
  sealForwardCampaignRegistration,
  startForwardCampaign,
  supersedeCampaignForStrategyRevision,
  frozenRuleBundleFromContent,
  type SealForwardCampaignInput,
} from './registration.ts';

export {
  assertCampaignConfigurationImmutable,
  campaignFingerprintMatchesRegistration,
  rejectHindsightConfigurationPatch,
  type CampaignConfigurationPatch,
} from './immutability.ts';

export {
  recordAdaptationEvent,
  validateAdaptationPermitted,
  type ProposeAdaptationInput,
  type AdaptationFailure,
} from './adaptation.ts';

export {
  evaluateAlpha02PreregistrationQualification,
  buildAlpha02PreregistrationEvidence,
  type Alpha02QualificationResult,
} from './qualification.ts';

export {
  buildSampleFrozenStrategyManifest,
  buildSampleFrozenHypothesis,
  buildSampleFrozenBenchmarkPolicy,
  buildSampleFrozenCostPolicy,
  buildSampleFrozenSizingPolicy,
  buildSampleFrozenAdaptationPolicy,
  sampleCampaignId,
  type SampleSealBundle,
} from './fixtures.ts';
