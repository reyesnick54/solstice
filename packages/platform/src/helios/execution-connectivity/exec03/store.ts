import { EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH } from './taxonomy.ts';
import { executionPayloadHash } from './ids.ts';
import type {
  Exec03IntentStoreSnapshot,
  ExecutionIntent,
  RegisterExecutionIntentDraft,
  SubmissionAmbiguity,
  SubmissionAttempt,
  SubmissionReceipt,
} from './types.ts';
import { HELIOS_EXEC03_SCHEMA } from './taxonomy.ts';

export class InMemoryExec03IntentStore {
  private readonly byOperationId = new Map<string, ExecutionIntent>();
  private readonly byClientOrderId = new Map<string, string>();
  private readonly byAccountIdempotency = new Map<string, string>();
  private readonly attempts = new Map<string, SubmissionAttempt>();
  private readonly receipts = new Map<string, SubmissionReceipt>();
  private readonly ambiguities = new Map<string, SubmissionAmbiguity>();

  register(draft: RegisterExecutionIntentDraft, safeWindowMs: number): ExecutionIntent {
    const existingClient = this.byClientOrderId.get(draft.clientOrderId);
    if (existingClient && existingClient !== draft.operationId) {
      throw new Error('clientOrderId must be globally unique');
    }

    const accountKey = `${draft.providerAccountId}:${draft.idempotencyKey}`;
    const existingOp = this.byAccountIdempotency.get(accountKey);
    if (existingOp) {
      const existing = this.byOperationId.get(existingOp);
      if (!existing) {
        throw new Error('corrupt idempotency index');
      }
      const requestedHash = executionPayloadHash(draft.payload);
      if (existing.payloadHash !== requestedHash) {
        const error = new Error(EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH);
        error.name = EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH;
        throw error;
      }
      return existing;
    }

    const payloadHash = executionPayloadHash(draft.payload);
    const intent: ExecutionIntent = Object.freeze({
      schema: HELIOS_EXEC03_SCHEMA,
      operationId: draft.operationId,
      clientOrderId: draft.clientOrderId,
      idempotencyKey: draft.idempotencyKey,
      providerAccountId: draft.providerAccountId,
      providerId: draft.providerId,
      payloadHash,
      payload: Object.freeze({ ...draft.payload }),
      state: 'NOT_SUBMITTED',
      providerOrderId: null,
      attemptCount: 0,
      submittedOnce: false,
      governedResubmitPermitted: false,
      ambiguitySafeWindowEndsAt: null,
      createdAt: draft.now,
      updatedAt: draft.now,
      firstSubmittedAt: null,
      acknowledgedAt: null,
      confirmedAt: null,
      liveBrokerConnected: false,
    });

    this.byOperationId.set(intent.operationId, intent);
    this.byClientOrderId.set(intent.clientOrderId, intent.operationId);
    this.byAccountIdempotency.set(accountKey, intent.operationId);
    void safeWindowMs;
    return intent;
  }

  get(operationId: string): ExecutionIntent | undefined {
    return this.byOperationId.get(operationId);
  }

  getByClientOrderId(clientOrderId: string): ExecutionIntent | undefined {
    const operationId = this.byClientOrderId.get(clientOrderId);
    if (!operationId) {
      return undefined;
    }
    return this.byOperationId.get(operationId);
  }

  putIntent(intent: ExecutionIntent): ExecutionIntent {
    const frozen = Object.freeze({ ...intent });
    this.byOperationId.set(frozen.operationId, frozen);
    this.byClientOrderId.set(frozen.clientOrderId, frozen.operationId);
    return frozen;
  }

  putAttempt(attempt: SubmissionAttempt): SubmissionAttempt {
    const frozen = Object.freeze({ ...attempt });
    this.attempts.set(frozen.attemptId, frozen);
    return frozen;
  }

  putReceipt(receipt: SubmissionReceipt): SubmissionReceipt {
    const frozen = Object.freeze({ ...receipt });
    this.receipts.set(frozen.receiptId, frozen);
    return frozen;
  }

  putAmbiguity(ambiguity: SubmissionAmbiguity): SubmissionAmbiguity {
    const frozen = Object.freeze({ ...ambiguity });
    this.ambiguities.set(frozen.ambiguityId, frozen);
    return frozen;
  }

  listIncomplete(): readonly ExecutionIntent[] {
    return [...this.byOperationId.values()].filter(
      (row) => row.state === 'SUBMITTING' || row.state === 'SUBMISSION_UNKNOWN',
    );
  }

  snapshot(): Exec03IntentStoreSnapshot {
    return Object.freeze({
      intents: Object.freeze([...this.byOperationId.values()]),
      attempts: Object.freeze([...this.attempts.values()]),
      receipts: Object.freeze([...this.receipts.values()]),
      ambiguities: Object.freeze([...this.ambiguities.values()]),
    });
  }

  restore(snapshot: Exec03IntentStoreSnapshot): void {
    this.byOperationId.clear();
    this.byClientOrderId.clear();
    this.byAccountIdempotency.clear();
    this.attempts.clear();
    this.receipts.clear();
    this.ambiguities.clear();

    for (const intent of snapshot.intents) {
      this.putIntent(intent);
      const accountKey = `${intent.providerAccountId}:${intent.idempotencyKey}`;
      this.byAccountIdempotency.set(accountKey, intent.operationId);
    }
    for (const attempt of snapshot.attempts) {
      this.putAttempt(attempt);
    }
    for (const receipt of snapshot.receipts) {
      this.putReceipt(receipt);
    }
    for (const ambiguity of snapshot.ambiguities) {
      this.putAmbiguity(ambiguity);
    }
  }
}
