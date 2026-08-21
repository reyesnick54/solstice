import type { IdentityVerificationClientState, IdentityVerificationState } from './types.ts';

export function toIdentityVerificationClientState(
  state: IdentityVerificationState | string | null | undefined,
): IdentityVerificationClientState {
  if (state === 'VERIFIED') return 'VERIFIED';
  if (state === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (state === 'REQUIRES_REVIEW') return 'REVIEW';
  if (state === 'FAILED' || state === 'EXPIRED') return 'ACTION_REQUIRED';
  return 'NOT_STARTED';
}

export function clientStateOmitsInternalIntelligence(): true {
  return true;
}
