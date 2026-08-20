import type { Pool, PoolClient } from 'pg';

import { computeRequestDigest } from '../../../events/src/operation/digest.ts';
import {
  IDEMPOTENCY_PAYLOAD_MISMATCH,
  freezeOperation,
  type IdempotencyConflict,
  type OperationExecutionRecord,
  type OperationState,
  type PrepareDraft,
} from '../../../events/src/operation/types.ts';
import type { OperationStore } from '../../../events/src/operation/store.ts';

type OperationRow = {
  operation_id: string;
  operation_kind: string;
  business_key: string;
  idempotency_key: string;
  request_digest: string;
  correlation_id: string | null;
  causation_id: string | null;
  intent_id: string | null;
  evidence_id: string | null;
  provider_id: string;
  provider_operation_ref: string | null;
  state: OperationState;
  attempt_count: number;
  attempt_lineage: string;
  supersedes_operation_id: string | null;
  native_asset_id: string | null;
  prepared_at: Date;
  first_submitted_at: Date | null;
  last_observed_at: Date | null;
  confirmed_at: Date | null;
  last_safe_error_code: string | null;
  last_safe_error_message: string | null;
  revision: number;
  lease_owner: string | null;
  lease_until: Date | null;
};

function mapRow(row: OperationRow): OperationExecutionRecord {
  return freezeOperation({
    operationId: row.operation_id,
    operationKind: row.operation_kind,
    businessKey: row.business_key,
    idempotencyKey: row.idempotency_key,
    requestDigest: row.request_digest,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    intentId: row.intent_id,
    evidenceId: row.evidence_id,
    providerId: row.provider_id,
    providerOperationRef: row.provider_operation_ref,
    state: row.state,
    attemptCount: row.attempt_count,
    attemptLineage: row.attempt_lineage,
    supersedesOperationId: row.supersedes_operation_id,
    nativeAssetId: row.native_asset_id,
    preparedAt: row.prepared_at.toISOString(),
    firstSubmittedAt: row.first_submitted_at?.toISOString() ?? null,
    lastObservedAt: row.last_observed_at?.toISOString() ?? null,
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
    lastSafeErrorCode: row.last_safe_error_code,
    lastSafeErrorMessage: row.last_safe_error_message,
    revision: row.revision,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until?.toISOString() ?? null,
  });
}

const SELECT_COLUMNS = `
  operation_id, operation_kind, business_key, idempotency_key, request_digest,
  correlation_id, causation_id, intent_id, evidence_id, provider_id,
  provider_operation_ref, state, attempt_count, attempt_lineage,
  supersedes_operation_id, native_asset_id, prepared_at, first_submitted_at,
  last_observed_at, confirmed_at, last_safe_error_code, last_safe_error_message,
  revision, lease_owner, lease_until
`;

export async function insertOperationExecution(
  client: PoolClient,
  record: OperationExecutionRecord,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger.operation_execution (
       operation_id, operation_kind, business_key, idempotency_key, request_digest,
       correlation_id, causation_id, intent_id, evidence_id, provider_id,
       provider_operation_ref, state, attempt_count, attempt_lineage,
       supersedes_operation_id, native_asset_id, prepared_at, first_submitted_at,
       last_observed_at, confirmed_at, last_safe_error_code, last_safe_error_message,
       revision, lease_owner, lease_until
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
     )
     ON CONFLICT (operation_id) DO NOTHING`,
    [
      record.operationId,
      record.operationKind,
      record.businessKey,
      record.idempotencyKey,
      record.requestDigest,
      record.correlationId,
      record.causationId,
      record.intentId,
      record.evidenceId,
      record.providerId,
      record.providerOperationRef,
      record.state,
      record.attemptCount,
      record.attemptLineage,
      record.supersedesOperationId,
      record.nativeAssetId,
      record.preparedAt,
      record.firstSubmittedAt,
      record.lastObservedAt,
      record.confirmedAt,
      record.lastSafeErrorCode,
      record.lastSafeErrorMessage,
      record.revision,
      record.leaseOwner,
      record.leaseUntil,
    ],
  );
}

export class PostgresOperationStore implements OperationStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async prepare(draft: PrepareDraft): Promise<OperationExecutionRecord | IdempotencyConflict> {
    const requestDigest = computeRequestDigest(draft.digest);
    const existing = await this.getByIdempotencyKey(draft.digest.providerId, draft.idempotencyKey);
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        return Object.freeze({
          code: IDEMPOTENCY_PAYLOAD_MISMATCH,
          existing,
          requestedDigest: requestDigest,
        });
      }
      return existing;
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
    const client = await this.pool.connect();
    try {
      await insertOperationExecution(client, record);
    } finally {
      client.release();
    }
    return (await this.get(record.operationId)) ?? record;
  }

  async get(operationId: string): Promise<OperationExecutionRecord | undefined> {
    const result = await this.pool.query<OperationRow>(
      `SELECT ${SELECT_COLUMNS} FROM ledger.operation_execution WHERE operation_id = $1`,
      [operationId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async getByIdempotencyKey(
    providerId: string,
    idempotencyKey: string,
  ): Promise<OperationExecutionRecord | undefined> {
    const result = await this.pool.query<OperationRow>(
      `SELECT ${SELECT_COLUMNS}
         FROM ledger.operation_execution
        WHERE provider_id = $1 AND idempotency_key = $2`,
      [providerId, idempotencyKey],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async getByBusinessKey(
    operationKind: string,
    businessKey: string,
  ): Promise<OperationExecutionRecord | undefined> {
    const result = await this.pool.query<OperationRow>(
      `SELECT ${SELECT_COLUMNS}
         FROM ledger.operation_execution
        WHERE operation_kind = $1 AND business_key = $2
        ORDER BY revision DESC
        LIMIT 1`,
      [operationKind, businessKey],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async update(record: OperationExecutionRecord): Promise<OperationExecutionRecord> {
    const result = await this.pool.query<OperationRow>(
      `UPDATE ledger.operation_execution SET
         state = $2,
         provider_operation_ref = $3,
         attempt_count = $4,
         first_submitted_at = $5,
         last_observed_at = $6,
         confirmed_at = $7,
         last_safe_error_code = $8,
         last_safe_error_message = $9,
         evidence_id = $10,
         revision = revision + 1,
         lease_owner = $11,
         lease_until = $12
       WHERE operation_id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        record.operationId,
        record.state,
        record.providerOperationRef,
        record.attemptCount,
        record.firstSubmittedAt,
        record.lastObservedAt,
        record.confirmedAt,
        record.lastSafeErrorCode,
        record.lastSafeErrorMessage,
        record.evidenceId,
        record.leaseOwner,
        record.leaseUntil,
      ],
    );
    if (!result.rows[0]) {
      throw new Error(`operation ${record.operationId} is not persisted`);
    }
    return mapRow(result.rows[0]);
  }

  async listByState(states: readonly OperationState[]): Promise<readonly OperationExecutionRecord[]> {
    const result = await this.pool.query<OperationRow>(
      `SELECT ${SELECT_COLUMNS}
         FROM ledger.operation_execution
        WHERE state = ANY($1::text[])`,
      [states],
    );
    return result.rows.map(mapRow);
  }

  async claimLease(input: {
    readonly operationId: string;
    readonly workerId: string;
    readonly now: string;
    readonly leaseMs: number;
  }): Promise<'acquired' | 'held'> {
    const result = await this.pool.query({
      text: `WITH claimed AS (
               SELECT operation_id
                 FROM ledger.operation_execution
                WHERE operation_id = $1
                  AND (
                    lease_owner IS NULL
                    OR lease_until IS NULL
                    OR lease_until <= $2::timestamptz
                    OR lease_owner = $3
                  )
                FOR UPDATE SKIP LOCKED
             )
             UPDATE ledger.operation_execution o
                SET lease_owner = $3,
                    lease_until = $2::timestamptz + ($4::text || ' milliseconds')::interval,
                    revision = o.revision + 1
               FROM claimed
              WHERE o.operation_id = claimed.operation_id
              RETURNING o.operation_id`,
      values: [input.operationId, input.now, input.workerId, String(input.leaseMs)],
    });
    return (result.rowCount ?? 0) > 0 ? 'acquired' : 'held';
  }

  async releaseLease(operationId: string, workerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ledger.operation_execution
          SET lease_owner = NULL, lease_until = NULL, revision = revision + 1
        WHERE operation_id = $1 AND lease_owner = $2`,
      [operationId, workerId],
    );
  }
}
