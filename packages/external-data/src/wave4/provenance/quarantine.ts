/**
 * Dead-letter and quarantine handling for failed observations.
 * No failed event silently becomes an accepted economic record.
 */

import type {
  ProvenanceDeadLetterRecord,
  ProvenanceDeadLetterStore,
} from './event-ports.ts';
import type { QuarantineReasonCode, QuarantinedObservation } from './types.ts';

export type QuarantineStore = {
  record(entry: QuarantinedObservation): Promise<void>;
  list(): Promise<readonly QuarantinedObservation[]>;
  get(quarantineId: string): Promise<QuarantinedObservation | undefined>;
  listRetryable(): Promise<readonly QuarantinedObservation[]>;
};

export class InMemoryQuarantineStore implements QuarantineStore {
  private readonly rows = new Map<string, QuarantinedObservation>();
  private seq = 0;

  nextQuarantineId(): string {
    this.seq += 1;
    return `quarantine_${this.seq}`;
  }

  async record(entry: QuarantinedObservation): Promise<void> {
    this.rows.set(entry.quarantineId, Object.freeze({ ...entry }));
  }

  async list(): Promise<readonly QuarantinedObservation[]> {
    return [...this.rows.values()];
  }

  async get(quarantineId: string): Promise<QuarantinedObservation | undefined> {
    return this.rows.get(quarantineId);
  }

  async listRetryable(): Promise<readonly QuarantinedObservation[]> {
    return [...this.rows.values()].filter((row) => row.retryable);
  }
}

export function classifyQuarantineReason(failureCode: string): {
  readonly reasonCode: QuarantineReasonCode;
  readonly retryable: boolean;
} {
  const normalized = failureCode.toUpperCase();
  if (normalized.includes('SCHEMA') || normalized.includes('VALIDATION')) {
    return { reasonCode: 'SCHEMA_ERROR', retryable: false };
  }
  if (normalized.includes('RIGHTS') || normalized.includes('LICENSE') || normalized.includes('CONSENT')) {
    return { reasonCode: 'RIGHTS_FAILURE', retryable: false };
  }
  if (normalized.includes('PROVIDER') || normalized.includes('TIMEOUT') || normalized.includes('UNAVAILABLE')) {
    return { reasonCode: 'PROVIDER_FAILURE', retryable: true };
  }
  if (normalized.includes('NORMALIZ') || normalized.includes('PARSE') || normalized.includes('MAP')) {
    return { reasonCode: 'NORMALIZATION_FAILURE', retryable: false };
  }
  if (normalized.includes('INTEGRITY') || normalized.includes('HASH') || normalized.includes('TAMPER')) {
    return { reasonCode: 'INTEGRITY_FAILURE', retryable: false };
  }
  if (normalized.includes('DUPLICATE')) {
    return { reasonCode: 'DUPLICATE_TRANSPORT', retryable: false };
  }
  return { reasonCode: 'NORMALIZATION_FAILURE', retryable: false };
}

export async function quarantineFailedObservation(input: {
  readonly store: QuarantineStore;
  readonly deadLetters?: ProvenanceDeadLetterStore;
  readonly quarantineId: string;
  readonly failureCode: string;
  readonly failureMessage: string;
  readonly idempotencyKey: string;
  readonly providerId: string;
  readonly capability: string;
  readonly rawPayloadHash: string | null;
  readonly eventId: string | null;
  readonly now: string;
  readonly consumerId?: string;
}): Promise<QuarantinedObservation> {
  const classified = classifyQuarantineReason(input.failureCode);
  const entry: QuarantinedObservation = Object.freeze({
    quarantineId: input.quarantineId,
    reasonCode: classified.reasonCode,
    reasonSafe: input.failureMessage.slice(0, 240),
    idempotencyKey: input.idempotencyKey,
    providerId: input.providerId,
    capability: input.capability,
    rawPayloadHash: input.rawPayloadHash,
    quarantinedAt: input.now,
    retryable: classified.retryable,
    eventId: input.eventId,
  });
  await input.store.record(entry);

  if (input.deadLetters && input.eventId) {
    const row: Omit<ProvenanceDeadLetterRecord, 'id'> = {
      eventId: input.eventId,
      eventType: 'ObservationRejected',
      eventVersion: 1,
      consumerId: input.consumerId ?? 'economic-provenance-fabric',
      attemptCount: 1,
      reasonCode: classified.reasonCode,
      reasonSafe: entry.reasonSafe,
      createdAt: input.now,
      replayedAt: null,
    };
    await input.deadLetters.record(row);
  }

  return entry;
}
