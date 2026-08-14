import type { Pool, PoolClient } from 'pg';

import type { Customer } from '../../../domain/src/customer.ts';
import type { LegalEntity } from '../../../domain/src/legal-entity.ts';
import type { EvidenceRecord } from '../../../evidence/src/vault.ts';
import { canonicalJson } from '../canonical.ts';

export async function upsertLegalEntity(client: PoolClient, entity: LegalEntity): Promise<void> {
  await client.query(
    `INSERT INTO customer.legal_entity (id, name, jurisdiction, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       jurisdiction = EXCLUDED.jurisdiction,
       status = EXCLUDED.status`,
    [entity.id, entity.name, entity.jurisdiction, entity.status],
  );
}

export async function upsertCustomer(client: PoolClient, customer: Customer): Promise<void> {
  await client.query(
    `INSERT INTO customer.customer (
       id, legal_entity_id, jurisdiction, residency, status,
       kyc_state, kyc_record_version, refresh_by, created_at, version
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       kyc_state = EXCLUDED.kyc_state,
       kyc_record_version = EXCLUDED.kyc_record_version,
       refresh_by = EXCLUDED.refresh_by,
       version = EXCLUDED.version
     WHERE customer.customer.version <= EXCLUDED.version`,
    [
      customer.id,
      customer.legalEntityId,
      customer.jurisdiction,
      customer.residency,
      customer.status,
      customer.verification.kycState,
      customer.verification.kycRecordVersion,
      customer.verification.refreshBy,
      customer.createdAt,
      customer.version,
    ],
  );
}

export async function insertEvidenceRecord(
  client: PoolClient,
  record: EvidenceRecord,
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(872514001)');
  await client.query(
    `INSERT INTO evidence.evidence_record (
       seq, evidence_id, kind, payload_canonical, payload_sha256,
       prev_record_sha256, record_sha256, sealed_at
     ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
    [
      record.seq,
      record.evidenceId,
      record.kind,
      canonicalJson(record.payload),
      record.payloadSha256,
      record.prevRecordSha256,
      record.recordSha256,
      record.sealedAt,
    ],
  );
}

export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // already failed
    }
    throw error;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

export function isReadOnlyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: string }).code;
  // 25006 = trigger RAISE read_only_sql_transaction
  // 42501 = UPDATE/DELETE not granted to the runtime role
  return code === '25006' || code === '42501';
}
