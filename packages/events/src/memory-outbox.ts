import { asEventId, type DurableEventEnvelope, serializeEnvelope } from './envelope.ts';
import type { DeadLetterStore, OutboxStore } from './dispatcher.ts';
import type { DeadLetterRecord, OutboxRecord, OutboxState } from './delivery.ts';

export function outboxRecordFromEnvelope(
  envelope: DurableEventEnvelope,
  createdAt: string,
): OutboxRecord {
  return {
    eventId: envelope.eventId,
    envelopeJson: serializeEnvelope(envelope),
    deliveryState: 'PENDING',
    attemptCount: 0,
    nextAttemptAt: createdAt,
    lastAttemptAt: null,
    lastErrorCode: null,
    lastErrorSafe: null,
    lockedBy: null,
    lockedAt: null,
    deliveredAt: null,
    createdAt,
  };
}

export class InMemoryOutboxStore implements OutboxStore {
  private readonly rows = new Map<string, OutboxRecord>();

  async enqueue(record: OutboxRecord): Promise<void> {
    if (this.rows.has(record.eventId)) {
      return;
    }
    this.rows.set(record.eventId, record);
  }

  async claimBatch(input: {
    readonly now: string;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  }): Promise<readonly OutboxRecord[]> {
    const claimed: OutboxRecord[] = [];
    const leaseCutoff = new Date(new Date(input.now).getTime() - input.leaseMs).toISOString();
    for (const row of this.rows.values()) {
      if (claimed.length >= input.limit) {
        break;
      }
      const expiredLease =
        row.deliveryState === 'IN_FLIGHT' && (row.lockedAt === null || row.lockedAt <= leaseCutoff);
      const pending = row.deliveryState === 'PENDING' && row.nextAttemptAt <= input.now;
      if (!pending && !expiredLease) {
        continue;
      }
      const next: OutboxRecord = {
        ...row,
        deliveryState: 'IN_FLIGHT',
        lockedBy: input.workerId,
        lockedAt: input.now,
      };
      this.rows.set(row.eventId, next);
      claimed.push(next);
    }
    return claimed;
  }

  async markDelivered(eventId: string, now: string): Promise<void> {
    const row = this.rows.get(eventId);
    if (!row) {
      return;
    }
    this.rows.set(eventId, {
      ...row,
      deliveryState: 'DELIVERED',
      deliveredAt: now,
      lockedBy: null,
      lockedAt: null,
    });
  }

  async markRetry(input: {
    readonly eventId: string;
    readonly attemptCount: number;
    readonly nextAttemptAt: string;
    readonly lastAttemptAt: string;
    readonly code: string;
    readonly message: string;
  }): Promise<void> {
    const row = this.rows.get(input.eventId);
    if (!row) {
      return;
    }
    this.rows.set(input.eventId, {
      ...row,
      deliveryState: 'PENDING',
      attemptCount: input.attemptCount,
      nextAttemptAt: input.nextAttemptAt,
      lastAttemptAt: input.lastAttemptAt,
      lastErrorCode: input.code,
      lastErrorSafe: input.message,
      lockedBy: null,
      lockedAt: null,
    });
  }

  async markDeadLetter(eventId: string, now: string): Promise<void> {
    const row = this.rows.get(eventId);
    if (!row) {
      return;
    }
    this.rows.set(eventId, {
      ...row,
      deliveryState: 'DEAD_LETTER',
      lastAttemptAt: now,
      lockedBy: null,
      lockedAt: null,
    });
  }

  async requeue(eventId: string, now: string): Promise<void> {
    const row = this.rows.get(eventId);
    if (!row) {
      return;
    }
    this.rows.set(eventId, {
      ...row,
      deliveryState: 'PENDING',
      nextAttemptAt: now,
      lockedBy: null,
      lockedAt: null,
      deliveredAt: null,
    });
  }

  async get(eventId: string): Promise<OutboxRecord | undefined> {
    return this.rows.get(eventId);
  }

  async list(state?: OutboxState): Promise<readonly OutboxRecord[]> {
    return [...this.rows.values()].filter((row) => !state || row.deliveryState === state);
  }
}

export class InMemoryDeadLetterStore implements DeadLetterStore {
  private readonly rows: DeadLetterRecord[] = [];
  private seq = 0;

  async record(row: Omit<DeadLetterRecord, 'id'>): Promise<DeadLetterRecord> {
    this.seq += 1;
    const stored: DeadLetterRecord = { ...row, id: String(this.seq), eventId: asEventId(row.eventId) };
    this.rows.push(stored);
    return stored;
  }

  async list(): Promise<readonly DeadLetterRecord[]> {
    return this.rows.slice();
  }

  async markReplayed(eventId: string, now: string): Promise<void> {
    for (let i = 0; i < this.rows.length; i += 1) {
      const row = this.rows[i]!;
      if (row.eventId === eventId && row.replayedAt === null) {
        this.rows[i] = { ...row, replayedAt: now };
      }
    }
  }

  async getByEventId(eventId: string): Promise<DeadLetterRecord | undefined> {
    return [...this.rows].reverse().find((row) => row.eventId === eventId);
  }
}
