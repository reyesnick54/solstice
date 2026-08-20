import { computeRequestDigest } from './digest.ts';
import {
  IDEMPOTENCY_PAYLOAD_MISMATCH,
  freezeOperation,
  type IdempotencyConflict,
  type OperationExecutionRecord,
  type OperationState,
  type PrepareDraft,
} from './types.ts';

export type OperationStore = {
  prepare(draft: PrepareDraft): Promise<OperationExecutionRecord | IdempotencyConflict>;
  get(operationId: string): Promise<OperationExecutionRecord | undefined>;
  getByIdempotencyKey(
    providerId: string,
    idempotencyKey: string,
  ): Promise<OperationExecutionRecord | undefined>;
  getByBusinessKey(
    operationKind: string,
    businessKey: string,
  ): Promise<OperationExecutionRecord | undefined>;
  update(record: OperationExecutionRecord): Promise<OperationExecutionRecord>;
  listByState(states: readonly OperationState[]): Promise<readonly OperationExecutionRecord[]>;
  claimLease(input: {
    readonly operationId: string;
    readonly workerId: string;
    readonly now: string;
    readonly leaseMs: number;
  }): Promise<'acquired' | 'held'>;
  releaseLease(operationId: string, workerId: string): Promise<void>;
};

export class InMemoryOperationStore implements OperationStore {
  private readonly byId = new Map<string, OperationExecutionRecord>();

  async prepare(draft: PrepareDraft): Promise<OperationExecutionRecord | IdempotencyConflict> {
    const requestDigest = computeRequestDigest(draft.digest);
    const existingKey = [...this.byId.values()].find(
      (row) => row.providerId === draft.digest.providerId && row.idempotencyKey === draft.idempotencyKey,
    );
    if (existingKey) {
      if (existingKey.requestDigest !== requestDigest) {
        return Object.freeze({
          code: IDEMPOTENCY_PAYLOAD_MISMATCH,
          existing: existingKey,
          requestedDigest: requestDigest,
        });
      }
      return existingKey;
    }
    const record = freezeOperation({
      operationId: draft.operationId,
      operationKind: draft.operationKind,
      businessKey: draft.businessKey,
      idempotencyKey: draft.idempotencyKey,
      requestDigest,
      correlationId: draft.correlationId ?? null,
      causationId: draft.causationId ?? null,
      intentId: draft.intentId ?? null,
      evidenceId: draft.evidenceId ?? null,
      providerId: draft.digest.providerId,
      providerOperationRef: null,
      state: 'PREPARED',
      attemptCount: 0,
      attemptLineage: draft.attemptLineage ?? 'lineage_1',
      supersedesOperationId: draft.supersedesOperationId ?? null,
      nativeAssetId: draft.digest.nativeAssetId,
      preparedAt: draft.now,
      firstSubmittedAt: null,
      lastObservedAt: draft.now,
      confirmedAt: null,
      lastSafeErrorCode: null,
      lastSafeErrorMessage: null,
      revision: 1,
      leaseOwner: null,
      leaseUntil: null,
    });
    this.byId.set(record.operationId, record);
    return record;
  }

  async get(operationId: string): Promise<OperationExecutionRecord | undefined> {
    return this.byId.get(operationId);
  }

  async getByIdempotencyKey(
    providerId: string,
    idempotencyKey: string,
  ): Promise<OperationExecutionRecord | undefined> {
    return [...this.byId.values()].find(
      (row) => row.providerId === providerId && row.idempotencyKey === idempotencyKey,
    );
  }

  async getByBusinessKey(
    operationKind: string,
    businessKey: string,
  ): Promise<OperationExecutionRecord | undefined> {
    return [...this.byId.values()].find(
      (row) => row.operationKind === operationKind && row.businessKey === businessKey,
    );
  }

  async update(record: OperationExecutionRecord): Promise<OperationExecutionRecord> {
    const existing = this.byId.get(record.operationId);
    const next = freezeOperation({
      ...record,
      revision: (existing?.revision ?? record.revision) + (existing ? 1 : 0),
    });
    this.byId.set(next.operationId, next);
    return next;
  }

  async listByState(states: readonly OperationState[]): Promise<readonly OperationExecutionRecord[]> {
    const allowed = new Set(states);
    return [...this.byId.values()].filter((row) => allowed.has(row.state));
  }

  async claimLease(input: {
    readonly operationId: string;
    readonly workerId: string;
    readonly now: string;
    readonly leaseMs: number;
  }): Promise<'acquired' | 'held'> {
    const existing = this.byId.get(input.operationId);
    if (!existing) {
      return 'held';
    }
    const leaseActive =
      existing.leaseOwner !== null &&
      existing.leaseUntil !== null &&
      existing.leaseUntil > input.now &&
      existing.leaseOwner !== input.workerId;
    if (leaseActive) {
      return 'held';
    }
    const leaseUntil = new Date(Date.parse(input.now) + input.leaseMs).toISOString();
    this.byId.set(
      input.operationId,
      freezeOperation({
        ...existing,
        leaseOwner: input.workerId,
        leaseUntil,
        revision: existing.revision + 1,
      }),
    );
    return 'acquired';
  }

  async releaseLease(operationId: string, workerId: string): Promise<void> {
    const existing = this.byId.get(operationId);
    if (!existing || existing.leaseOwner !== workerId) {
      return;
    }
    this.byId.set(
      operationId,
      freezeOperation({
        ...existing,
        leaseOwner: null,
        leaseUntil: null,
        revision: existing.revision + 1,
      }),
    );
  }

  list(): readonly OperationExecutionRecord[] {
    return [...this.byId.values()];
  }
}

export function isIdempotencyConflict(
  value: OperationExecutionRecord | IdempotencyConflict,
): value is IdempotencyConflict {
  return 'code' in value && value.code === IDEMPOTENCY_PAYLOAD_MISMATCH;
}
