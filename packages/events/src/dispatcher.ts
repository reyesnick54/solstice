import type { DurableEventEnvelope } from './envelope.ts';
import {
  DEFAULT_RETRY_POLICY,
  nextAttemptDelayMs,
  safeFailureMessage,
  shouldDeadLetter,
  type DeadLetterRecord,
  type OutboxRecord,
  type RetryPolicy,
} from './delivery.ts';
import type { EventTransport } from './transport.ts';
import { parseEnvelope } from './envelope.ts';
import { classifyFailure, holdsForOperator, shouldRetry } from './retry.ts';

export type OutboxStore = {
  enqueue(record: OutboxRecord): Promise<void>;
  claimBatch(input: {
    readonly now: string;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  }): Promise<readonly OutboxRecord[]>;
  markDelivered(eventId: string, now: string): Promise<void>;
  markRetry(input: {
    readonly eventId: string;
    readonly attemptCount: number;
    readonly nextAttemptAt: string;
    readonly lastAttemptAt: string;
    readonly code: string;
    readonly message: string;
  }): Promise<void>;
  markDeadLetter(eventId: string, now: string): Promise<void>;
  requeue(eventId: string, now: string): Promise<void>;
  get(eventId: string): Promise<OutboxRecord | undefined>;
  list(state?: OutboxRecord['deliveryState']): Promise<readonly OutboxRecord[]>;
};

export type DeadLetterStore = {
  record(row: Omit<DeadLetterRecord, 'id'>): Promise<DeadLetterRecord>;
  list(): Promise<readonly DeadLetterRecord[]>;
  markReplayed(eventId: string, now: string): Promise<void>;
  getByEventId(eventId: string): Promise<DeadLetterRecord | undefined>;
};

export type DispatcherClock = {
  now(): string;
  nowMs(): number;
};

export type OutboxDispatcherOptions = {
  readonly workerId: string;
  readonly clock: DispatcherClock;
  readonly policy?: RetryPolicy;
  readonly batchSize?: number;
  readonly leaseMs?: number;
};

/**
 * At-least-once dispatcher. Claim uses a lease so a crashed worker does
 * not lose a committed outbox row. Duplicate publish is expected;
 * consumers must be idempotent.
 */
export class OutboxDispatcher {
  private readonly outbox: OutboxStore;
  private readonly deadLetters: DeadLetterStore;
  private readonly transport: EventTransport;
  private readonly options: OutboxDispatcherOptions;
  private readonly policy: RetryPolicy;

  constructor(
    outbox: OutboxStore,
    deadLetters: DeadLetterStore,
    transport: EventTransport,
    options: OutboxDispatcherOptions,
  ) {
    this.outbox = outbox;
    this.deadLetters = deadLetters;
    this.transport = transport;
    this.options = options;
    this.policy = options.policy ?? DEFAULT_RETRY_POLICY;
  }

  async dispatchOnce(): Promise<{ published: number; deadLettered: number; retried: number }> {
    const now = this.options.clock.now();
    const claimed = await this.outbox.claimBatch({
      now,
      workerId: this.options.workerId,
      limit: this.options.batchSize ?? 20,
      leaseMs: this.options.leaseMs ?? 5_000,
    });
    let published = 0;
    let deadLettered = 0;
    let retried = 0;
    for (const row of claimed) {
      try {
        const envelope = parseEnvelope(row.envelopeJson);
        await this.transport.publish(envelope);
        await this.outbox.markDelivered(row.eventId, this.options.clock.now());
        published += 1;
      } catch (error) {
        const attemptCount = row.attemptCount + 1;
        const safe = safeFailureMessage(error);
        const classified = classifyFailure(error);
        const stop =
          !shouldRetry(classified) || holdsForOperator(classified) || shouldDeadLetter(attemptCount, this.policy);
        if (stop) {
          await this.outbox.markDeadLetter(row.eventId, this.options.clock.now());
          const envelope = safeParseTrace(row.envelopeJson);
          await this.deadLetters.record({
            eventId: row.eventId,
            eventType: extractEventType(row.envelopeJson),
            eventVersion: extractEventVersion(row.envelopeJson),
            consumerId: null,
            attemptCount,
            reasonCode: safe.code,
            reasonSafe: safe.message,
            errorClass: classified.retryClass,
            correlationId: envelope.correlationId,
            requestId: envelope.requestId,
            lastAttemptAt: this.options.clock.now(),
            createdAt: this.options.clock.now(),
            replayedAt: null,
          });
          deadLettered += 1;
        } else {
          const delay = nextAttemptDelayMs(attemptCount, this.policy);
          await this.outbox.markRetry({
            eventId: row.eventId,
            attemptCount,
            nextAttemptAt: new Date(this.options.clock.nowMs() + delay).toISOString(),
            lastAttemptAt: this.options.clock.now(),
            code: safe.code,
            message: safe.message,
          });
          retried += 1;
        }
      }
    }
    return { published, deadLettered, retried };
  }
}

function extractEventType(envelopeJson: string): string {
  try {
    return String((JSON.parse(envelopeJson) as { eventType?: string }).eventType ?? 'unknown');
  } catch {
    return 'unknown';
  }
}

function extractEventVersion(envelopeJson: string): number {
  try {
    const raw = JSON.parse(envelopeJson) as { eventVersion?: number; schemaVersion?: number };
    return raw.eventVersion ?? raw.schemaVersion ?? 0;
  } catch {
    return 0;
  }
}

export function envelopeFromOutbox(row: OutboxRecord): DurableEventEnvelope {
  return parseEnvelope(row.envelopeJson);
}

function safeParseTrace(envelopeJson: string): { correlationId: string | null; requestId: string | null } {
  try {
    const raw = JSON.parse(envelopeJson) as { correlationId?: string; requestId?: string };
    return {
      correlationId: raw.correlationId ?? null,
      requestId: raw.requestId ?? null,
    };
  } catch {
    return { correlationId: null, requestId: null };
  }
}
