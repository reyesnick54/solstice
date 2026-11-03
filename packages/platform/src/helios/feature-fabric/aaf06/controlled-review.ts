import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { CoverageBiasAssessment, CoverageBiasSeverity } from './coverage-bias-types.ts';

export type CoverageBiasControlledReviewState = {
  readonly reviewId: string;
  readonly assessmentId: string;
  readonly reviewerRef: string;
  readonly reviewedAt: UtcInstant;
  readonly evidenceRef: string;
  readonly severeBiasExplicitlyReviewed: true;
};

export function severeCoverageBiasRequiresControlledReview(severity: CoverageBiasSeverity): boolean {
  return severity === 'SEVERE';
}

export function isControlledReviewValidForAssessment(
  review: CoverageBiasControlledReviewState | null | undefined,
  assessment: CoverageBiasAssessment,
): boolean {
  if (!review) {
    return false;
  }
  return (
    review.assessmentId === assessment.assessmentId && review.severeBiasExplicitlyReviewed === true
  );
}

/** No model or agent may bypass SEVERE without an explicit controlled review record. */
export function canBypassSevereCoverageBias(
  assessment: CoverageBiasAssessment,
  review: CoverageBiasControlledReviewState | null | undefined,
): boolean {
  if (assessment.severity !== 'SEVERE') {
    return true;
  }
  return isControlledReviewValidForAssessment(review, assessment);
}
