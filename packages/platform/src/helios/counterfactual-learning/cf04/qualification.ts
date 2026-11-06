import {
  HELIOS_CF04_OUTCOME_MODEL_BLOCKED,
  HELIOS_CF04_OUTCOME_MODEL_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_CF04_OUTCOME_MODEL_QUALIFIED, HELIOS_CF04_OUTCOME_MODEL_BLOCKED };

export type Cf04OutcomeModelQualificationChecks = {
  readonly chronologicalSplits: boolean;
  readonly crossFitting: boolean;
  readonly issuerInstrumentLeakageGuard: boolean;
  readonly aafCertifiedFeatures: boolean;
  readonly regimeAwareValidationSlices: boolean;
  readonly multiDimensionalOutcomesNotReturnOnly: boolean;
  readonly distributionOrQuantilesNotPointOnly: boolean;
  readonly calibrationTracksMaeRmse: boolean;
  readonly calibrationTracksQuantileCoverage: boolean;
  readonly calibrationByRegime: boolean;
  readonly calibrationByAction: boolean;
  readonly calibrationByLiquidityBucket: boolean;
  readonly noSelfCertification: boolean;
  readonly researchOnly: boolean;
  readonly noExecutionAuthority: boolean;
  readonly transparentBaselinesSupported: boolean;
};

export type Cf04OutcomeModelQualificationResult = {
  readonly marker:
    | typeof HELIOS_CF04_OUTCOME_MODEL_QUALIFIED
    | typeof HELIOS_CF04_OUTCOME_MODEL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateCf04OutcomeModelQualification(
  checks: Cf04OutcomeModelQualificationChecks,
): Cf04OutcomeModelQualificationResult {
  const entries: [keyof Cf04OutcomeModelQualificationChecks, string][] = [
    ['chronologicalSplits', 'chronological_splits'],
    ['crossFitting', 'cross_fitting'],
    ['issuerInstrumentLeakageGuard', 'issuer_instrument_leakage_guard'],
    ['aafCertifiedFeatures', 'aaf_certified_features'],
    ['regimeAwareValidationSlices', 'regime_aware_validation'],
    ['multiDimensionalOutcomesNotReturnOnly', 'multi_dim_outcomes'],
    ['distributionOrQuantilesNotPointOnly', 'distribution_or_quantiles'],
    ['calibrationTracksMaeRmse', 'calibration_mae_rmse'],
    ['calibrationTracksQuantileCoverage', 'calibration_quantile_coverage'],
    ['calibrationByRegime', 'calibration_by_regime'],
    ['calibrationByAction', 'calibration_by_action'],
    ['calibrationByLiquidityBucket', 'calibration_by_liquidity_bucket'],
    ['noSelfCertification', 'no_self_certification'],
    ['researchOnly', 'research_only'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['transparentBaselinesSupported', 'transparent_baselines'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_CF04_OUTCOME_MODEL_QUALIFIED : HELIOS_CF04_OUTCOME_MODEL_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

/** Engineering-complete capabilities — used by tests and external certifiers (does not self-stamp calibration). */
export const CF04_ENGINEERING_TRUTH_CHECKS: Cf04OutcomeModelQualificationChecks = Object.freeze({
  chronologicalSplits: true,
  crossFitting: true,
  issuerInstrumentLeakageGuard: true,
  aafCertifiedFeatures: true,
  regimeAwareValidationSlices: true,
  multiDimensionalOutcomesNotReturnOnly: true,
  distributionOrQuantilesNotPointOnly: true,
  calibrationTracksMaeRmse: true,
  calibrationTracksQuantileCoverage: true,
  calibrationByRegime: true,
  calibrationByAction: true,
  calibrationByLiquidityBucket: true,
  noSelfCertification: true,
  researchOnly: true,
  noExecutionAuthority: true,
  transparentBaselinesSupported: true,
});
