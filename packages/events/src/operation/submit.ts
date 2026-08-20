import { isIdempotencyConflict, type OperationStore } from './store.ts';
import { applyOperationTransition, requiresQueryBeforeSubmit } from './transitions.ts';
import {
  BLIND_RETRY_FORBIDDEN,
  IDEMPOTENCY_PAYLOAD_MISMATCH,
  QUERY_REQUIRED_BEFORE_RETRY,
  SimulatedCrash,
  freezeOperation,
  type CrashPoint,
  type OperationExecutionRecord,
  type PrepareDraft,
  type ProviderQueryOutcome,
  type ProviderSubmitOutcome,
} from './types.ts';

export type ExternalSubmitPorts = {
  readonly store: OperationStore;
  readonly now: () => string;
  readonly submit: () => Promise<ProviderSubmitOutcome>;
  readonly crashAt?: CrashPoint;
};

export type ExternalSubmitResult =
  | { readonly ok: true; readonly record: OperationExecutionRecord; readonly providerCalled: boolean }
  | {
      readonly ok: false;
      readonly code: string;
      readonly record?: OperationExecutionRecord;
      readonly providerCalled: boolean;
    };

function maybeCrash(point: CrashPoint, crashAt: CrashPoint | undefined): void {
  if (crashAt === point) {
    throw new SimulatedCrash(point);
  }
}

/**
 * PREPARED is committed before any provider call. The database transaction
 * is never held open across a bank, custodian, oracle, KYC, or Travel Rule
 * provider call.
 */
export async function prepareOperation(
  store: OperationStore,
  draft: PrepareDraft,
  crashAt?: CrashPoint,
): Promise<OperationExecutionRecord> {
  maybeCrash('BEFORE_PREPARED_COMMIT', crashAt);
  const prepared = await store.prepare(draft);
  if (isIdempotencyConflict(prepared)) {
    const error = new Error(IDEMPOTENCY_PAYLOAD_MISMATCH);
    error.name = IDEMPOTENCY_PAYLOAD_MISMATCH;
    throw error;
  }
  maybeCrash('AFTER_PREPARED_COMMIT', crashAt);
  return prepared;
}

export async function dispatchExternalSideEffect(
  record: OperationExecutionRecord,
  ports: ExternalSubmitPorts,
): Promise<ExternalSubmitResult> {
  if (requiresQueryBeforeSubmit(record)) {
    return {
      ok: false,
      code: QUERY_REQUIRED_BEFORE_RETRY,
      record,
      providerCalled: false,
    };
  }
  maybeCrash('BEFORE_PROVIDER_CALL', ports.crashAt);
  const dispatching = applyOperationTransition(record, 'DISPATCHING', ports.now(), {
    firstSubmittedAt: ports.now(),
    attemptCount: record.attemptCount + 1,
  });
  const inflight = await ports.store.update(dispatching.record);

  let outcome: ProviderSubmitOutcome;
  try {
    outcome = await ports.submit();
  } catch (error) {
    if (error instanceof SimulatedCrash) {
      throw error;
    }
    const unknown = applyOperationTransition(inflight, 'SUBMISSION_UNKNOWN', ports.now(), {
      lastSafeErrorCode: 'PROVIDER_CALL_FAILED',
      lastSafeErrorMessage: error instanceof Error ? error.message.slice(0, 200) : 'provider_call_failed',
    });
    return {
      ok: true,
      record: await ports.store.update(unknown.record),
      providerCalled: true,
    };
  }

  if (outcome.kind === 'ACCEPTED') {
    maybeCrash('AFTER_PROVIDER_SUCCESS_BEFORE_RESULT', ports.crashAt);
    const submitted = applyOperationTransition(inflight, 'SUBMITTED', ports.now(), {
      providerOperationRef: outcome.providerOperationRef,
    });
    const persisted = await ports.store.update(submitted.record);
    maybeCrash('AFTER_RESULT_BEFORE_OUTBOX', ports.crashAt);
    return { ok: true, record: persisted, providerCalled: true };
  }
  if (outcome.kind === 'REJECTED_FINAL') {
    maybeCrash('AFTER_PROVIDER_FAILURE_BEFORE_RESULT', ports.crashAt);
    const rejected = applyOperationTransition(inflight, 'REJECTED_FINAL', ports.now(), {
      lastSafeErrorCode: outcome.safeErrorCode,
      lastSafeErrorMessage: outcome.safeErrorMessage,
    });
    return { ok: true, record: await ports.store.update(rejected.record), providerCalled: true };
  }
  maybeCrash('AFTER_PROVIDER_FAILURE_BEFORE_RESULT', ports.crashAt);
  const unknown = applyOperationTransition(inflight, 'SUBMISSION_UNKNOWN', ports.now(), {
    providerOperationRef: outcome.providerOperationRef ?? inflight.providerOperationRef,
    lastSafeErrorCode: outcome.safeErrorCode,
    lastSafeErrorMessage: outcome.safeErrorMessage,
  });
  return { ok: true, record: await ports.store.update(unknown.record), providerCalled: true };
}

export async function refuseBlindRetry(
  record: OperationExecutionRecord,
): Promise<ExternalSubmitResult> {
  return {
    ok: false,
    code: record.state === 'SUBMISSION_UNKNOWN' ? QUERY_REQUIRED_BEFORE_RETRY : BLIND_RETRY_FORBIDDEN,
    record,
    providerCalled: false,
  };
}

export function applyQueryOutcome(
  record: OperationExecutionRecord,
  query: ProviderQueryOutcome,
  now: string,
): OperationExecutionRecord {
  if (query.kind === 'CONFIRMED') {
    return applyOperationTransition(record, 'CONFIRMED', now, {
      providerOperationRef: query.providerOperationRef,
      confirmedAt: now,
    }).record;
  }
  if (query.kind === 'REJECTED_FINAL') {
    return applyOperationTransition(record, 'REJECTED_FINAL', now, {
      lastSafeErrorCode: query.safeErrorCode,
      lastSafeErrorMessage: query.safeErrorMessage,
    }).record;
  }
  if (query.kind === 'NOT_FOUND' && record.state === 'SUBMISSION_UNKNOWN') {
    return freezeOperation({
      ...record,
      state: 'PREPARED',
      firstSubmittedAt: null,
      lastObservedAt: now,
      lastSafeErrorCode: 'QUERY_NOT_FOUND',
      lastSafeErrorMessage: 'provider_has_no_matching_operation',
    });
  }
  if (query.kind === 'PENDING') {
    return applyOperationTransition(record, 'SUBMITTED', now, {
      providerOperationRef: query.providerOperationRef ?? record.providerOperationRef,
    }).record;
  }
  return applyOperationTransition(record, 'RECONCILIATION_REQUIRED', now).record;
}
