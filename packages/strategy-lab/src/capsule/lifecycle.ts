import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { StrategyCapsuleFailure, StrategyCapsuleQualificationState } from './types.ts';

export const LEGAL_CAPSULE_QUALIFICATION_TRANSITIONS: Readonly<
  Record<StrategyCapsuleQualificationState, readonly StrategyCapsuleQualificationState[]>
> = Object.freeze({
  DRAFT: Object.freeze(['RESEARCH_ONLY', 'EVALUATION_PENDING', 'REVOKED'] as const),
  RESEARCH_ONLY: Object.freeze(['EVALUATION_PENDING', 'REVOKED'] as const),
  EVALUATION_PENDING: Object.freeze(['EVALUATING', 'REVOKED'] as const),
  EVALUATING: Object.freeze(['EVALUATION_FAILED', 'SHADOW_ELIGIBLE', 'REVIEW_REQUIRED', 'REVOKED'] as const),
  EVALUATION_FAILED: Object.freeze(['EVALUATION_PENDING', 'REVOKED'] as const),
  SHADOW_ELIGIBLE: Object.freeze(['SHADOW_ACTIVE', 'REVIEW_REQUIRED', 'REVOKED', 'EXPIRED'] as const),
  SHADOW_ACTIVE: Object.freeze(['SHADOW_ELIGIBLE', 'PAUSED', 'PAPER_ELIGIBLE', 'REVIEW_REQUIRED', 'REVOKED', 'EXPIRED'] as const),
  PAPER_ELIGIBLE: Object.freeze(['PAPER_ACTIVE', 'REVIEW_REQUIRED', 'REVOKED', 'EXPIRED'] as const),
  PAPER_ACTIVE: Object.freeze(['PAUSED', 'PAPER_ELIGIBLE', 'REVOKED', 'EXPIRED'] as const),
  PAUSED: Object.freeze(['PAPER_ELIGIBLE', 'PAPER_ACTIVE', 'REVOKED', 'EXPIRED'] as const),
  REVIEW_REQUIRED: Object.freeze(['EVALUATION_PENDING', 'SHADOW_ELIGIBLE', 'PAPER_ELIGIBLE', 'REVOKED', 'EXPIRED'] as const),
  EXPIRED: Object.freeze(['REVIEW_REQUIRED', 'REVOKED'] as const),
  REVOKED: Object.freeze([] as const),
});

export function transitionCapsuleQualification(
  from: StrategyCapsuleQualificationState,
  to: StrategyCapsuleQualificationState,
): Result<StrategyCapsuleQualificationState, StrategyCapsuleFailure> {
  if (from === to) {
    return ok(from);
  }
  if (from === 'REVOKED') {
    return err({ code: 'REVOKED', message: 'revoked capsules cannot change qualification state' });
  }
  if (!LEGAL_CAPSULE_QUALIFICATION_TRANSITIONS[from].includes(to)) {
    return err({
      code: 'INVALID_TRANSITION',
      message: `cannot move capsule qualification ${from} to ${to}`,
    });
  }
  return ok(to);
}

export function canActivateCapsule(state: StrategyCapsuleQualificationState): boolean {
  return state === 'SHADOW_ACTIVE' || state === 'PAPER_ACTIVE';
}

export function canPromoteCapsule(state: StrategyCapsuleQualificationState): boolean {
  if (state === 'REVOKED' || state === 'EXPIRED') {
    return false;
  }
  if (state === 'REVIEW_REQUIRED') {
    return false;
  }
  return true;
}

export function requiresReviewBeforePromotion(state: StrategyCapsuleQualificationState): boolean {
  return state === 'EXPIRED' || state === 'REVIEW_REQUIRED';
}
