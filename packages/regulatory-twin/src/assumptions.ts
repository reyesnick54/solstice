import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { LegalReviewStatus } from '../../kernel/src/policy/index.ts';
import { asRegulatoryAssumptionId } from './ids.ts';
import type { RegulatoryAssumption } from './types.ts';

export type AssumptionFailure = {
  readonly code:
    | 'SOURCE_ABSENT'
    | 'AUTO_PROMOTE_FORBIDDEN'
    | 'CONFIRMED_BY_COUNSEL_FORBIDDEN'
    | 'AI_CANNOT_SET_LEGAL_STATUS'
    | 'SUPERSEDE_REQUIRED';
  readonly message: string;
};

export function createAssumption(input: {
  readonly jurisdiction: string;
  readonly subject: string;
  readonly proposition: string;
  readonly sourceReferences: readonly string[];
  readonly createdAt: UtcInstant;
  readonly ownerRef: string;
}): Result<RegulatoryAssumption, AssumptionFailure> {
  if (input.sourceReferences.length === 0) {
    return ok(
      Object.freeze({
        assumptionId: asRegulatoryAssumptionId(`ras_${randomUUID().replaceAll('-', '')}`),
        jurisdiction: input.jurisdiction,
        subject: input.subject,
        proposition: input.proposition,
        sourceReferences: Object.freeze([]),
        legalReviewStatus: 'RESEARCH_REQUIRED',
        createdAt: input.createdAt,
        ownerRef: input.ownerRef,
      }),
    );
  }
  return ok(
    Object.freeze({
      assumptionId: asRegulatoryAssumptionId(`ras_${randomUUID().replaceAll('-', '')}`),
      jurisdiction: input.jurisdiction,
      subject: input.subject,
      proposition: input.proposition,
      sourceReferences: Object.freeze([...input.sourceReferences]),
      legalReviewStatus: 'DRAFT',
      createdAt: input.createdAt,
      ownerRef: input.ownerRef,
    }),
  );
}

/**
 * Legal-review status never auto-promotes. CONFIRMED_BY_COUNSEL is refused
 * because this repository has no counsel confirmation evidence.
 */
export function changeAssumptionStatus(input: {
  readonly assumption: RegulatoryAssumption;
  readonly next: LegalReviewStatus;
  readonly actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI';
  readonly reviewerRef: string;
}): Result<RegulatoryAssumption, AssumptionFailure> {
  if (input.actorKind !== 'HUMAN_OPERATOR') {
    return err({
      code: 'AI_CANNOT_SET_LEGAL_STATUS',
      message: 'only a human operator may change legal-review status',
    });
  }
  if (input.next === 'CONFIRMED_BY_COUNSEL') {
    return err({
      code: 'CONFIRMED_BY_COUNSEL_FORBIDDEN',
      message: 'no counsel confirmation evidence exists in this repository',
    });
  }
  if (input.next === input.assumption.legalReviewStatus) {
    return ok(input.assumption);
  }
  return ok(
    Object.freeze({
      ...input.assumption,
      legalReviewStatus: input.next,
      reviewerRef: input.reviewerRef,
    }),
  );
}

export function supersedeAssumption(input: {
  readonly prior: RegulatoryAssumption;
  readonly replacement: RegulatoryAssumption;
}): RegulatoryAssumption {
  return Object.freeze({
    ...input.prior,
    supersededBy: input.replacement.assumptionId,
  });
}
