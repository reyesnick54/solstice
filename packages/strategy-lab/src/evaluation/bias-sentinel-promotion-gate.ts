/**
 * Strategy Lab promotion gate for AAFV2.5 bias sentinel assessments.
 */

export type StrategyLabBiasSeverity = 'PASS' | 'WARNING' | 'SEVERE' | 'INSUFFICIENT_DATA';

export type StrategyLabBiasAssessmentRef = {
  readonly assessmentId: string;
  readonly severity: StrategyLabBiasSeverity;
};

export type StrategyLabBiasPromotionPolicy = {
  readonly blockOnSevere: boolean;
  readonly requireReviewOnWarning: boolean;
  readonly blockOnInsufficientData: boolean;
};

export type StrategyLabBiasGateResult = {
  readonly permitted: boolean;
  readonly blockers: readonly string[];
};

export function gatePromotionOnBiasSentinel(input: {
  readonly assessment: StrategyLabBiasAssessmentRef;
  readonly policy: StrategyLabBiasPromotionPolicy;
  readonly explicitReviewRecorded?: boolean;
}): StrategyLabBiasGateResult {
  const blockers: string[] = [];
  const severity = input.assessment.severity;

  if (severity === 'INSUFFICIENT_DATA' && input.policy.blockOnInsufficientData) {
    blockers.push('bias_sentinel_insufficient_data');
  }
  if (severity === 'WARNING' && input.policy.requireReviewOnWarning && !input.explicitReviewRecorded) {
    blockers.push('bias_sentinel_warning_requires_review');
  }
  if (severity === 'SEVERE' && input.policy.blockOnSevere) {
    blockers.push('bias_sentinel_severe_blocks_promotion');
  }

  return Object.freeze({
    permitted: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
