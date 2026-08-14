import { createHash } from 'node:crypto';

import type { PoolClient } from 'pg';

import type { Account } from '../../../domain/src/account.ts';
import { catalogFor } from '../../../domain/src/account-class.ts';
import type { Product } from '../../../domain/src/product.ts';
import type { DomainEvent } from '../../../events/src/events.ts';
import type { LedgerAccount } from '../../../ledger/src/types.ts';
import type { ActionIntent } from '../../../permissions/src/action-intent.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import { canonicalJson } from '../canonical.ts';
import { logPersistenceEvent } from '../logging.ts';
import { intentFingerprint } from '../postgres/load.ts';
import type { PersistedOpenOutcome } from '../postgres/types.ts';

export async function upsertProduct(client: PoolClient, product: Product): Promise<void> {
  await client.query(
    `INSERT INTO ledger.product (
       id, name, account_class, currency, legal_entity_id, jurisdiction, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       status = EXCLUDED.status`,
    [
      product.id,
      product.name,
      product.accountClass,
      product.currency,
      product.legalEntityId,
      product.jurisdiction,
      product.status,
    ],
  );
}

export async function insertAccount(client: PoolClient, account: Account): Promise<void> {
  await client.query(
    `INSERT INTO ledger.account (
       id, owner_id, account_class, product_id, legal_entity_id,
       jurisdiction, currency, status, opened_at, version
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       version = EXCLUDED.version
     WHERE ledger.account.version <= EXCLUDED.version`,
    [
      account.id,
      account.ownerId,
      account.accountClass,
      account.productId,
      account.legalEntityId,
      account.jurisdiction,
      account.currency,
      account.status,
      account.openedAt,
      account.version,
    ],
  );
}

export async function insertLedgerAccount(
  client: PoolClient,
  account: LedgerAccount,
): Promise<void> {
  const ownership = catalogFor(account.accountClass).fundOwnership;
  await client.query(
    `INSERT INTO ledger.ledger_account (id, name, account_class, currency, owner_id, fund_ownership)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [account.id, account.name, account.accountClass, account.currency, account.ownerId ?? null, ownership],
  );
}

export async function insertIntent(client: PoolClient, intent: ActionIntent): Promise<void> {
  const payload = JSON.parse(canonicalJson(intent.payload)) as unknown;
  const existing = await client.query<{
    id: string;
    action_type: string;
    payload_canonical: unknown;
    actor_id: string;
    purpose: string;
  }>(
    `SELECT id, action_type, payload_canonical, actor_id, purpose
       FROM ledger.action_intent
      WHERE idempotency_key = $1 OR id = $2`,
    [intent.idempotencyKey, intent.id],
  );
  const row = existing.rows[0];
  if (row) {
    if (row.id !== intent.id && intentFingerprint({
      id: row.id as ActionIntent['id'],
      actionType: row.action_type,
      payload: row.payload_canonical,
      idempotencyKey: intent.idempotencyKey,
      actorId: row.actor_id,
      requestedAt: intent.requestedAt,
      purpose: row.purpose as ActionIntent['purpose'],
    }) !== intentFingerprint(intent)) {
      logPersistenceEvent({
        level: 'error',
        code: 'IDEMPOTENCY_CONFLICT',
        domain: 'ledger',
        message: 'idempotency key already bound to a different action intent',
        intentId: intent.id,
      });
      throw new Error('IDEMPOTENCY: idempotency key already bound to a different action intent');
    }
    return;
  }
  await client.query(
    `INSERT INTO ledger.action_intent (
       id, idempotency_key, action_type, actor_id, purpose, payload_canonical, requested_at, correlation_id
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      intent.id,
      intent.idempotencyKey,
      intent.actionType,
      intent.actorId,
      intent.purpose,
      JSON.stringify(payload),
      intent.requestedAt,
      intent.id,
    ],
  );
}

export async function insertAuthorityAudit(
  client: PoolClient,
  authority: ExecutionAuthority,
): Promise<void> {
  const signatureSha256 = createHash('sha256').update(authority.signature).digest('hex');
  await client.query(
    `INSERT INTO ledger.execution_authority_record (
       authority_id, action_type, account_id, intent_id, idempotency_key,
       amount_minor_units, amount_currency, issued_at, expires_at, signature_sha256
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (authority_id) DO NOTHING`,
    [
      authority.authorityId,
      authority.actionType,
      authority.accountId,
      authority.intentId,
      authority.idempotencyKey,
      authority.amountMinorUnits,
      authority.amountCurrency,
      authority.issuedAt,
      authority.expiresAt,
      signatureSha256,
    ],
  );
}

export async function insertOpenOutcome(
  client: PoolClient,
  outcome: PersistedOpenOutcome,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger.account_open_outcome (
       intent_id, outcome, account_id, decision_status, evidence_record_id, code, message, recorded_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (intent_id) DO NOTHING`,
    [
      outcome.intentId,
      outcome.outcome,
      outcome.accountId,
      outcome.decisionStatus,
      outcome.evidenceRecordId,
      outcome.code,
      outcome.message,
    ],
  );
}

export async function insertDomainEvent(client: PoolClient, event: DomainEvent): Promise<void> {
  await client.query(
    `INSERT INTO ledger.domain_event (event_type, schema_version, occurred_at, payload_canonical)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [event.eventType, event.schemaVersion, event.occurredAt, canonicalJson(event.payload)],
  );
}

export async function lockAccountForUpdate(client: PoolClient, accountId: string): Promise<void> {
  await client.query('SELECT id FROM ledger.account WHERE id = $1 FOR UPDATE', [accountId]);
}
