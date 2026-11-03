/**
 * OS14 qualification gate — research / paper / simulation only.
 */

export const HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED =
  'HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED' as const;
export const HELIOS_OS14_PREDICTION_MARKET_RESEARCH_BLOCKED =
  'HELIOS_OS14_PREDICTION_MARKET_RESEARCH_BLOCKED' as const;

export type Os14PredictionMarketQualificationChecks = {
  readonly pairedYesNoBookNormalization: boolean;
  readonly impliedMarketProbabilitySemantics: boolean;
  readonly microstructureMetricsPresent: boolean;
  readonly crossOutcomeConsistencyEvaluated: boolean;
  readonly feeAdjustedEdgeResearch: boolean;
  readonly observationFabricIntegration: boolean;
  readonly featureFabricIntegration: boolean;
  readonly entityResolutionBindings: boolean;
  readonly evidenceVaultSealing: boolean;
  readonly strategyLabBridge: boolean;
  readonly noLiveWageringPath: boolean;
  readonly upstreamAttributionRecorded: boolean;
  readonly persistenceRoundTrip: boolean;
};

export type Os14PredictionMarketQualificationResult = {
  readonly marker:
    | typeof HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED
    | typeof HELIOS_OS14_PREDICTION_MARKET_RESEARCH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateOs14PredictionMarketQualification(
  checks: Os14PredictionMarketQualificationChecks,
): Os14PredictionMarketQualificationResult {
  const blockers: string[] = [];
  if (!checks.pairedYesNoBookNormalization) blockers.push('paired_yes_no_book');
  if (!checks.impliedMarketProbabilitySemantics) blockers.push('implied_market_probability_semantics');
  if (!checks.microstructureMetricsPresent) blockers.push('microstructure_metrics');
  if (!checks.crossOutcomeConsistencyEvaluated) blockers.push('cross_outcome_consistency');
  if (!checks.feeAdjustedEdgeResearch) blockers.push('fee_adjusted_edge');
  if (!checks.observationFabricIntegration) blockers.push('observation_fabric');
  if (!checks.featureFabricIntegration) blockers.push('feature_fabric');
  if (!checks.entityResolutionBindings) blockers.push('entity_resolution');
  if (!checks.evidenceVaultSealing) blockers.push('evidence_vault');
  if (!checks.strategyLabBridge) blockers.push('strategy_lab_bridge');
  if (!checks.noLiveWageringPath) blockers.push('live_wagering_forbidden');
  if (!checks.upstreamAttributionRecorded) blockers.push('upstream_attribution');
  if (!checks.persistenceRoundTrip) blockers.push('persistence_round_trip');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED
      : HELIOS_OS14_PREDICTION_MARKET_RESEARCH_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
