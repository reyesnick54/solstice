import { err, ok, type Result } from '@solstice/domain';

import type { FixtureExec03BrokerPort } from './broker-port.ts';
import {
  submissionAmbiguityIdFor,
  submissionAttemptIdFor,
  submissionReceiptIdFor,
} from './ids.ts';
import { providerOrderLookup, reconcileStateFromLookup } from './reconcile.ts';
import { InMemoryExec03IntentStore } from './store.ts';
import {
  EXEC03_BLIND_RESUBMIT_FORBIDDEN,
  EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED,
  EXEC03_QUERY_REQUIRED_BEFORE_RETRY,
} from './taxonomy.ts';
import {
  assertExec03Transition,
  incompleteAfterRestart,
  requiresReconciliationBeforeResubmit,
} from './transitions.ts';
import type {
  Exec03Failure,
  ExecutionIntent,
  ProviderOrderLookup,
  RegisterExecutionIntentDraft,
  SubmissionAmbiguity,
  SubmissionAttempt,
  SubmissionReceipt,
} from './types.ts';

const DEFAULT_SAFE_WINDOW_MS = 5_000;

export type Exec03EnginePorts = {
  readonly now: () => string;
  readonly broker: FixtureExec03BrokerPort;
  readonly safeWindowMs?: number;
};

export class Exec03IdempotentOrderEngine {
  readonly store: InMemoryExec03IntentStore;
  private readonly ports: Exec03EnginePorts;

  constructor(ports: Exec03EnginePorts, store?: InMemoryExec03IntentStore) {
    this.ports = ports;
    this.store = store ?? new InMemoryExec03IntentStore();
  }

  registerIntent(draft: RegisterExecutionIntentDraft): ExecutionIntent {
    const safeWindowMs = draft.safeWindowMs ?? this.ports.safeWindowMs ?? DEFAULT_SAFE_WINDOW_MS;
    return this.store.register(draft, safeWindowMs);
  }

  submitIntent(operationId: string): Result<ExecutionIntent, Exec03Failure> {
    const intent = this.store.get(operationId);
    if (!intent) {
      return err({ code: 'INTENT_NOT_FOUND', message: 'execution intent not found' });
    }
    if (requiresReconciliationBeforeResubmit(intent)) {
      return err({
        code: EXEC03_QUERY_REQUIRED_BEFORE_RETRY,
        message: 'reconcile before any resubmission',
      });
    }
    if (intent.state !== 'NOT_SUBMITTED') {
      return err({
        code: EXEC03_BLIND_RESUBMIT_FORBIDDEN,
        message: `cannot submit from state ${intent.state}`,
      });
    }
    if (intent.governedResubmitPermitted && !intent.submittedOnce) {
      return err({
        code: EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED,
        message: 'governed resubmit requires prior ambiguous submission',
      });
    }

    const now = this.ports.now();
    const attemptNumber = intent.attemptCount + 1;
    const attemptId = submissionAttemptIdFor(operationId, attemptNumber);

    const submitting: ExecutionIntent = Object.freeze({
      ...intent,
      state: 'SUBMITTING',
      attemptCount: attemptNumber,
      submittedOnce: true,
      governedResubmitPermitted: false,
      firstSubmittedAt: intent.firstSubmittedAt ?? now,
      updatedAt: now,
    });
    assertExec03Transition(intent, 'SUBMITTING');
    this.store.putIntent(submitting);

    const inFlight: SubmissionAttempt = Object.freeze({
      attemptId,
      operationId,
      attemptNumber,
      startedAt: now,
      completedAt: null,
      outcome: 'IN_FLIGHT',
      brokerInvoked: false,
      clientOrderId: intent.clientOrderId,
    });
    this.store.putAttempt(inFlight);

    const brokerResult = this.ports.broker.submit({
      clientOrderId: intent.clientOrderId,
      operationId: intent.operationId,
      instrumentId: intent.payload.instrumentId,
      side: intent.payload.side,
      quantityUnits: intent.payload.quantityUnits,
    });

    const completedAt = this.ports.now();

    if (brokerResult.kind === 'UNAVAILABLE') {
      const rejected: ExecutionIntent = Object.freeze({
        ...submitting,
        state: 'REJECTED',
        updatedAt: completedAt,
      });
      this.store.putIntent(rejected);
      this.store.putAttempt(
        Object.freeze({
          ...inFlight,
          completedAt,
          outcome: 'REJECTED',
          brokerInvoked: false,
        }),
      );
      return err({ code: 'BROKER_UNAVAILABLE', message: brokerResult.message });
    }

    if (brokerResult.kind === 'TIMEOUT_AFTER_ACCEPT') {
      const safeWindowEndsAt = new Date(
        Date.parse(completedAt) + (this.ports.safeWindowMs ?? DEFAULT_SAFE_WINDOW_MS),
      ).toISOString();
      const ambiguous: ExecutionIntent = Object.freeze({
        ...submitting,
        state: 'SUBMISSION_UNKNOWN',
        ambiguitySafeWindowEndsAt: safeWindowEndsAt,
        updatedAt: completedAt,
      });
      this.store.putIntent(ambiguous);
      this.store.putAttempt(
        Object.freeze({
          ...inFlight,
          completedAt,
          outcome: 'AMBIGUOUS',
          brokerInvoked: true,
        }),
      );
      const ambiguity: SubmissionAmbiguity = Object.freeze({
        ambiguityId: submissionAmbiguityIdFor(operationId, attemptId),
        operationId,
        attemptId,
        reason: 'NETWORK_TIMEOUT',
        markedAt: completedAt,
        safeWindowEndsAt,
        resolvedAt: null,
        resolution: null,
      });
      this.store.putAmbiguity(ambiguity);
      return ok(ambiguous);
    }

    const receipt: SubmissionReceipt = Object.freeze({
      receiptId: submissionReceiptIdFor(operationId, brokerResult.providerOrderId),
      operationId,
      attemptId,
      clientOrderId: intent.clientOrderId,
      providerOrderId: brokerResult.providerOrderId,
      receivedAt: completedAt,
      source: 'SUBMIT_RESPONSE',
    });
    this.store.putReceipt(receipt);

    const nextState =
      brokerResult.kind === 'CONFIRMED'
        ? 'CONFIRMED'
        : brokerResult.kind === 'REJECTED'
          ? 'REJECTED'
          : 'ACKNOWLEDGED';

    const resolved: ExecutionIntent = Object.freeze({
      ...submitting,
      state: nextState,
      providerOrderId: brokerResult.providerOrderId,
      acknowledgedAt: nextState === 'ACKNOWLEDGED' || nextState === 'CONFIRMED' ? completedAt : null,
      confirmedAt: nextState === 'CONFIRMED' ? completedAt : null,
      updatedAt: completedAt,
    });
    this.store.putIntent(resolved);
    this.store.putAttempt(
      Object.freeze({
        ...inFlight,
        completedAt,
        outcome: nextState === 'CONFIRMED' ? 'CONFIRMED' : nextState === 'REJECTED' ? 'REJECTED' : 'ACKNOWLEDGED',
        brokerInvoked: true,
      }),
    );
    return ok(resolved);
  }

  refuseBlindResubmit(operationId: string): Result<never, Exec03Failure> {
    const intent = this.store.get(operationId);
    if (!intent) {
      return err({ code: 'INTENT_NOT_FOUND', message: 'execution intent not found' });
    }
    return err({
      code:
        intent.state === 'SUBMISSION_UNKNOWN' || intent.state === 'RECONCILING'
          ? EXEC03_QUERY_REQUIRED_BEFORE_RETRY
          : EXEC03_BLIND_RESUBMIT_FORBIDDEN,
      message: 'automatic resubmission is forbidden after ambiguity',
    });
  }

  reconcileIntent(operationId: string): Result<
    { readonly intent: ExecutionIntent; readonly lookup: ProviderOrderLookup },
    Exec03Failure
  > {
    const intent = this.store.get(operationId);
    if (!intent) {
      return err({ code: 'INTENT_NOT_FOUND', message: 'execution intent not found' });
    }
    if (
      intent.state !== 'SUBMISSION_UNKNOWN' &&
      intent.state !== 'RECONCILING' &&
      intent.state !== 'SUBMITTING'
    ) {
      return err({
        code: 'INVALID_TRANSITION',
        message: `reconciliation does not apply to state ${intent.state}`,
      });
    }

    const now = this.ports.now();
    const reconciling: ExecutionIntent = Object.freeze({
      ...intent,
      state: 'RECONCILING',
      updatedAt: now,
    });
    this.store.putIntent(reconciling);

    const safeWindowEndsAt =
      intent.ambiguitySafeWindowEndsAt ??
      new Date(Date.parse(now) + (this.ports.safeWindowMs ?? DEFAULT_SAFE_WINDOW_MS)).toISOString();

    const lookup = providerOrderLookup(reconciling, this.ports.broker, now, safeWindowEndsAt);
    const next = reconcileStateFromLookup(reconciling, lookup, now);
    this.store.putIntent(next);

    if (lookup.aggregateFound && lookup.providerOrderId) {
      const receipt: SubmissionReceipt = Object.freeze({
        receiptId: submissionReceiptIdFor(operationId, lookup.providerOrderId),
        operationId,
        attemptId: submissionAttemptIdFor(operationId, intent.attemptCount),
        clientOrderId: intent.clientOrderId,
        providerOrderId: lookup.providerOrderId,
        receivedAt: now,
        source: 'RECONCILIATION',
      });
      this.store.putReceipt(receipt);
    }

    return ok({ intent: next, lookup });
  }

  governedResubmit(operationId: string): Result<ExecutionIntent, Exec03Failure> {
    const intent = this.store.get(operationId);
    if (!intent) {
      return err({ code: 'INTENT_NOT_FOUND', message: 'execution intent not found' });
    }
    if (!intent.governedResubmitPermitted || intent.state !== 'NOT_SUBMITTED') {
      return err({
        code: EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED,
        message: 'governed resubmission is not permitted for this intent',
      });
    }
    return this.submitIntent(operationId);
  }

  recoverAfterRestart(): readonly ExecutionIntent[] {
    const recovered: ExecutionIntent[] = [];
    for (const intent of this.store.listIncomplete()) {
      if (!incompleteAfterRestart(intent)) {
        continue;
      }
      const result = this.reconcileIntent(intent.operationId);
      if (result.ok) {
        recovered.push(result.value.intent);
      }
    }
    return Object.freeze(recovered);
  }
}
