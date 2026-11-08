import type { UtcInstant } from '@solstice/domain';

import type {
  ForwardCampaignLifecycleState,
  HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
  PermittedAdaptationRuleKind,
} from './taxonomy.ts';

export type ForwardCampaignId = string & { readonly __brand: 'ForwardCampaignId' };

export type FrozenStrategyGenomeRef = {
  readonly genomeId: string;
  readonly genomeVersion: string;
  readonly genomeContentDigest: string;
};

export type FrozenFeatureRef = {
  readonly featureCatalogRef: string;
  readonly featureVersion: string;
};

export type FrozenRuleBundleRef = {
  readonly catalogRef: string;
  readonly contentDigest: string;
};

export type FrozenEvaluationMetricRef = {
  readonly metricId: string;
  readonly version: string;
};

export type FrozenStatisticalTestRef = {
  readonly testId: string;
  readonly version: string;
  readonly alpha: string;
};

export type FrozenPromotionThreshold = {
  readonly gateId: string;
  readonly thresholdDigest: string;
};

/**
 * Strategy configuration sealed before forward campaign start — no post-hoc edits.
 */
export type FrozenStrategyManifest = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly strategyGenome: FrozenStrategyGenomeRef;
  readonly strategyVersion: string;
  readonly featureSet: readonly FrozenFeatureRef[];
  readonly featureManifestVersion: string;
  readonly modelVersions: readonly string[];
  readonly entryRules: FrozenRuleBundleRef;
  readonly exitRules: FrozenRuleBundleRef;
  readonly positionSizing: FrozenRuleBundleRef;
  readonly riskGates: FrozenRuleBundleRef;
  readonly regimeGates: FrozenRuleBundleRef;
  readonly universeDefinitionDigest: string;
  readonly executionPolicy: FrozenRuleBundleRef;
  readonly capitalModelDigest: string;
  readonly evaluationMetrics: readonly FrozenEvaluationMetricRef[];
  readonly statisticalTests: readonly FrozenStatisticalTestRef[];
  readonly promotionThresholds: readonly FrozenPromotionThreshold[];
};

export type FrozenHypothesis = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly statement: string;
  readonly primaryMetricId: string;
  readonly falsificationCriteriaDigest: string;
};

export type FrozenBenchmarkPolicy = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly benchmarkId: string;
  readonly benchmarkVersion: string;
  readonly comparisonPolicyDigest: string;
};

export type FrozenCostPolicy = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly costModelId: string;
  readonly costModelVersion: string;
  readonly assumptionsDigest: string;
};

export type FrozenSizingPolicy = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly sizingCatalogRef: string;
  readonly sizingPolicyDigest: string;
};

export type FrozenAdaptationRule = {
  readonly ruleId: string;
  readonly kind: PermittedAdaptationRuleKind;
  readonly parameterPaths: readonly string[];
  readonly triggerDigest: string;
  readonly maxStepDigest: string;
};

export type FrozenAdaptationPolicy = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly onlineLearningPermitted: boolean;
  readonly permittedRules: readonly FrozenAdaptationRule[];
  readonly manualOverrideForbidden: true;
};

export type AdaptationEventRecord = {
  readonly eventId: string;
  readonly recordedAt: UtcInstant;
  readonly ruleId: string;
  readonly ruleKind: PermittedAdaptationRuleKind;
  readonly parameterPath: string;
  readonly priorValueDigest: string;
  readonly newValueDigest: string;
  readonly triggerDigest: string;
};

export type ForwardCampaignLifecycle = {
  readonly state: ForwardCampaignLifecycleState;
  readonly sealedAt: UtcInstant;
  readonly startedAt: UtcInstant | null;
  readonly supersededAt: UtcInstant | null;
  readonly completedAt: UtcInstant | null;
};

/**
 * Immutable forward-alpha campaign registration after seal; configuration body fixed at `campaignFingerprint`.
 */
export type ForwardCampaignRegistration = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly campaignId: ForwardCampaignId;
  readonly strategyId: string;
  readonly manifest: FrozenStrategyManifest;
  readonly hypothesis: FrozenHypothesis;
  readonly benchmarkPolicy: FrozenBenchmarkPolicy;
  readonly costPolicy: FrozenCostPolicy;
  readonly sizingPolicy: FrozenSizingPolicy;
  readonly adaptationPolicy: FrozenAdaptationPolicy;
  readonly campaignFingerprint: string;
  readonly lifecycle: ForwardCampaignLifecycle;
  readonly adaptationEvents: readonly AdaptationEventRecord[];
  readonly supersededByCampaignId: ForwardCampaignId | null;
  readonly predecessorCampaignId: ForwardCampaignId | null;
  readonly simulationOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type Alpha02PreregistrationEvidence = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA;
  readonly qualificationMarker:
    | 'HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED'
    | 'HELIOS_ALPHA02_PREREGISTRATION_BLOCKED';
  readonly campaign: ForwardCampaignRegistration;
  readonly blockers: readonly string[];
};
