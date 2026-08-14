import type { DurableEventEnvelope, EventId } from './envelope.ts';
import { assertSupportedEventVersion, UnsupportedEventVersionError } from './schema.ts';
import { assertInOrder, OutOfOrderEventError } from './ordering.ts';
import { safeFailureMessage, type InboxRecord, type InboxState } from './delivery.ts';

export type EventConsumer = {
  readonly consumerId: string;
  readonly eventTypes?: readonly string[];
  handle(envelope: DurableEventEnvelope): Promise<void> | void;
};

export type InboxStore = {
  get(consumerId: string, eventId: EventId): Promise<InboxRecord | undefined>;
  tryBegin(consumerId: string, eventId: EventId, now: string): Promise<'begun' | 'duplicate'>;
  complete(consumerId: string, eventId: EventId, now: string): Promise<void>;
  fail(consumerId: string, eventId: EventId, code: string, message: string): Promise<void>;
  resetForReplay(consumerId: string, eventId: EventId): Promise<void>;
  list(consumerId?: string): Promise<readonly InboxRecord[]>;
};

export class InMemoryInboxStore implements InboxStore {
  private readonly rows = new Map<string, InboxRecord>();

  private key(consumerId: string, eventId: EventId): string {
    return `${consumerId}::${eventId}`;
  }

  async get(consumerId: string, eventId: EventId): Promise<InboxRecord | undefined> {
    return this.rows.get(this.key(consumerId, eventId));
  }

  async tryBegin(consumerId: string, eventId: EventId, now: string): Promise<'begun' | 'duplicate'> {
    const existing = this.rows.get(this.key(consumerId, eventId));
    if (existing?.status === 'COMPLETED') {
      return 'duplicate';
    }
    const next: InboxRecord = {
      consumerId,
      eventId,
      firstSeenAt: existing?.firstSeenAt ?? now,
      status: 'PROCESSING',
      attemptCount: (existing?.attemptCount ?? 0) + 1,
      completedAt: null,
      lastErrorCode: existing?.lastErrorCode ?? null,
      lastErrorSafe: existing?.lastErrorSafe ?? null,
    };
    this.rows.set(this.key(consumerId, eventId), next);
    return 'begun';
  }

  async complete(consumerId: string, eventId: EventId, now: string): Promise<void> {
    const existing = this.rows.get(this.key(consumerId, eventId));
    if (!existing) {
      return;
    }
    this.rows.set(this.key(consumerId, eventId), {
      ...existing,
      status: 'COMPLETED',
      completedAt: now,
    });
  }

  async fail(consumerId: string, eventId: EventId, code: string, message: string): Promise<void> {
    const existing = this.rows.get(this.key(consumerId, eventId));
    if (!existing) {
      return;
    }
    this.rows.set(this.key(consumerId, eventId), {
      ...existing,
      status: 'FAILED',
      lastErrorCode: code,
      lastErrorSafe: message,
    });
  }

  async resetForReplay(consumerId: string, eventId: EventId): Promise<void> {
    const existing = this.rows.get(this.key(consumerId, eventId));
    if (!existing) {
      return;
    }
    this.rows.set(this.key(consumerId, eventId), {
      ...existing,
      status: 'RECEIVED' satisfies InboxState,
      completedAt: null,
    });
  }

  async list(consumerId?: string): Promise<readonly InboxRecord[]> {
    return [...this.rows.values()].filter((row) => !consumerId || row.consumerId === consumerId);
  }
}

export type ConsumerRuntimeOptions = {
  readonly now: () => string;
  readonly enforceOrder?: boolean;
  readonly lastSequence?: Map<string, number>;
};

export class InboxProcessor {
  private readonly inbox: InboxStore;
  private readonly options: ConsumerRuntimeOptions;
  private readonly lastSequence: Map<string, number>;

  constructor(inbox: InboxStore, options: ConsumerRuntimeOptions) {
    this.inbox = inbox;
    this.options = options;
    this.lastSequence = options.lastSequence ?? new Map();
  }

  async process(consumer: EventConsumer, envelope: DurableEventEnvelope): Promise<'applied' | 'duplicate' | 'failed'> {
    if (consumer.eventTypes && !consumer.eventTypes.includes(envelope.eventType)) {
      return 'applied';
    }
    const begun = await this.inbox.tryBegin(consumer.consumerId, envelope.eventId, this.options.now());
    if (begun === 'duplicate') {
      return 'duplicate';
    }
    try {
      assertSupportedEventVersion(envelope);
      if (this.options.enforceOrder) {
        const key = `${consumer.consumerId}:${envelope.aggregateType}:${envelope.aggregateId}`;
        assertInOrder(this.lastSequence.get(key), envelope);
        this.lastSequence.set(key, envelope.aggregateSequence);
      }
      await consumer.handle(envelope);
      await this.inbox.complete(consumer.consumerId, envelope.eventId, this.options.now());
      return 'applied';
    } catch (error) {
      const safe = safeFailureMessage(error);
      await this.inbox.fail(consumer.consumerId, envelope.eventId, safe.code, safe.message);
      if (error instanceof UnsupportedEventVersionError || error instanceof OutOfOrderEventError) {
        throw error;
      }
      throw error;
    }
  }
}
