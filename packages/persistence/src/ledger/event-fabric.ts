import type { Pool, PoolClient } from 'pg';

import type { InboxStore } from '../../../events/src/consumer.ts';
import type { DeadLetterRecord, InboxRecord, OutboxRecord, OutboxState } from '../../../events/src/delivery.ts';
import type { DeadLetterStore, OutboxStore } from '../../../events/src/dispatcher.ts';
import {
  asEventId,
  parseEnvelope,
  serializeEnvelope,
  type DurableEventEnvelope,
  type EventId,
} from '../../../events/src/envelope.ts';
import type { DomainEvent } from '../../../events/src/events.ts';
import { isSealedEvent } from '../../../events/src/events.ts';
import type { EventCatalog } from '../../../events/src/replay.ts';
import { canonicalJson } from '../canonical.ts';

export async function insertSealedDomainEvent(
  client: PoolClient,
  event: DomainEvent,
): Promise<DurableEventEnvelope> {
  if (!isSealedEvent(event)) {
    throw new Error('durable outbox requires a sealed domain event envelope');
  }
  const envelopeJson = serializeEnvelope(event);
  await client.query(
    `INSERT INTO ledger.domain_event (
       event_type, schema_version, occurred_at, payload_canonical,
       event_id, event_version, aggregate_type, aggregate_id, aggregate_sequence,
       correlation_id, causation_id, intent_id, evidence_id, jurisdiction, cell_id,
       schema_ref, metadata_canonical, envelope_canonical,
       producer, actor_type, actor_id, subject_type, subject_id, environment, request_id
     ) VALUES (
       $1, $2, $3, $4::jsonb,
       $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14, $15,
       $16, $17::jsonb, $18::jsonb,
       $19, $20, $21, $22, $23, $24, $25
     )
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.eventType,
      event.schemaVersion,
      event.occurredAt,
      canonicalJson(event.payload),
      event.eventId,
      event.eventVersion,
      event.aggregateType,
      event.aggregateId,
      event.aggregateSequence,
      event.correlationId,
      event.causationId,
      event.intentId,
      event.evidenceId,
      event.jurisdiction,
      event.cellId,
      event.schemaRef,
      canonicalJson(event.metadata),
      envelopeJson,
      event.producer,
      event.actor?.type ?? null,
      event.actor?.id ?? null,
      event.subject?.type ?? null,
      event.subject?.id ?? null,
      event.environment,
      event.requestId,
    ],
  );
  await client.query(
    `INSERT INTO ledger.outbox (
       event_id, envelope_canonical, delivery_state, attempt_count,
       next_attempt_at, created_at
     ) VALUES ($1, $2::jsonb, 'PENDING', 0, $3, $3)
     ON CONFLICT (event_id) DO NOTHING`,
    [event.eventId, envelopeJson, event.occurredAt],
  );
  return event;
}

function mapOutbox(row: {
  event_id: string;
  envelope_canonical: unknown;
  delivery_state: OutboxState;
  attempt_count: number;
  next_attempt_at: Date;
  last_attempt_at: Date | null;
  last_error_code: string | null;
  last_error_safe: string | null;
  locked_by: string | null;
  locked_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
}): OutboxRecord {
  return {
    eventId: asEventId(row.event_id),
    envelopeJson:
      typeof row.envelope_canonical === 'string'
        ? row.envelope_canonical
        : JSON.stringify(row.envelope_canonical),
    deliveryState: row.delivery_state,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at.toISOString(),
    lastAttemptAt: row.last_attempt_at?.toISOString() ?? null,
    lastErrorCode: row.last_error_code,
    lastErrorSafe: row.last_error_safe,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at?.toISOString() ?? null,
    deliveredAt: row.delivered_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresOutboxStore implements OutboxStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async enqueue(record: OutboxRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger.outbox (
         event_id, envelope_canonical, delivery_state, attempt_count,
         next_attempt_at, created_at
       ) VALUES ($1, $2::jsonb, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        record.eventId,
        record.envelopeJson,
        record.deliveryState,
        record.attemptCount,
        record.nextAttemptAt,
        record.createdAt,
      ],
    );
  }

  async claimBatch(input: {
    readonly now: string;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  }): Promise<readonly OutboxRecord[]> {
    const result = await this.pool.query({
      text: `WITH claimed AS (
               SELECT event_id
                 FROM ledger.outbox
                WHERE (
                        delivery_state = 'PENDING'
                        AND next_attempt_at <= $1::timestamptz
                      )
                   OR (
                        delivery_state = 'IN_FLIGHT'
                        AND locked_at IS NOT NULL
                        AND locked_at <= $1::timestamptz - ($2::text || ' milliseconds')::interval
                      )
                ORDER BY next_attempt_at
                LIMIT $3
                FOR UPDATE SKIP LOCKED
             )
             UPDATE ledger.outbox o
                SET delivery_state = 'IN_FLIGHT',
                    locked_by = $4,
                    locked_at = $1::timestamptz
               FROM claimed
              WHERE o.event_id = claimed.event_id
              RETURNING o.*`,
      values: [input.now, String(input.leaseMs), input.limit, input.workerId],
    });
    return result.rows.map(mapOutbox);
  }

  async markDelivered(eventId: string, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.outbox
          SET delivery_state = 'DELIVERED',
              delivered_at = $2::timestamptz,
              locked_by = NULL,
              locked_at = NULL
        WHERE event_id = $1`,
      [eventId, now],
    );
  }

  async markRetry(input: {
    readonly eventId: string;
    readonly attemptCount: number;
    readonly nextAttemptAt: string;
    readonly lastAttemptAt: string;
    readonly code: string;
    readonly message: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.outbox
          SET delivery_state = 'PENDING',
              attempt_count = $2,
              next_attempt_at = $3::timestamptz,
              last_attempt_at = $4::timestamptz,
              last_error_code = $5,
              last_error_safe = $6,
              locked_by = NULL,
              locked_at = NULL
        WHERE event_id = $1`,
      [input.eventId, input.attemptCount, input.nextAttemptAt, input.lastAttemptAt, input.code, input.message],
    );
  }

  async markDeadLetter(eventId: string, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.outbox
          SET delivery_state = 'DEAD_LETTER',
              last_attempt_at = $2::timestamptz,
              locked_by = NULL,
              locked_at = NULL
        WHERE event_id = $1`,
      [eventId, now],
    );
  }

  async requeue(eventId: string, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.outbox
          SET delivery_state = 'PENDING',
              next_attempt_at = $2::timestamptz,
              locked_by = NULL,
              locked_at = NULL,
              delivered_at = NULL
        WHERE event_id = $1`,
      [eventId, now],
    );
  }

  async get(eventId: string): Promise<OutboxRecord | undefined> {
    const result = await this.pool.query(`SELECT * FROM ledger.outbox WHERE event_id = $1`, [eventId]);
    return result.rows[0] ? mapOutbox(result.rows[0]) : undefined;
  }

  async list(state?: OutboxState): Promise<readonly OutboxRecord[]> {
    const result = state
      ? await this.pool.query(`SELECT * FROM ledger.outbox WHERE delivery_state = $1 ORDER BY created_at`, [state])
      : await this.pool.query(`SELECT * FROM ledger.outbox ORDER BY created_at`);
    return result.rows.map(mapOutbox);
  }
}

export class PostgresInboxStore implements InboxStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async get(consumerId: string, eventId: EventId): Promise<InboxRecord | undefined> {
    const result = await this.pool.query(
      `SELECT * FROM ledger.inbox WHERE consumer_id = $1 AND event_id = $2`,
      [consumerId, eventId],
    );
    return result.rows[0] ? mapInbox(result.rows[0]) : undefined;
  }

  async tryBegin(consumerId: string, eventId: EventId, now: string): Promise<'begun' | 'duplicate'> {
    const existing = await this.get(consumerId, eventId);
    if (existing?.status === 'COMPLETED') {
      return 'duplicate';
    }
    await this.pool.query(
      `INSERT INTO ledger.inbox (
         consumer_id, event_id, first_seen_at, status, attempt_count
       ) VALUES ($1, $2, $3::timestamptz, 'PROCESSING', 1)
       ON CONFLICT (consumer_id, event_id) DO UPDATE SET
         status = CASE WHEN ledger.inbox.status = 'COMPLETED' THEN ledger.inbox.status ELSE 'PROCESSING' END,
         attempt_count = ledger.inbox.attempt_count + 1`,
      [consumerId, eventId, now],
    );
    const after = await this.get(consumerId, eventId);
    return after?.status === 'COMPLETED' ? 'duplicate' : 'begun';
  }

  async complete(consumerId: string, eventId: EventId, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.inbox
          SET status = 'COMPLETED', completed_at = $3::timestamptz
        WHERE consumer_id = $1 AND event_id = $2`,
      [consumerId, eventId, now],
    );
  }

  async fail(consumerId: string, eventId: EventId, code: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.inbox
          SET status = 'FAILED', last_error_code = $3, last_error_safe = $4
        WHERE consumer_id = $1 AND event_id = $2`,
      [consumerId, eventId, code, message],
    );
  }

  async resetForReplay(consumerId: string, eventId: EventId): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.inbox
          SET status = 'RECEIVED', completed_at = NULL
        WHERE consumer_id = $1 AND event_id = $2`,
      [consumerId, eventId],
    );
  }

  async list(consumerId?: string): Promise<readonly InboxRecord[]> {
    const result = consumerId
      ? await this.pool.query(`SELECT * FROM ledger.inbox WHERE consumer_id = $1`, [consumerId])
      : await this.pool.query(`SELECT * FROM ledger.inbox`);
    return result.rows.map(mapInbox);
  }
}

function mapInbox(row: {
  consumer_id: string;
  event_id: string;
  first_seen_at: Date;
  status: InboxRecord['status'];
  attempt_count: number;
  completed_at: Date | null;
  last_error_code: string | null;
  last_error_safe: string | null;
}): InboxRecord {
  return {
    consumerId: row.consumer_id,
    eventId: asEventId(row.event_id),
    firstSeenAt: row.first_seen_at.toISOString(),
    status: row.status,
    attemptCount: row.attempt_count,
    completedAt: row.completed_at?.toISOString() ?? null,
    lastErrorCode: row.last_error_code,
    lastErrorSafe: row.last_error_safe,
  };
}

export class PostgresDeadLetterStore implements DeadLetterStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async record(row: Omit<DeadLetterRecord, 'id'>): Promise<DeadLetterRecord> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO ledger.dead_letter (
         event_id, event_type, event_version, consumer_id, attempt_count,
         reason_code, reason_safe, created_at, error_class, correlation_id, request_id, last_attempt_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12::timestamptz)
       RETURNING id::text`,
      [
        row.eventId,
        row.eventType,
        row.eventVersion,
        row.consumerId,
        row.attemptCount,
        row.reasonCode,
        row.reasonSafe,
        row.createdAt,
        row.errorClass ?? null,
        row.correlationId ?? null,
        row.requestId ?? null,
        row.lastAttemptAt ?? row.createdAt,
      ],
    );
    return { ...row, id: result.rows[0]!.id };
  }

  async list(): Promise<readonly DeadLetterRecord[]> {
    const result = await this.pool.query(
      `SELECT id::text AS id, event_id, event_type, event_version, consumer_id,
              attempt_count, reason_code, reason_safe, created_at, replayed_at,
              error_class, correlation_id, request_id, last_attempt_at
         FROM ledger.dead_letter ORDER BY id`,
    );
    return result.rows.map(mapDeadLetter);
  }

  async markReplayed(eventId: string, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.dead_letter SET replayed_at = $2::timestamptz WHERE event_id = $1 AND replayed_at IS NULL`,
      [eventId, now],
    );
  }

  async getByEventId(eventId: string): Promise<DeadLetterRecord | undefined> {
    const result = await this.pool.query(
      `SELECT id::text AS id, event_id, event_type, event_version, consumer_id,
              attempt_count, reason_code, reason_safe, created_at, replayed_at,
              error_class, correlation_id, request_id, last_attempt_at
         FROM ledger.dead_letter WHERE event_id = $1 ORDER BY id DESC LIMIT 1`,
      [eventId],
    );
    return result.rows[0] ? mapDeadLetter(result.rows[0]) : undefined;
  }
}

function mapDeadLetter(row: {
  id: string;
  event_id: string;
  event_type: string;
  event_version: number;
  consumer_id: string | null;
  attempt_count: number;
  reason_code: string;
  reason_safe: string;
  created_at: Date;
  replayed_at: Date | null;
  error_class?: string | null;
  correlation_id?: string | null;
  request_id?: string | null;
  last_attempt_at?: Date | null;
}): DeadLetterRecord {
  return {
    id: row.id,
    eventId: asEventId(row.event_id),
    eventType: row.event_type,
    eventVersion: row.event_version,
    consumerId: row.consumer_id,
    attemptCount: row.attempt_count,
    reasonCode: row.reason_code,
    reasonSafe: row.reason_safe,
    errorClass: row.error_class ?? null,
    correlationId: row.correlation_id ?? null,
    requestId: row.request_id ?? null,
    lastAttemptAt: row.last_attempt_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    replayedAt: row.replayed_at?.toISOString() ?? null,
  };
}

export class PostgresEventCatalog implements EventCatalog {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async get(eventId: string): Promise<DurableEventEnvelope | undefined> {
    const result = await this.pool.query(
      `SELECT envelope_canonical FROM ledger.domain_event WHERE event_id = $1`,
      [eventId],
    );
    if (!result.rows[0]) {
      return undefined;
    }
    return parseStoredEnvelope(result.rows[0].envelope_canonical);
  }

  async list(): Promise<readonly DurableEventEnvelope[]> {
    const result = await this.pool.query(
      `SELECT envelope_canonical FROM ledger.domain_event ORDER BY id`,
    );
    return result.rows.map((row) => parseStoredEnvelope(row.envelope_canonical));
  }
}

function parseStoredEnvelope(value: unknown): DurableEventEnvelope {
  if (typeof value === 'string') {
    return parseEnvelope(value);
  }
  return parseEnvelope(JSON.stringify(value));
}
