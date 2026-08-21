import type { Pool } from 'pg';

import type { JobRecord, JobState, JobStore } from '../../../events/src/jobs.ts';
import type { RetryClass } from '../../../events/src/retry.ts';
import type {
  InboundWebhookReceipt,
  InboundWebhookStore,
  OutboundWebhookDelivery,
  OutboundWebhookStore,
  OutboundWebhookSubscription,
} from '../../../events/src/webhooks.ts';
import type { WorkflowRecord, WorkflowState, WorkflowStore } from '../../../events/src/workflow.ts';
import { canonicalJson } from '../canonical.ts';

export class PostgresJobStore implements JobStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async enqueue(job: JobRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger.async_job (
         job_id, job_type, state, payload_canonical, scheduled_at, available_at,
         attempt_count, max_attempts, timeout_ms, last_attempt_at, last_error_class,
         last_error_safe, correlation_id, causation_id, request_id, locked_by, locked_at,
         cancelled_at, completed_at, created_at
       ) VALUES (
         $1, $2, $3, $4::jsonb, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17,
         $18, $19, $20
       )
       ON CONFLICT (job_id) DO NOTHING`,
      [
        job.jobId,
        job.jobType,
        job.state,
        canonicalJson(job.payload),
        job.scheduledAt,
        job.availableAt,
        job.attemptCount,
        job.maxAttempts,
        job.timeoutMs,
        job.lastAttemptAt,
        job.lastErrorClass,
        job.lastErrorSafe,
        job.correlationId,
        job.causationId,
        job.requestId,
        job.lockedBy,
        job.lockedAt,
        job.cancelledAt,
        job.completedAt,
        job.createdAt,
      ],
    );
  }

  async claimDue(input: {
    readonly now: string;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  }): Promise<readonly JobRecord[]> {
    const result = await this.pool.query({
      text: `WITH claimed AS (
               SELECT job_id
                 FROM ledger.async_job
                WHERE (
                        state IN ('PENDING', 'SCHEDULED', 'FAILED')
                        AND available_at <= $1::timestamptz
                      )
                   OR (
                        state = 'RUNNING'
                        AND locked_at IS NOT NULL
                        AND locked_at <= $1::timestamptz - ($2::text || ' milliseconds')::interval
                      )
                ORDER BY available_at
                LIMIT $3
                FOR UPDATE SKIP LOCKED
             )
             UPDATE ledger.async_job j
                SET state = 'RUNNING',
                    locked_by = $4,
                    locked_at = $1::timestamptz
               FROM claimed
              WHERE j.job_id = claimed.job_id
              RETURNING j.*`,
      values: [input.now, String(input.leaseMs), input.limit, input.workerId],
    });
    return result.rows.map(mapJob);
  }

  async markSucceeded(jobId: string, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.async_job
          SET state = 'SUCCEEDED', completed_at = $2::timestamptz, locked_by = NULL, locked_at = NULL
        WHERE job_id = $1`,
      [jobId, now],
    );
  }

  async markRetry(input: {
    readonly jobId: string;
    readonly attemptCount: number;
    readonly availableAt: string;
    readonly lastAttemptAt: string;
    readonly errorClass: RetryClass;
    readonly message: string;
    readonly state: 'PENDING' | 'FAILED';
  }): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.async_job
          SET state = $2,
              attempt_count = $3,
              available_at = $4::timestamptz,
              last_attempt_at = $5::timestamptz,
              last_error_class = $6,
              last_error_safe = $7,
              locked_by = NULL,
              locked_at = NULL
        WHERE job_id = $1`,
      [
        input.jobId,
        input.state,
        input.attemptCount,
        input.availableAt,
        input.lastAttemptAt,
        input.errorClass,
        input.message,
      ],
    );
  }

  async markDeadLetter(input: {
    readonly jobId: string;
    readonly lastAttemptAt: string;
    readonly errorClass: RetryClass;
    readonly message: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.async_job
          SET state = 'DEAD_LETTER',
              last_attempt_at = $2::timestamptz,
              last_error_class = $3,
              last_error_safe = $4,
              locked_by = NULL,
              locked_at = NULL
        WHERE job_id = $1`,
      [input.jobId, input.lastAttemptAt, input.errorClass, input.message],
    );
  }

  async cancel(jobId: string, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.async_job
          SET state = 'CANCELLED', cancelled_at = $2::timestamptz, locked_by = NULL, locked_at = NULL
        WHERE job_id = $1 AND state NOT IN ('SUCCEEDED', 'DEAD_LETTER')`,
      [jobId, now],
    );
  }

  async replay(jobId: string, now: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.async_job
          SET state = 'PENDING',
              available_at = $2::timestamptz,
              locked_by = NULL,
              locked_at = NULL,
              completed_at = NULL,
              cancelled_at = NULL
        WHERE job_id = $1`,
      [jobId, now],
    );
  }

  async get(jobId: string): Promise<JobRecord | undefined> {
    const result = await this.pool.query(`SELECT * FROM ledger.async_job WHERE job_id = $1`, [jobId]);
    return result.rows[0] ? mapJob(result.rows[0]) : undefined;
  }

  async list(state?: JobState): Promise<readonly JobRecord[]> {
    const result = state
      ? await this.pool.query(`SELECT * FROM ledger.async_job WHERE state = $1 ORDER BY created_at`, [state])
      : await this.pool.query(`SELECT * FROM ledger.async_job ORDER BY created_at`);
    return result.rows.map(mapJob);
  }

  async snapshot(): Promise<readonly JobRecord[]> {
    return this.list();
  }

  async restore(rows: readonly JobRecord[]): Promise<void> {
    for (const row of rows) {
      await this.enqueue(row);
    }
  }
}

export class PostgresWorkflowStore implements WorkflowStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async insert(record: WorkflowRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger.async_workflow (
         workflow_id, workflow_type, state, current_step, history_canonical, context_canonical,
         correlation_id, causation_id, request_id, waiting_since, timeout_at, attempt_count,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5::jsonb, $6::jsonb,
         $7, $8, $9, $10, $11, $12,
         $13, $14
       )
       ON CONFLICT (workflow_id) DO NOTHING`,
      bindWorkflow(record),
    );
  }

  async save(record: WorkflowRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger.async_workflow (
         workflow_id, workflow_type, state, current_step, history_canonical, context_canonical,
         correlation_id, causation_id, request_id, waiting_since, timeout_at, attempt_count,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5::jsonb, $6::jsonb,
         $7, $8, $9, $10, $11, $12,
         $13, $14
       )
       ON CONFLICT (workflow_id) DO UPDATE SET
         state = EXCLUDED.state,
         current_step = EXCLUDED.current_step,
         history_canonical = EXCLUDED.history_canonical,
         context_canonical = EXCLUDED.context_canonical,
         waiting_since = EXCLUDED.waiting_since,
         timeout_at = EXCLUDED.timeout_at,
         attempt_count = EXCLUDED.attempt_count,
         updated_at = EXCLUDED.updated_at`,
      bindWorkflow(record),
    );
  }

  async get(workflowId: string): Promise<WorkflowRecord | undefined> {
    const result = await this.pool.query(`SELECT * FROM ledger.async_workflow WHERE workflow_id = $1`, [
      workflowId,
    ]);
    return result.rows[0] ? mapWorkflow(result.rows[0]) : undefined;
  }

  async list(state?: WorkflowState): Promise<readonly WorkflowRecord[]> {
    const result = state
      ? await this.pool.query(`SELECT * FROM ledger.async_workflow WHERE state = $1 ORDER BY created_at`, [state])
      : await this.pool.query(`SELECT * FROM ledger.async_workflow ORDER BY created_at`);
    return result.rows.map(mapWorkflow);
  }

  async snapshot(): Promise<readonly WorkflowRecord[]> {
    return this.list();
  }

  async restore(rows: readonly WorkflowRecord[]): Promise<void> {
    for (const row of rows) {
      await this.save(row);
    }
  }
}

export class PostgresInboundWebhookStore implements InboundWebhookStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getByProviderEvent(
    providerId: string,
    providerEventId: string,
  ): Promise<InboundWebhookReceipt | undefined> {
    const result = await this.pool.query(
      `SELECT * FROM ledger.inbound_webhook WHERE provider_id = $1 AND provider_event_id = $2`,
      [providerId, providerEventId],
    );
    return result.rows[0] ? mapInbound(result.rows[0]) : undefined;
  }

  async insert(receipt: InboundWebhookReceipt): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger.inbound_webhook (
         receipt_id, provider_id, provider_event_id, event_type, received_at, raw_body_hash,
         status, reject_code, correlation_id, request_id, processed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (provider_id, provider_event_id) DO NOTHING`,
      [
        receipt.receiptId,
        receipt.providerId,
        receipt.providerEventId,
        receipt.eventType,
        receipt.receivedAt,
        receipt.rawBodyHash,
        receipt.status,
        receipt.rejectCode,
        receipt.correlationId,
        receipt.requestId,
        receipt.processedAt,
      ],
    );
  }

  async markProcessed(receiptId: string, now: string): Promise<void> {
    await this.pool.query(`UPDATE ledger.inbound_webhook SET processed_at = $2::timestamptz WHERE receipt_id = $1`, [
      receiptId,
      now,
    ]);
  }

  async list(): Promise<readonly InboundWebhookReceipt[]> {
    const result = await this.pool.query(`SELECT * FROM ledger.inbound_webhook ORDER BY received_at`);
    return result.rows.map(mapInbound);
  }

  async snapshot(): Promise<readonly InboundWebhookReceipt[]> {
    return this.list();
  }

  async restore(rows: readonly InboundWebhookReceipt[]): Promise<void> {
    for (const row of rows) {
      await this.insert(row);
    }
  }
}

export class PostgresOutboundWebhookStore implements OutboundWebhookStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async putSubscription(row: OutboundWebhookSubscription): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger.outbound_webhook_subscription (
         subscription_id, owner_id, destination_url, secret_ref, event_filter, active,
         consecutive_failures, failure_threshold, disabled_at, created_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
       ON CONFLICT (subscription_id) DO UPDATE SET
         destination_url = EXCLUDED.destination_url,
         secret_ref = EXCLUDED.secret_ref,
         event_filter = EXCLUDED.event_filter,
         active = EXCLUDED.active,
         consecutive_failures = EXCLUDED.consecutive_failures,
         failure_threshold = EXCLUDED.failure_threshold,
         disabled_at = EXCLUDED.disabled_at`,
      [
        row.subscriptionId,
        row.ownerId,
        row.destinationUrl,
        row.secretRef,
        canonicalJson(row.eventFilter),
        row.active,
        row.consecutiveFailures,
        row.failureThreshold,
        row.disabledAt,
        row.createdAt,
      ],
    );
  }

  async getSubscription(subscriptionId: string): Promise<OutboundWebhookSubscription | undefined> {
    const result = await this.pool.query(
      `SELECT * FROM ledger.outbound_webhook_subscription WHERE subscription_id = $1`,
      [subscriptionId],
    );
    return result.rows[0] ? mapSubscription(result.rows[0]) : undefined;
  }

  async listSubscriptions(ownerId?: string): Promise<readonly OutboundWebhookSubscription[]> {
    const result = ownerId
      ? await this.pool.query(
          `SELECT * FROM ledger.outbound_webhook_subscription WHERE owner_id = $1 ORDER BY created_at`,
          [ownerId],
        )
      : await this.pool.query(`SELECT * FROM ledger.outbound_webhook_subscription ORDER BY created_at`);
    return result.rows.map(mapSubscription);
  }

  async putDelivery(row: OutboundWebhookDelivery): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger.outbound_webhook_delivery (
         delivery_id, subscription_id, event_id, event_type, attempt_count, state,
         last_attempt_at, next_attempt_at, last_error_class, last_error_safe, body_hash,
         signature, correlation_id, request_id, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15
       )
       ON CONFLICT (delivery_id) DO UPDATE SET
         attempt_count = EXCLUDED.attempt_count,
         state = EXCLUDED.state,
         last_attempt_at = EXCLUDED.last_attempt_at,
         next_attempt_at = EXCLUDED.next_attempt_at,
         last_error_class = EXCLUDED.last_error_class,
         last_error_safe = EXCLUDED.last_error_safe,
         body_hash = EXCLUDED.body_hash,
         signature = EXCLUDED.signature`,
      [
        row.deliveryId,
        row.subscriptionId,
        row.eventId,
        row.eventType,
        row.attemptCount,
        row.state,
        row.lastAttemptAt,
        row.nextAttemptAt,
        row.lastErrorClass,
        row.lastErrorSafe,
        row.bodyHash,
        row.signature,
        row.correlationId,
        row.requestId,
        row.createdAt,
      ],
    );
  }

  async getDelivery(deliveryId: string): Promise<OutboundWebhookDelivery | undefined> {
    const result = await this.pool.query(
      `SELECT * FROM ledger.outbound_webhook_delivery WHERE delivery_id = $1`,
      [deliveryId],
    );
    return result.rows[0] ? mapDelivery(result.rows[0]) : undefined;
  }

  async listDeliveries(subscriptionId?: string): Promise<readonly OutboundWebhookDelivery[]> {
    const result = subscriptionId
      ? await this.pool.query(
          `SELECT * FROM ledger.outbound_webhook_delivery WHERE subscription_id = $1 ORDER BY created_at`,
          [subscriptionId],
        )
      : await this.pool.query(`SELECT * FROM ledger.outbound_webhook_delivery ORDER BY created_at`);
    return result.rows.map(mapDelivery);
  }

  async snapshot(): Promise<{
    readonly subscriptions: readonly OutboundWebhookSubscription[];
    readonly deliveries: readonly OutboundWebhookDelivery[];
  }> {
    return {
      subscriptions: await this.listSubscriptions(),
      deliveries: await this.listDeliveries(),
    };
  }

  async restore(snapshot: {
    readonly subscriptions: readonly OutboundWebhookSubscription[];
    readonly deliveries: readonly OutboundWebhookDelivery[];
  }): Promise<void> {
    for (const row of snapshot.subscriptions) {
      await this.putSubscription(row);
    }
    for (const row of snapshot.deliveries) {
      await this.putDelivery(row);
    }
  }
}

function bindWorkflow(record: WorkflowRecord): unknown[] {
  return [
    record.workflowId,
    record.workflowType,
    record.state,
    record.currentStep,
    canonicalJson(record.history),
    canonicalJson(record.context),
    record.correlationId,
    record.causationId,
    record.requestId,
    record.waitingSince,
    record.timeoutAt,
    record.attemptCount,
    record.createdAt,
    record.updatedAt,
  ];
}

function mapJob(row: Record<string, unknown>): JobRecord {
  return {
    jobId: String(row.job_id),
    jobType: String(row.job_type),
    state: row.state as JobState,
    payload: asObject(row.payload_canonical),
    scheduledAt: asIso(row.scheduled_at),
    availableAt: asIso(row.available_at),
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
    timeoutMs: Number(row.timeout_ms),
    lastAttemptAt: row.last_attempt_at ? asIso(row.last_attempt_at) : null,
    lastErrorClass: (row.last_error_class as RetryClass | null) ?? null,
    lastErrorSafe: (row.last_error_safe as string | null) ?? null,
    correlationId: String(row.correlation_id),
    causationId: (row.causation_id as string | null) ?? null,
    requestId: (row.request_id as string | null) ?? null,
    lockedBy: (row.locked_by as string | null) ?? null,
    lockedAt: row.locked_at ? asIso(row.locked_at) : null,
    cancelledAt: row.cancelled_at ? asIso(row.cancelled_at) : null,
    completedAt: row.completed_at ? asIso(row.completed_at) : null,
    createdAt: asIso(row.created_at),
  };
}

function mapWorkflow(row: Record<string, unknown>): WorkflowRecord {
  return {
    workflowId: String(row.workflow_id),
    workflowType: String(row.workflow_type),
    state: row.state as WorkflowState,
    currentStep: String(row.current_step),
    history: asArray(row.history_canonical) as WorkflowRecord['history'],
    context: asObject(row.context_canonical),
    correlationId: String(row.correlation_id),
    causationId: (row.causation_id as string | null) ?? null,
    requestId: (row.request_id as string | null) ?? null,
    waitingSince: row.waiting_since ? asIso(row.waiting_since) : null,
    timeoutAt: row.timeout_at ? asIso(row.timeout_at) : null,
    attemptCount: Number(row.attempt_count),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function mapInbound(row: Record<string, unknown>): InboundWebhookReceipt {
  return {
    receiptId: String(row.receipt_id),
    providerId: String(row.provider_id),
    providerEventId: String(row.provider_event_id),
    eventType: String(row.event_type),
    receivedAt: asIso(row.received_at),
    rawBodyHash: String(row.raw_body_hash),
    status: row.status as InboundWebhookReceipt['status'],
    rejectCode: (row.reject_code as string | null) ?? null,
    correlationId: String(row.correlation_id),
    requestId: (row.request_id as string | null) ?? null,
    processedAt: row.processed_at ? asIso(row.processed_at) : null,
  };
}

function mapSubscription(row: Record<string, unknown>): OutboundWebhookSubscription {
  return {
    subscriptionId: String(row.subscription_id),
    ownerId: String(row.owner_id),
    destinationUrl: String(row.destination_url),
    secretRef: String(row.secret_ref),
    eventFilter: asArray(row.event_filter) as readonly string[],
    active: Boolean(row.active),
    consecutiveFailures: Number(row.consecutive_failures),
    failureThreshold: Number(row.failure_threshold),
    disabledAt: row.disabled_at ? asIso(row.disabled_at) : null,
    createdAt: asIso(row.created_at),
  };
}

function mapDelivery(row: Record<string, unknown>): OutboundWebhookDelivery {
  return {
    deliveryId: String(row.delivery_id),
    subscriptionId: String(row.subscription_id),
    eventId: String(row.event_id),
    eventType: String(row.event_type),
    attemptCount: Number(row.attempt_count),
    state: row.state as OutboundWebhookDelivery['state'],
    lastAttemptAt: row.last_attempt_at ? asIso(row.last_attempt_at) : null,
    nextAttemptAt: asIso(row.next_attempt_at),
    lastErrorClass: (row.last_error_class as RetryClass | null) ?? null,
    lastErrorSafe: (row.last_error_safe as string | null) ?? null,
    bodyHash: String(row.body_hash),
    signature: String(row.signature),
    correlationId: String(row.correlation_id),
    requestId: (row.request_id as string | null) ?? null,
    createdAt: asIso(row.created_at),
  };
}

function asIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function asObject(value: unknown): Readonly<Record<string, string>> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Readonly<Record<string, string>>;
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as Readonly<Record<string, string>>;
  }
  return {};
}

function asArray(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as readonly unknown[];
  }
  return [];
}
