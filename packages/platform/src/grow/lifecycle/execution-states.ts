import type { GrowExecutionState } from '../taxonomy.ts';
import type { CanonicalExecutionLifecycleState } from './taxonomy.ts';

export const CANONICAL_TO_GROW_EXECUTION: Readonly<Record<CanonicalExecutionLifecycleState, GrowExecutionState | null>> =
  Object.freeze({
    PROPOSED: 'QUEUED',
    REVIEWED: 'QUEUED',
    AUTHORIZED: 'AUTHORIZED',
    SUBMITTED: 'SUBMITTED',
    PENDING: 'PROCESSING',
    PARTIALLY_FILLED: 'PARTIALLY_COMPLETED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    REJECTED: 'FAILED',
    EXPIRED: 'FAILED',
  });

export function mapCanonicalExecutionState(state: CanonicalExecutionLifecycleState): GrowExecutionState {
  const mapped = CANONICAL_TO_GROW_EXECUTION[state];
  if (!mapped) {
    return 'REQUIRES_REVIEW';
  }
  return mapped;
}

export function submittedIsNotCompleted(state: GrowExecutionState): boolean {
  return state === 'SUBMITTED' || state === 'PROCESSING' || state === 'QUEUED' || state === 'AUTHORIZED';
}

export function providerConfirmedState(state: GrowExecutionState): boolean {
  return state === 'COMPLETED' || state === 'PARTIALLY_COMPLETED';
}
