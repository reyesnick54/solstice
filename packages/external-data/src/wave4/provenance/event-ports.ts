/**
 * Composition ports for durable event publishing.
 * Implementations are wired at the service/test boundary from `packages/events`.
 * `external-data` must not import `packages/events` directly.
 */

export type ProvenanceEventEnvelope = {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly schemaVersion: number;
  readonly occurredAt: string;
  readonly producer: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSequence: number;
  readonly payload: unknown;
};

export type ProvenanceEventBus = {
  readonly name?: string;
  publish(envelope: ProvenanceEventEnvelope): Promise<void>;
};

export type ProvenanceEnvelopeSealerInput = {
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly producer: string;
};

export type ProvenanceEnvelopeToolkit = {
  newEventId(): string;
  sealEnvelope(input: ProvenanceEnvelopeSealerInput, sequence: number): ProvenanceEventEnvelope;
};

export type ProvenanceDeadLetterRecord = {
  readonly id?: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly consumerId: string | null;
  readonly attemptCount: number;
  readonly reasonCode: string;
  readonly reasonSafe: string;
  readonly createdAt: string;
  readonly replayedAt: string | null;
};

export type ProvenanceDeadLetterStore = {
  record(row: Omit<ProvenanceDeadLetterRecord, 'id'>): Promise<ProvenanceDeadLetterRecord>;
};
