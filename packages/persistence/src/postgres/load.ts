import type { Pool } from 'pg';

import { asAccountId, type Account } from '../../../domain/src/account.ts';
import type { AccountClass } from '../../../domain/src/account-class.ts';
import { asCurrencyCode } from '../../../domain/src/currency.ts';
import {
  asCustomerId,
  type Customer,
  type CustomerStatus,
  type KycState,
} from '../../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../../domain/src/jurisdiction.ts';
import { asLegalEntityId, type LegalEntity } from '../../../domain/src/legal-entity.ts';
import { asProductId, type Product } from '../../../domain/src/product.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceRecord } from '../../../evidence/src/vault.ts';
import type { DomainEvent } from '../../../events/src/events.ts';
import { parseEnvelope } from '../../../events/src/envelope.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import type { LedgerAmount } from '../../../money/src/ledger-amount.ts';
import { Money } from '../../../money/src/money.ts';
import type { Journal, LedgerAccount, Posting } from '../../../ledger/src/types.ts';
import { asIntentId, type ActionIntent } from '../../../permissions/src/action-intent.ts';
import { canonicalJson } from '../canonical.ts';
import { loadPolicyState } from '../policy/store.ts';
import type { PersistencePools } from './pools.ts';
import type { AuthorityAudit, LoadedPersistence, PersistedOpenOutcome } from './types.ts';

export async function loadPersistedState(pools: PersistencePools): Promise<LoadedPersistence> {
  const [customerSide, ledgerSide, evidence, policy] = await Promise.all([
    loadCustomerDatabase(pools.customer),
    loadLedgerDatabase(pools.ledger),
    loadEvidenceRecords(pools.evidence),
    loadPolicyState(pools.customer),
  ]);
  return {
    ...customerSide,
    ...ledgerSide,
    evidence,
    policy,
  };
}

async function loadCustomerDatabase(pool: Pool): Promise<{
  customers: Customer[];
  legalEntities: LegalEntity[];
}> {
  const [customers, legalEntities] = await Promise.all([
    pool.query<{
      id: string;
      legal_entity_id: string;
      jurisdiction: string;
      residency: string;
      status: CustomerStatus;
      kyc_state: KycState;
      kyc_record_version: number;
      refresh_by: Date;
      created_at: Date;
      version: number;
    }>(
      `SELECT id, legal_entity_id, jurisdiction, residency, status, kyc_state,
              kyc_record_version, refresh_by, created_at, version
         FROM customer.customer`,
    ),
    pool.query<{
      id: string;
      name: string;
      jurisdiction: string;
      status: 'ACTIVE' | 'INACTIVE';
    }>(`SELECT id, name, jurisdiction, status FROM customer.legal_entity`),
  ]);
  return {
    customers: customers.rows.map((row) =>
      Object.freeze({
        id: asCustomerId(row.id),
        legalEntityId: asLegalEntityId(row.legal_entity_id),
        jurisdiction: asJurisdiction(row.jurisdiction.trim()),
        residency: asResidency(row.residency.trim()),
        status: row.status,
        verification: Object.freeze({
          kycState: row.kyc_state,
          kycRecordVersion: row.kyc_record_version,
          refreshBy: asUtcInstant(row.refresh_by.toISOString()),
        }),
        createdAt: asUtcInstant(row.created_at.toISOString()),
        version: row.version,
      }),
    ),
    legalEntities: legalEntities.rows.map((row) =>
      Object.freeze({
        id: asLegalEntityId(row.id),
        name: row.name,
        jurisdiction: asJurisdiction(row.jurisdiction.trim()),
        status: row.status,
      }),
    ),
  };
}

async function loadLedgerDatabase(pool: Pool): Promise<{
  products: Product[];
  accounts: Account[];
  ledgerAccounts: LedgerAccount[];
  journals: Journal[];
  events: DomainEvent[];
  intents: ActionIntent[];
  authorities: AuthorityAudit[];
  openOutcomes: PersistedOpenOutcome[];
}> {
  const [products, accounts, ledgerAccounts, journals, postings, events, intents, authorities, outcomes] =
    await Promise.all([
      pool.query<{
        id: string;
        name: string;
        account_class: AccountClass;
        currency: string;
        legal_entity_id: string;
        jurisdiction: string;
        status: 'ACTIVE' | 'RETIRED';
      }>(
        `SELECT id, name, account_class, currency, legal_entity_id, jurisdiction, status
           FROM ledger.product`,
      ),
      pool.query<{
        id: string;
        owner_id: string;
        account_class: AccountClass;
        product_id: string;
        legal_entity_id: string;
        jurisdiction: string;
        currency: string;
        status: Account['status'];
        opened_at: Date;
        version: number;
      }>(
        `SELECT id, owner_id, account_class, product_id, legal_entity_id, jurisdiction,
                currency, status, opened_at, version
           FROM ledger.account`,
      ),
      pool.query<{
        id: string;
        name: string;
        account_class: AccountClass;
        currency: string;
        owner_id: string | null;
      }>(`SELECT id, name, account_class, currency, owner_id FROM ledger.ledger_account`),
      pool.query<{
        id: string;
        idempotency_key: string;
        execution_authority_id: string;
        action_type: string;
        asset: string;
        class_bridge_name: string | null;
        memo: string | null;
        created_at: Date;
      }>(
        `SELECT id, idempotency_key, execution_authority_id, action_type, asset,
                class_bridge_name, memo, created_at
           FROM ledger.journal
          ORDER BY created_at, id`,
      ),
      pool.query<{
        id: string;
        journal_id: string;
        account_id: string;
        direction: 'DEBIT' | 'CREDIT';
        currency: string;
        minor_units: string;
        ordinal: number;
      }>(
        `SELECT id, journal_id, account_id, direction, currency, minor_units::text, ordinal
           FROM ledger.posting
          ORDER BY journal_id, ordinal`,
      ),
      pool.query<{
        event_type: string;
        schema_version: number;
        occurred_at: Date;
        payload_canonical: unknown;
        envelope_canonical: unknown;
      }>(
        `SELECT event_type, schema_version, occurred_at, payload_canonical, envelope_canonical
           FROM ledger.domain_event
          ORDER BY id`,
      ),
      pool.query<{
        id: string;
        idempotency_key: string;
        action_type: string;
        actor_id: string;
        purpose: string;
        payload_canonical: unknown;
        requested_at: Date;
      }>(
        `SELECT id, idempotency_key, action_type, actor_id, purpose, payload_canonical, requested_at
           FROM ledger.action_intent`,
      ),
      pool.query<{
        authority_id: string;
        action_type: string;
        account_id: string;
        intent_id: string;
        idempotency_key: string;
        amount_minor_units: string | null;
        amount_currency: string | null;
        issued_at: Date;
        expires_at: Date;
        signature_sha256: string;
      }>(
        `SELECT authority_id, action_type, account_id, intent_id, idempotency_key,
                amount_minor_units::text, amount_currency, issued_at, expires_at, signature_sha256
           FROM ledger.execution_authority_record`,
      ),
      pool.query<{
        intent_id: string;
        outcome: PersistedOpenOutcome['outcome'];
        account_id: string | null;
        decision_status: string;
        evidence_record_id: string;
        code: string | null;
        message: string | null;
      }>(
        `SELECT intent_id, outcome, account_id, decision_status, evidence_record_id, code, message
           FROM ledger.account_open_outcome`,
      ),
    ]);

  const postingsByJournal = new Map<string, Posting[]>();
  for (const row of postings.rows) {
    const list = postingsByJournal.get(row.journal_id) ?? [];
    list.push(
      Object.freeze({
        id: row.id,
        accountId: row.account_id,
        direction: row.direction,
        amount: amountFromPersisted(row.currency.trim(), row.minor_units),
      }),
    );
    postingsByJournal.set(row.journal_id, list);
  }

  return {
    products: products.rows.map((row) =>
      Object.freeze({
        id: asProductId(row.id),
        name: row.name,
        accountClass: row.account_class,
        currency: asCurrencyCode(row.currency.trim()),
        legalEntityId: asLegalEntityId(row.legal_entity_id),
        jurisdiction: asJurisdiction(row.jurisdiction.trim()),
        status: row.status,
      }),
    ),
    accounts: accounts.rows.map((row) =>
      Object.freeze({
        id: asAccountId(row.id),
        ownerId: asCustomerId(row.owner_id),
        accountClass: row.account_class,
        productId: asProductId(row.product_id),
        legalEntityId: asLegalEntityId(row.legal_entity_id),
        jurisdiction: asJurisdiction(row.jurisdiction.trim()),
        currency: asCurrencyCode(row.currency.trim()),
        status: row.status,
        openedAt: asUtcInstant(row.opened_at.toISOString()),
        version: row.version,
      }),
    ),
    ledgerAccounts: ledgerAccounts.rows.map((row) => {
      const account: LedgerAccount = {
        id: row.id,
        name: row.name,
        accountClass: row.account_class,
        currency: row.currency.trim(),
        ...(row.owner_id ? { ownerId: row.owner_id } : {}),
      };
      return Object.freeze(account);
    }),
    journals: journals.rows.map((row) => {
      const journal: Journal = {
        id: row.id,
        idempotencyKey: row.idempotency_key,
        executionAuthorityId: row.execution_authority_id,
        actionType: row.action_type,
        asset: row.asset.trim(),
        postings: Object.freeze(postingsByJournal.get(row.id) ?? []),
        createdAt: row.created_at.toISOString(),
        ...(row.class_bridge_name ? { classBridgeName: row.class_bridge_name } : {}),
        ...(row.memo ? { memo: row.memo } : {}),
      };
      return Object.freeze(journal);
    }),
    events: events.rows.map((row) => reviveDomainEvent(row)),
    intents: intents.rows.map((row) =>
      Object.freeze({
        id: asIntentId(row.id),
        actionType: row.action_type,
        payload: reviveIntentPayload(row.payload_canonical),
        idempotencyKey: row.idempotency_key,
        actorId: row.actor_id,
        requestedAt: asUtcInstant(row.requested_at.toISOString()),
        purpose: row.purpose,
      }) as ActionIntent,
    ),
    authorities: authorities.rows.map((row) =>
      Object.freeze({
        authorityId: row.authority_id,
        actionType: row.action_type,
        accountId: row.account_id,
        intentId: row.intent_id,
        idempotencyKey: row.idempotency_key,
        amountMinorUnits: row.amount_minor_units,
        amountCurrency: row.amount_currency,
        issuedAt: row.issued_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
        signatureSha256: row.signature_sha256,
      }),
    ),
    openOutcomes: outcomes.rows.map((row) =>
      Object.freeze({
        intentId: row.intent_id,
        outcome: row.outcome,
        accountId: row.account_id,
        decisionStatus: row.decision_status,
        evidenceRecordId: row.evidence_record_id,
        code: row.code,
        message: row.message,
      }),
    ),
  };
}

export async function loadEvidenceRecords(
  queryable: Pick<Pool, 'query'>,
): Promise<EvidenceRecord[]> {
  const result = await queryable.query<{
    seq: string;
    evidence_id: string;
    kind: string;
    payload_canonical: unknown;
    payload_sha256: string;
    prev_record_sha256: string;
    record_sha256: string;
    sealed_at: Date;
  }>(
    `SELECT e.seq::text, e.evidence_id, e.kind, e.payload_canonical, e.payload_sha256,
            e.prev_record_sha256, e.record_sha256, e.sealed_at
       FROM evidence.evidence_record e
      ORDER BY e.seq`,
  );
  return result.rows.map((row) =>
    Object.freeze({
      seq: row.seq,
      evidenceId: row.evidence_id,
      kind: row.kind,
      payload: row.payload_canonical,
      payloadSha256: row.payload_sha256,
      prevRecordSha256: row.prev_record_sha256,
      recordSha256: row.record_sha256,
      sealedAt: row.sealed_at.toISOString(),
    }),
  );
}

function amountFromPersisted(asset: string, units: string): LedgerAmount {
  if (asset.startsWith('asset:')) {
    return AssetQuantity.fromScaledUnits(BigInt(units), asset);
  }
  return Money.fromMinorUnits(BigInt(units), asset);
}

function reviveIntentPayload(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const obj = value as Record<string, unknown>;
  if (
    obj.amount &&
    typeof obj.amount === 'object' &&
    obj.amount !== null &&
    'minorUnits' in obj.amount &&
    'currency' in obj.amount
  ) {
    const amount = obj.amount as { minorUnits: string; currency: string };
    return {
      ...obj,
      amount: Money.fromMinorUnitsString(String(amount.minorUnits), amount.currency),
    };
  }
  if (
    obj.amount &&
    typeof obj.amount === 'object' &&
    obj.amount !== null &&
    'scaledUnits' in obj.amount &&
    'assetId' in obj.amount
  ) {
    const amount = obj.amount as { scaledUnits: string; assetId: string };
    return {
      ...obj,
      amount: AssetQuantity.fromScaledUnitsString(String(amount.scaledUnits), amount.assetId),
    };
  }
  return value;
}

function reviveDomainEvent(row: {
  event_type: string;
  schema_version: number;
  occurred_at: Date;
  payload_canonical: unknown;
  envelope_canonical: unknown;
}): DomainEvent {
  if (row.envelope_canonical) {
    const serialized =
      typeof row.envelope_canonical === 'string'
        ? row.envelope_canonical
        : JSON.stringify(row.envelope_canonical);
    return parseEnvelope(serialized) as DomainEvent;
  }
  return Object.freeze({
    eventType: row.event_type,
    schemaVersion: row.schema_version,
    occurredAt: asUtcInstant(row.occurred_at.toISOString()),
    payload: row.payload_canonical,
  }) as DomainEvent;
}

export function intentFingerprint(intent: ActionIntent): string {
  return canonicalJson({
    actionType: intent.actionType,
    actorId: intent.actorId,
    purpose: intent.purpose,
    payload: intent.payload,
  });
}
