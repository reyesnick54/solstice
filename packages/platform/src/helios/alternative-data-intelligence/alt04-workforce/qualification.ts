import {
  HELIOS_ALT04_WORKFORCE_INTELLIGENCE_BLOCKED,
  HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED,
  WORKFORCE_RESEARCH_PREDICTION_TARGETS,
  WORKFORCE_SKILL_BUCKETS,
} from './taxonomy.ts';

export type Alt04QualificationChecks = {
  readonly coreTypesDefined: boolean;
  readonly wave6BridgeExtendsNotDuplicates: boolean;
  readonly interpretationLayerSeparate: boolean;
  readonly postingGrowthNotUniversallyBullish: boolean;
  readonly motiveEstimatesAvoidCertainty: boolean;
  readonly coveragePreservesRawAndAdjusted: boolean;
  readonly predictionTargetsExcludePrimaryStockReturn: boolean;
  readonly knowableAtEnforced: boolean;
  readonly noExecutionAuthorityOnArtifacts: boolean;
  readonly skillTaxonomyComplete: boolean;
};

export type Alt04QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_ALT04_WORKFORCE_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt04WorkforceQualification(checks: Alt04QualificationChecks): Alt04QualificationResult {
  const blockers: string[] = [];
  if (!checks.coreTypesDefined) blockers.push('core_types');
  if (!checks.wave6BridgeExtendsNotDuplicates) blockers.push('wave6_extension');
  if (!checks.interpretationLayerSeparate) blockers.push('interpretation_layer');
  if (!checks.postingGrowthNotUniversallyBullish) blockers.push('bullish_bias_guard');
  if (!checks.motiveEstimatesAvoidCertainty) blockers.push('motive_certainty');
  if (!checks.coveragePreservesRawAndAdjusted) blockers.push('coverage_raw_adjusted');
  if (!checks.predictionTargetsExcludePrimaryStockReturn) blockers.push('prediction_targets');
  if (!checks.knowableAtEnforced) blockers.push('knowable_at');
  if (!checks.noExecutionAuthorityOnArtifacts) blockers.push('execution_authority');
  if (!checks.skillTaxonomyComplete) blockers.push('skill_taxonomy');
  if (WORKFORCE_SKILL_BUCKETS.length !== 12) blockers.push('skill_bucket_count');
  if (!WORKFORCE_RESEARCH_PREDICTION_TARGETS.includes('future_revenue_growth')) {
    blockers.push('research_targets');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED : HELIOS_ALT04_WORKFORCE_INTELLIGENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
