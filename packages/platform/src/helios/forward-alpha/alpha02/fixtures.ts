import type { UtcInstant } from '@solstice/domain';

import { frozenRuleBundleFromContent } from './registration.ts';
import { digestRuleContent } from './fingerprint.ts';
import { HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA } from './taxonomy.ts';
import type {
  ForwardCampaignId,
  FrozenAdaptationPolicy,
  FrozenBenchmarkPolicy,
  FrozenCostPolicy,
  FrozenHypothesis,
  FrozenSizingPolicy,
  FrozenStrategyManifest,
} from './types.ts';

export function buildSampleFrozenStrategyManifest(input: {
  readonly genomeId: string;
  readonly genomeVersion: string;
  readonly genomeContentDigest: string;
  readonly strategyVersion: string;
  readonly featureManifestVersion: string;
  readonly instrumentUniverse: readonly string[];
  readonly entryContent: unknown;
  readonly exitContent: unknown;
  readonly sizingContent: unknown;
  readonly riskContent: unknown;
  readonly regimeContent: unknown;
  readonly executionContent: unknown;
  readonly modelVersions: readonly string[];
}): FrozenStrategyManifest {
  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    strategyGenome: Object.freeze({
      genomeId: input.genomeId,
      genomeVersion: input.genomeVersion,
      genomeContentDigest: input.genomeContentDigest,
    }),
    strategyVersion: input.strategyVersion,
    featureSet: Object.freeze([
      Object.freeze({ featureCatalogRef: 'feature.realized_volatility', featureVersion: 'v1' }),
    ]),
    featureManifestVersion: input.featureManifestVersion,
    modelVersions: Object.freeze([...input.modelVersions]),
    entryRules: frozenRuleBundleFromContent('signal.mean_reversion_zscore', input.entryContent),
    exitRules: frozenRuleBundleFromContent('exit.zscore_normalize_or_stop', input.exitContent),
    positionSizing: frozenRuleBundleFromContent('sizing.volatility_target_exposure', input.sizingContent),
    riskGates: frozenRuleBundleFromContent('risk.max_strategy_contribution_portfolio_var', input.riskContent),
    regimeGates: frozenRuleBundleFromContent('regime.permitted_vol_band', input.regimeContent),
    universeDefinitionDigest: digestRuleContent(input.instrumentUniverse),
    executionPolicy: frozenRuleBundleFromContent('execution.passive_limit_preferred', input.executionContent),
    capitalModelDigest: digestRuleContent({ notionalMinor: '100000000', currency: 'USD' }),
    evaluationMetrics: Object.freeze([
      Object.freeze({ metricId: 'sharpe_ratio_net', version: 'v1' }),
      Object.freeze({ metricId: 'max_drawdown', version: 'v1' }),
    ]),
    statisticalTests: Object.freeze([
      Object.freeze({ testId: 'psr', version: 'v1', alpha: '0.05' }),
      Object.freeze({ testId: 'spa_reality_check', version: 'v1', alpha: '0.10' }),
    ]),
    promotionThresholds: Object.freeze([
      Object.freeze({ gateId: 'forward_shadow_min_days', thresholdDigest: digestRuleContent({ minDays: 30 }) }),
    ]),
  });
}

export function buildSampleFrozenHypothesis(statement: string): FrozenHypothesis {
  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    statement,
    primaryMetricId: 'sharpe_ratio_net',
    falsificationCriteriaDigest: digestRuleContent({ minTrackRecordDays: 30, maxDrawdownBps: 1500 }),
  });
}

export function buildSampleFrozenBenchmarkPolicy(): FrozenBenchmarkPolicy {
  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    benchmarkId: 'CASH_NO_ACTION',
    benchmarkVersion: 'v1',
    comparisonPolicyDigest: digestRuleContent({ relativeTo: 'CASH_NO_ACTION', horizonDays: 30 }),
  });
}

export function buildSampleFrozenCostPolicy(): FrozenCostPolicy {
  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    costModelId: 'helios.execution_twin.fixture_cost',
    costModelVersion: 'v1',
    assumptionsDigest: digestRuleContent({ feeBps: 5, slippageBps: 8 }),
  });
}

export function buildSampleFrozenSizingPolicy(): FrozenSizingPolicy {
  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    sizingCatalogRef: 'sizing.volatility_target_exposure',
    sizingPolicyDigest: digestRuleContent({ targetVolBps: 800 }),
  });
}

export function buildSampleFrozenAdaptationPolicy(onlineLearningPermitted: boolean): FrozenAdaptationPolicy {
  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA,
    onlineLearningPermitted,
    permittedRules: onlineLearningPermitted
      ? Object.freeze([
          Object.freeze({
            ruleId: 'rule_online_vol_target_recalibration',
            kind: 'VOL_TARGET_RECALIBRATION' as const,
            parameterPaths: Object.freeze(['parameters.targetVolBps']),
            triggerDigest: digestRuleContent({ realizedVolLookbackDays: 20 }),
            maxStepDigest: digestRuleContent({ maxDeltaBps: 50 }),
          }),
        ])
      : Object.freeze([]),
    manualOverrideForbidden: true,
  });
}

export function sampleCampaignId(suffix: string): ForwardCampaignId {
  return `fcamp_alpha02_${suffix}` as ForwardCampaignId;
}

export type SampleSealBundle = {
  readonly campaignId: ForwardCampaignId;
  readonly strategyId: string;
  readonly manifest: FrozenStrategyManifest;
  readonly hypothesis: FrozenHypothesis;
  readonly benchmarkPolicy: FrozenBenchmarkPolicy;
  readonly costPolicy: FrozenCostPolicy;
  readonly sizingPolicy: FrozenSizingPolicy;
  readonly adaptationPolicy: FrozenAdaptationPolicy;
  readonly sealedAt: UtcInstant;
};
