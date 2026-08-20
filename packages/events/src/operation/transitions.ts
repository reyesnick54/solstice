import {
  freezeOperation,
  isTerminalOperationState,
  type OperationExecutionRecord,
  type OperationState,
} from './types.ts';

/**
 * Generic monotonic ranks. Domain owners supply their own maps for
 * provider-status vocabularies. A coordinator must not guess those.
 */
export const OPERATION_STATE_RANK: Readonly<Record<OperationState, number>> = Object.freeze({
  PREPARED: 10,
  DISPATCHING: 20,
  SUBMITTED: 30,
  SUBMISSION_UNKNOWN: 35,
  RECONCILIATION_REQUIRED: 40,
  COMPENSATION_REQUIRED: 50,
  REJECTED_FINAL: 80,
  CONFIRMED: 90,
  COMPENSATED: 95,
});

export type DomainTransitionFn<S extends string> = (
  current: S,
  incoming: S,
) => { readonly next: S; readonly applied: boolean; readonly reason: string };

export function applyMonotonicState<S extends string>(
  current: S,
  incoming: S,
  rank: Readonly<Record<S, number>>,
): { readonly next: S; readonly applied: boolean; readonly reason: string } {
  const currentRank = rank[current];
  const incomingRank = rank[incoming];
  if (currentRank === undefined || incomingRank === undefined) {
    return { next: current, applied: false, reason: 'UNKNOWN_DOMAIN_STATE' };
  }
  if (incomingRank < currentRank) {
    return { next: current, applied: false, reason: 'LATE_STATUS_DOES_NOT_REGRESS' };
  }
  if (incoming === current) {
    return { next: current, applied: false, reason: 'IDEMPOTENT' };
  }
  return { next: incoming, applied: true, reason: 'APPLIED' };
}

export function applyOperationTransition(
  record: OperationExecutionRecord,
  incoming: OperationState,
  now: string,
  patch: Partial<
    Pick<
      OperationExecutionRecord,
      | 'providerOperationRef'
      | 'firstSubmittedAt'
      | 'confirmedAt'
      | 'lastSafeErrorCode'
      | 'lastSafeErrorMessage'
      | 'attemptCount'
    >
  > = {},
): { readonly record: OperationExecutionRecord; readonly applied: boolean; readonly reason: string } {
  if (isTerminalOperationState(record.state) && incoming !== record.state) {
    const incomingRank = OPERATION_STATE_RANK[incoming];
    const currentRank = OPERATION_STATE_RANK[record.state];
    if (incomingRank < currentRank) {
      return {
        record,
        applied: false,
        reason: 'LATE_STATUS_DOES_NOT_REGRESS',
      };
    }
  }
  const decision = applyMonotonicState(record.state, incoming, OPERATION_STATE_RANK);
  if (!decision.applied) {
    return { record, applied: false, reason: decision.reason };
  }
  const next = freezeOperation({
    ...record,
    state: decision.next,
    lastObservedAt: now,
    providerOperationRef: patch.providerOperationRef ?? record.providerOperationRef,
    firstSubmittedAt: patch.firstSubmittedAt ?? record.firstSubmittedAt,
    confirmedAt:
      decision.next === 'CONFIRMED' ? (patch.confirmedAt ?? now) : (patch.confirmedAt ?? record.confirmedAt),
    lastSafeErrorCode: patch.lastSafeErrorCode ?? record.lastSafeErrorCode,
    lastSafeErrorMessage: patch.lastSafeErrorMessage ?? record.lastSafeErrorMessage,
    attemptCount: patch.attemptCount ?? record.attemptCount,
  });
  return { record: next, applied: true, reason: decision.reason };
}

export function requiresQueryBeforeSubmit(record: OperationExecutionRecord): boolean {
  return (
    record.state === 'DISPATCHING' ||
    record.state === 'SUBMITTED' ||
    record.state === 'SUBMISSION_UNKNOWN' ||
    record.state === 'RECONCILIATION_REQUIRED' ||
    record.firstSubmittedAt !== null
  );
}

export function mayMarkConfirmed(hasAuthoritativeEvidence: boolean): boolean {
  return hasAuthoritativeEvidence;
}
