/**
 * Strategy Lab promotion gate for AAF06 coverage-bias assessments.
 * Accepts a portable assessment summary — Strategy Lab does not import platform.
 */

export type StrategyLabCoverageBiasSeverity = 'PASS' | 'WARNING' | 'SEVERE' | 'INSUFFICIENT_DATA';

export type StrategyLabCoverageBiasAssessmentRef = {
  readonly assessmentId: string;
  readonly severity: StrategyLabCoverageBiasSeverity;
};

export type StrategyLabCoverageBiasReviewRef = {
  readonly assessmentId: string;
  readonly severeBiasExplicitlyReviewed: true;
};

export type StrategyLabCoverageBiasPromotionPolicy = {
  readonly requirePass: boolean;
  readonly allowWarningWithExplicitReview: boolean;
};

export type StrategyLabCoverageBiasGateResult = {
  readonly permitted: boolean;
  readonly blockers: readonly string[];
};

export function gatePromotionOnCoverageBias(input: {
  readonly assessment: StrategyLabCoverageBiasAssessmentRef;
  readonly policy: StrategyLabCoverageBiasPromotionPolicy;
  readonly warningReview?: StrategyLabCoverageBiasReviewRef | null;
  readonly severeReview?: StrategyLabCoverageBiasReviewRef | null;
}): StrategyLabCoverageBiasGateResult {
  const blockers: string[] = [];
  const severity = input.assessment.severity;

  if (severity === 'INSUFFICIENT_DATA') {
    blockers.push('coverage_bias_insufficient_data');
  }
  if (input.policy.requirePass && severity !== 'PASS') {
    blockers.push('coverage_bias_require_pass');
  }
  if (severity === 'WARNING') {
    if (input.policy.allowWarningWithExplicitReview) {
      const review = input.warningReview ?? input.severeReview;
      if (!review || review.assessmentId !== input.assessment.assessmentId) {
        blockers.push('coverage_bias_warning_requires_explicit_review');
      }
    } else if (!input.policy.requirePass) {
      blockers.push('coverage_bias_warning_not_permitted');
    }
  }
  if (severity === 'SEVERE') {
    const review = input.severeReview;
    if (!review || review.assessmentId !== input.assessment.assessmentId) {
      blockers.push('coverage_bias_severe_requires_controlled_review');
    }
  }

  return Object.freeze({
    permitted: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
