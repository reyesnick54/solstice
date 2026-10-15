import type { CoverageBiasAssessment, CoverageBiasSeverity } from './coverage-bias-types.ts';
import {
  canBypassSevereCoverageBias,
  type CoverageBiasControlledReviewState,
} from './controlled-review.ts';

export type CoverageBiasPromotionPolicy = {
  readonly policyId: string;
  readonly requirePass: boolean;
  readonly allowWarningWithExplicitReview: boolean;
};

export type CoverageBiasPromotionGateResult = {
  readonly permitted: boolean;
  readonly blockers: readonly string[];
  readonly assessmentSeverity: CoverageBiasSeverity;
};

export function evaluateCoverageBiasPromotionGate(input: {
  readonly assessment: CoverageBiasAssessment;
  readonly policy: CoverageBiasPromotionPolicy;
  readonly warningReview?: CoverageBiasControlledReviewState | null;
  readonly severeReview?: CoverageBiasControlledReviewState | null;
}): CoverageBiasPromotionGateResult {
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

  if (!canBypassSevereCoverageBias(input.assessment, input.severeReview ?? null)) {
    blockers.push('coverage_bias_severe_requires_controlled_review');
  }

  return Object.freeze({
    permitted: blockers.length === 0,
    blockers: Object.freeze(blockers),
    assessmentSeverity: severity,
  });
}

export const DEFAULT_COVERAGE_BIAS_PROMOTION_POLICY: CoverageBiasPromotionPolicy = Object.freeze({
  policyId: 'aaf06-coverage-bias-promotion-v1',
  requirePass: false,
  allowWarningWithExplicitReview: true,
});
