import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  OverrideClass,
  PolicySnapshot,
  ReviewActorKind,
  ReviewCaseStatus,
} from './types.ts';

export type ManualReviewCase = {
  readonly reviewId: string;
  readonly status: ReviewCaseStatus;
  readonly reasonCodes: readonly string[];
  readonly snapshot: PolicySnapshot;
  readonly factsHash: string;
  readonly overrideClass: OverrideClass;
  readonly createdAt: UtcInstant;
  readonly assignedTo?: string;
  readonly decidedAt?: UtcInstant;
  readonly decidedBy?: {
    readonly kind: ReviewActorKind;
    readonly actorId: string;
  };
  readonly decisionNote?: string;
};

export type ReviewDecisionInput = {
  readonly reviewId: string;
  readonly status: 'APPROVED' | 'DECLINED' | 'EXPIRED';
  readonly decidedAt: UtcInstant;
  readonly decidedBy: {
    readonly kind: ReviewActorKind;
    readonly actorId: string;
  };
  readonly note?: string;
};

export type ReviewDecisionResult =
  | { readonly ok: true; readonly review: ManualReviewCase }
  | {
      readonly ok: false;
      readonly reasonCode: 'REVIEW_REQUIRES_HUMAN_OPERATOR' | 'HARD_BLOCK_NOT_OVERRIDABLE' | 'REVIEW_NOT_FOUND' | 'REVIEW_ALREADY_DECIDED';
    };

export class ManualReviewRegistry {
  private readonly cases = new Map<string, ManualReviewCase>();

  hydrate(rows: readonly ManualReviewCase[]): void {
    for (const row of rows) {
      this.cases.set(row.reviewId, Object.freeze({ ...row }));
    }
  }

  open(input: {
    readonly reasonCodes: readonly string[];
    readonly snapshot: PolicySnapshot;
    readonly factsHash: string;
    readonly overrideClass: OverrideClass;
    readonly createdAt: UtcInstant;
  }): ManualReviewCase {
    const review: ManualReviewCase = Object.freeze({
      reviewId: randomUUID(),
      status: 'OPEN',
      reasonCodes: Object.freeze([...input.reasonCodes]),
      snapshot: input.snapshot,
      factsHash: input.factsHash,
      overrideClass: input.overrideClass,
      createdAt: input.createdAt,
    });
    this.cases.set(review.reviewId, review);
    return review;
  }

  assign(reviewId: string, operatorId: string): ManualReviewCase | undefined {
    const current = this.cases.get(reviewId);
    if (!current || current.status !== 'OPEN') {
      return undefined;
    }
    const next: ManualReviewCase = Object.freeze({
      ...current,
      status: 'ASSIGNED',
      assignedTo: operatorId,
    });
    this.cases.set(reviewId, next);
    return next;
  }

  /**
   * Human/operator decision only. An AI or agent cannot approve.
   * Approval never issues Execution Authority and never overrides HARD_BLOCK.
   */
  decide(input: ReviewDecisionInput): ReviewDecisionResult {
    const current = this.cases.get(input.reviewId);
    if (!current) {
      return { ok: false, reasonCode: 'REVIEW_NOT_FOUND' };
    }
    if (current.status === 'APPROVED' || current.status === 'DECLINED' || current.status === 'EXPIRED') {
      return { ok: false, reasonCode: 'REVIEW_ALREADY_DECIDED' };
    }
    if (input.decidedBy.kind !== 'HUMAN_OPERATOR') {
      return { ok: false, reasonCode: 'REVIEW_REQUIRES_HUMAN_OPERATOR' };
    }
    if (input.status === 'APPROVED' && current.overrideClass === 'HARD_BLOCK') {
      return { ok: false, reasonCode: 'HARD_BLOCK_NOT_OVERRIDABLE' };
    }
    const next: ManualReviewCase = Object.freeze({
      ...current,
      status: input.status,
      decidedAt: input.decidedAt,
      decidedBy: Object.freeze({ ...input.decidedBy }),
      ...(input.note ? { decisionNote: input.note } : {}),
    });
    this.cases.set(input.reviewId, next);
    return { ok: true, review: next };
  }

  get(reviewId: string): ManualReviewCase | undefined {
    return this.cases.get(reviewId);
  }

  list(): readonly ManualReviewCase[] {
    return [...this.cases.values()];
  }
}
