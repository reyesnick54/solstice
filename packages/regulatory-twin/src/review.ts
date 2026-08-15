import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { asReadinessReviewId } from './ids.ts';
import { refuseAiLegalStatus, type RegulatoryAccessFailure } from './access.ts';
import type { ReadinessDisposition } from './taxonomy.ts';
import type { ReadinessReviewRecord, RegulatoryProductReadiness } from './types.ts';

export function disposeReadiness(input: {
  readonly assessment: RegulatoryProductReadiness;
  readonly disposition: ReadinessDisposition;
  readonly actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI';
  readonly decidedByRef: string;
  readonly decidedAt: UtcInstant;
  readonly notes: string;
}): Result<ReadinessReviewRecord, RegulatoryAccessFailure> {
  const allowed = refuseAiLegalStatus(input.actorKind);
  if (!allowed.ok) {
    return err(allowed.error);
  }
  return ok(
    Object.freeze({
      reviewId: asReadinessReviewId(`rrv_${randomUUID().replaceAll('-', '')}`),
      assessmentId: input.assessment.assessmentId,
      disposition: input.disposition,
      decidedByKind: 'HUMAN_OPERATOR',
      decidedByRef: input.decidedByRef,
      decidedAt: input.decidedAt,
      notes: input.notes,
      legalStatusUnchanged: true,
    }),
  );
}
