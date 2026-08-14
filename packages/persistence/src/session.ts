import type { Account } from '../../domain/src/account.ts';
import type { Customer } from '../../domain/src/customer.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import type { EvidenceRecord } from '../../evidence/src/vault.ts';
import type { DomainEvent } from '../../events/src/events.ts';
import type { JournalPersistSink } from '../../ledger/src/journal.ts';
import type { Journal, LedgerAccount } from '../../ledger/src/types.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import type { ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import type { PersistenceEnv } from './env.ts';
import { PostgresJournalStore } from './ledger/pg-journal-store.ts';
import { logPersistenceEvent } from './logging.ts';
import { loadPersistedState } from './postgres/load.ts';
import {
  closePersistencePools,
  createPersistencePools,
  type PersistencePools,
} from './postgres/pools.ts';
import type { LoadedPersistence, PersistedOpenOutcome } from './postgres/types.ts';
import {
  insertAccount,
  insertAuthorityAudit,
  insertDomainEvent,
  insertIntent,
  insertLedgerAccount,
  insertOpenOutcome,
  lockAccountForUpdate,
  upsertProduct,
} from './ledger/writes.ts';
import {
  insertEvidenceRecord,
  upsertCustomer,
  upsertLegalEntity,
  withTransaction,
} from './postgres/write.ts';

export type PersistenceSession = {
  readonly pools: PersistencePools;
  readonly journalSink: JournalPersistSink;
  load(): Promise<LoadedPersistence>;
  persistCustomer(customer: Customer): Promise<void>;
  persistLegalEntity(entity: LegalEntity): Promise<void>;
  persistProduct(product: Product): Promise<void>;
  persistAccount(account: Account): Promise<void>;
  persistLedgerAccount(account: LedgerAccount): Promise<void>;
  persistIntent(intent: ActionIntent): Promise<void>;
  persistAuthority(authority: ExecutionAuthority): Promise<void>;
  persistOpenOutcome(outcome: PersistedOpenOutcome): Promise<void>;
  persistEvent(event: DomainEvent): Promise<void>;
  persistEvidence(record: EvidenceRecord): Promise<void>;
  flushJournals(): Promise<readonly Journal[]>;
  lockAccount(accountId: string): Promise<void>;
  close(): Promise<void>;
};

class Session implements PersistenceSession {
  readonly pools: PersistencePools;
  readonly journalStore: PostgresJournalStore;

  constructor(env: PersistenceEnv) {
    this.pools = createPersistencePools(env);
    this.journalStore = new PostgresJournalStore();
  }

  get journalSink(): JournalPersistSink {
    return this.journalStore;
  }

  async load(): Promise<LoadedPersistence> {
    return loadPersistedState(this.pools);
  }

  async persistCustomer(customer: Customer): Promise<void> {
    await withTransaction(this.pools.customer, (client) => upsertCustomer(client, customer));
  }

  async persistLegalEntity(entity: LegalEntity): Promise<void> {
    await withTransaction(this.pools.customer, (client) => upsertLegalEntity(client, entity));
  }

  async persistProduct(product: Product): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => upsertProduct(client, product));
  }

  async persistAccount(account: Account): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => insertAccount(client, account));
  }

  async persistLedgerAccount(account: LedgerAccount): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => insertLedgerAccount(client, account));
  }

  async persistIntent(intent: ActionIntent): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => insertIntent(client, intent));
  }

  async persistAuthority(authority: ExecutionAuthority): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => insertAuthorityAudit(client, authority));
  }

  async persistOpenOutcome(outcome: PersistedOpenOutcome): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => insertOpenOutcome(client, outcome));
  }

  async persistEvent(event: DomainEvent): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => insertDomainEvent(client, event));
  }

  async persistEvidence(record: EvidenceRecord): Promise<void> {
    try {
      await withTransaction(this.pools.evidence, (client) => insertEvidenceRecord(client, record));
    } catch (error) {
      logPersistenceEvent({
        level: 'error',
        code: 'EVIDENCE_PERSIST_FAILED',
        domain: 'evidence',
        message: 'failed to append an evidence record',
        evidenceId: record.evidenceId,
      });
      throw error;
    }
  }

  async flushJournals(): Promise<readonly Journal[]> {
    const pending = this.journalStore.takePending();
    if (pending.length === 0) {
      return [];
    }
    await withTransaction(this.pools.ledger, async (client) => {
      for (const item of pending) {
        this.journalStore.queueAcceptedJournal(item.journal, item.executionAuthority);
      }
      await this.journalStore.flush(client);
    });
    return pending.map((item) => item.journal);
  }

  async lockAccount(accountId: string): Promise<void> {
    await withTransaction(this.pools.ledger, (client) => lockAccountForUpdate(client, accountId));
  }

  async close(): Promise<void> {
    await closePersistencePools(this.pools);
  }
}

export function openPersistenceSession(env: PersistenceEnv): PersistenceSession {
  return new Session(env);
}

/**
 * Persist a financial operation as one ledger transaction:
 * accounts, ledger accounts, journals, intents, authority audit, open outcomes, events.
 * Evidence is a separate database and is committed after the ledger transaction.
 */
export async function persistLedgerUnit(
  session: PersistenceSession,
  input: {
    readonly products?: readonly Product[];
    readonly accounts?: readonly Account[];
    readonly ledgerAccounts?: readonly LedgerAccount[];
    readonly intents?: readonly ActionIntent[];
    readonly authorities?: readonly ExecutionAuthority[];
    readonly openOutcomes?: readonly PersistedOpenOutcome[];
    readonly events?: readonly DomainEvent[];
    readonly lockAccountId?: string;
  },
): Promise<void> {
  const inner = session as Session;
  await withTransaction(inner.pools.ledger, async (client) => {
    if (input.lockAccountId) {
      await lockAccountForUpdate(client, input.lockAccountId);
    }
    for (const product of input.products ?? []) {
      await upsertProduct(client, product);
    }
    for (const account of input.ledgerAccounts ?? []) {
      await insertLedgerAccount(client, account);
    }
    for (const account of input.accounts ?? []) {
      await insertAccount(client, account);
    }
    for (const intent of input.intents ?? []) {
      await insertIntent(client, intent);
    }
    for (const authority of input.authorities ?? []) {
      await insertAuthorityAudit(client, authority);
    }
    for (const outcome of input.openOutcomes ?? []) {
      await insertOpenOutcome(client, outcome);
    }
    await inner.journalStore.flush(client);
    for (const event of input.events ?? []) {
      await insertDomainEvent(client, event);
    }
  });
}

export async function persistCustomerUnit(
  session: PersistenceSession,
  input: {
    readonly legalEntities?: readonly LegalEntity[];
    readonly customers?: readonly Customer[];
  },
): Promise<void> {
  const inner = session as Session;
  await withTransaction(inner.pools.customer, async (client) => {
    for (const entity of input.legalEntities ?? []) {
      await upsertLegalEntity(client, entity);
    }
    for (const customer of input.customers ?? []) {
      await upsertCustomer(client, customer);
    }
  });
}

export async function persistEvidenceUnit(
  session: PersistenceSession,
  records: readonly EvidenceRecord[],
): Promise<void> {
  const inner = session as Session;
  await withTransaction(inner.pools.evidence, async (client) => {
    for (const record of records) {
      await insertEvidenceRecord(client, record);
    }
  });
}

export async function persistEvidenceOnClient(
  client: import('pg').PoolClient,
  records: readonly EvidenceRecord[],
): Promise<void> {
  for (const record of records) {
    await insertEvidenceRecord(client, record);
  }
}
