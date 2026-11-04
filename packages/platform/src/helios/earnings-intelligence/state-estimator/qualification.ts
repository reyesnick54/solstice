/**
 * EARN09 qualification — HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED
 */

import {
  HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_BLOCKED,
  HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED, HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_BLOCKED };

export type Earn09StateEstimatorQualificationChecks = {
  readonly hierarchicalMixturePresent: boolean;
  readonly eightExpertsSupported: boolean;
  readonly robustBmaBaseline: boolean;
  readonly gatingVariablesApplied: boolean;
  readonly reliabilityPostOutcomeOnly: boolean;
  readonly studentTHeavyTails: boolean;
  readonly conformalIntervalsPresent: boolean;
  readonly calibrationMetricsTracked: boolean;
  readonly evidenceContributionsNonCausal: boolean;
  readonly returnDistributionsResearchOnly: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Earn09StateEstimatorQualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED
    | typeof HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEarn09StateEstimatorQualification(
  checks: Earn09StateEstimatorQualificationChecks,
): Earn09StateEstimatorQualificationResult {
  const entries: [keyof Earn09StateEstimatorQualificationChecks, string][] = [
    ['hierarchicalMixturePresent', 'hierarchical_mixture'],
    ['eightExpertsSupported', 'eight_experts'],
    ['robustBmaBaseline', 'robust_bma'],
    ['gatingVariablesApplied', 'gating_variables'],
    ['reliabilityPostOutcomeOnly', 'reliability_post_outcome'],
    ['studentTHeavyTails', 'student_t'],
    ['conformalIntervalsPresent', 'conformal_intervals'],
    ['calibrationMetricsTracked', 'calibration_metrics'],
    ['evidenceContributionsNonCausal', 'evidence_contributions'],
    ['returnDistributionsResearchOnly', 'return_distributions_research_only'],
    ['noExecutionAuthority', 'no_execution_authority'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED
      : HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
