import type { SecurityException } from './types.ts';

export function createSecurityException(input: {
  readonly exception_id: string;
  readonly scope: string;
  readonly reason: string;
  readonly owner: string;
  readonly expirationOrReviewDate: string;
  readonly mitigation: string;
  readonly humanApprovalReference: string;
}): SecurityException {
  if (!input.humanApprovalReference.trim()) {
    throw new Error('SecurityException requires a human approval reference');
  }
  if (!input.owner.trim() || !input.scope.trim() || !input.reason.trim()) {
    throw new Error('SecurityException requires scope, reason, and owner');
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.expirationOrReviewDate)) {
    throw new Error('SecurityException requires an expiration or review date');
  }
  return Object.freeze({
    exception_id: input.exception_id,
    scope: input.scope,
    reason: input.reason,
    owner: input.owner,
    expirationOrReviewDate: input.expirationOrReviewDate,
    mitigation: input.mitigation,
    humanApprovalReference: input.humanApprovalReference,
    grantedAutomatically: false,
  });
}

export function grantExceptionAutomatically(): never {
  throw new Error('Security exceptions are not granted automatically');
}

export const SECURITY_EXCEPTIONS: readonly SecurityException[] = Object.freeze([]);
