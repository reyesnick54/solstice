import { asAccountId, type Account } from '../../../packages/domain/src/account.ts';
import type { Customer } from '../../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import type { EvidencePersistSink } from '../../../packages/evidence/src/vault.ts';
import type { EventPersistSink } from '../../../packages/events/src/events.ts';
import type { InternalTransferIntent, PostDepositIntent, PostWithdrawalIntent } from '../../../packages/permissions/src/action-types.ts';
import type { ActionIntent } from '../../../packages/permissions/src/action-intent.ts';
import type { ExecutionAuthority } from '../../../packages/permissions/src/execution-authority.ts';
import type { OpenAccountIntent } from '../../../packages/permissions/src/action-types.ts';
import {
  loadEvidenceRecords,
  openPersistenceSession,
  persistCustomerUnit,
  persistEvidenceOnClient,
  persistLedgerUnit,
  type PersistenceEnv,
  type PersistenceSession,
  type PersistedOpenOutcome,
} from '../../../packages/persistence/src/index.ts';
import { seedSimulationCatalog } from './catalog.ts';
import type { MoneyMovementOutcome } from './money-movement.ts';
import type { OpenAccountOutcome } from './open-account.ts';
import {
  createSimulationRuntime,
  type SimulationRuntime,
  type SimulationRuntimeOptions,
} from './runtime.ts';
import { AccountStore, CustomerStore, LegalEntityStore, ProductStore } from './stores.ts';

export type DurableSimulationRuntime = {
  readonly env: PersistenceEnv;
  readonly session: PersistenceSession;
  readonly runtime: SimulationRuntime;
  saveCustomer(customer: Customer): Promise<void>;
  open(intent: OpenAccountIntent): Promise<OpenAccountOutcome>;
  deposit(intent: PostDepositIntent): Promise<MoneyMovementOutcome>;
  withdraw(intent: PostWithdrawalIntent): Promise<MoneyMovementOutcome>;
  transfer(intent: InternalTransferIntent): Promise<MoneyMovementOutcome>;
  close(): Promise<void>;
  restart(): Promise<DurableSimulationRuntime>;
};

export async function createPostgresSimulationRuntime(
  env: PersistenceEnv,
  options: Omit<SimulationRuntimeOptions, 'persist' | 'customers' | 'accounts'> = {},
): Promise<DurableSimulationRuntime> {
  const session = openPersistenceSession(env);
  const loaded = await session.load();

  const customers = new CustomerStore();
  for (const customer of loaded.customers) {
    customers.put(customer.id, customer);
  }
  const accounts = new AccountStore();
  for (const account of loaded.accounts) {
    accounts.put(account.id, account);
  }
  const seeded = seedSimulationCatalog();
  const legalEntities = options.legalEntities ?? new LegalEntityStore();
  if (!options.legalEntities) {
    for (const entity of seeded.legalEntities.list()) {
      legalEntities.put(entity.id, entity);
    }
  }
  for (const entity of loaded.legalEntities) {
    legalEntities.put(entity.id, entity);
  }
  const products = options.products ?? new ProductStore();
  if (!options.products) {
    for (const product of seeded.products.list()) {
      products.put(product.id, product);
    }
  }
  for (const product of loaded.products) {
    products.put(product.id, product);
  }

  const evidenceSink: EvidencePersistSink = {
    appendEvidence() {
      // Evidence is flushed from the vault delta under the chain lock.
    },
  };
  const eventSink: EventPersistSink = {
    appendEvent() {
      // Events are flushed from the log delta in the ledger unit.
    },
  };

  const runtime = createSimulationRuntime({
    ...options,
    customers,
    accounts,
    products,
    legalEntities,
    persist: {
      journal: session.journalSink,
      evidence: evidenceSink,
      events: eventSink,
    },
  });

  runtime.ledger.hydrateFromPersisted(loaded.journals);
  runtime.evidence.hydrateFromPersisted(loaded.evidence);
  runtime.events.hydrateFromPersisted(loaded.events);
  for (const account of loaded.accounts) {
    runtime.ledger.accounts.registerOpenedAccount(account);
  }

  const openOutcomes: Array<readonly [string, OpenAccountOutcome]> = [];
  for (const row of loaded.openOutcomes) {
    openOutcomes.push([row.intentId, reviveOpenOutcome(row, accounts, runtime.clock.now())]);
  }
  runtime.accountsService.hydrateOpenOutcomes(openOutcomes);

  await persistCustomerUnit(session, { legalEntities: legalEntities.list() });
  await persistLedgerUnit(session, {
    products: products.list(),
    ledgerAccounts: runtime.ledger.accounts.list(),
  });

  return new DurableRuntime(env, session, runtime, options);
}

class DurableRuntime implements DurableSimulationRuntime {
  readonly env: PersistenceEnv;
  readonly session: PersistenceSession;
  readonly runtime: SimulationRuntime;
  private readonly options: Omit<SimulationRuntimeOptions, 'persist' | 'customers' | 'accounts'>;

  constructor(
    env: PersistenceEnv,
    session: PersistenceSession,
    runtime: SimulationRuntime,
    options: Omit<SimulationRuntimeOptions, 'persist' | 'customers' | 'accounts'>,
  ) {
    this.env = env;
    this.session = session;
    this.runtime = runtime;
    this.options = options;
  }

  async saveCustomer(customer: Customer): Promise<void> {
    this.runtime.customers.put(customer.id, customer);
    await persistCustomerUnit(this.session, { customers: [customer] });
  }

  async open(intent: OpenAccountIntent): Promise<OpenAccountOutcome> {
    return this.runLocked(intent, undefined, true, () => this.runtime.accountsService.open(intent));
  }

  async deposit(intent: PostDepositIntent): Promise<MoneyMovementOutcome> {
    return this.runLocked(intent, intent.payload.accountId, false, () =>
      this.runtime.money.deposit(intent),
    );
  }

  async withdraw(intent: PostWithdrawalIntent): Promise<MoneyMovementOutcome> {
    return this.runLocked(intent, intent.payload.accountId, false, () =>
      this.runtime.money.withdraw(intent),
    );
  }

  async transfer(intent: InternalTransferIntent): Promise<MoneyMovementOutcome> {
    return this.runLocked(intent, intent.payload.sourceAccountId, false, () =>
      this.runtime.money.transfer(intent),
    );
  }

  async close(): Promise<void> {
    await this.session.close();
  }

  async restart(): Promise<DurableSimulationRuntime> {
    await this.close();
    return createPostgresSimulationRuntime(this.env, this.options);
  }

  private async runLocked<T extends OpenAccountOutcome | MoneyMovementOutcome>(
    intent: ActionIntent,
    lockAccountId: string | undefined,
    recordOpenOutcome: boolean,
    fn: () => T,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const evidenceClient = await this.session.pools.evidence.connect();
      const beforeEvents = this.runtime.events.list().length;
      try {
        await evidenceClient.query('BEGIN');
        await evidenceClient.query('SELECT pg_advisory_xact_lock(872514001)');
        const latestEvidence = await loadEvidenceRecords(evidenceClient);
        this.runtime.evidence.reloadFromPersisted(latestEvidence);
        const committed = await this.session.load();
        this.runtime.ledger.reloadFromPersisted(committed.journals);
        this.runtime.events.reloadFromPersisted(committed.events);
        for (const account of committed.accounts) {
          this.runtime.accounts.put(account.id, account);
          this.runtime.ledger.accounts.registerOpenedAccount(account);
        }
        const beforeEvidence = this.runtime.evidence.count();
        const result = fn();
        const authority = extractAuthority(result);
        const newEvidence = this.runtime.evidence.list().slice(beforeEvidence);
        const newEvents = this.runtime.events.list().slice(beforeEvents);
        const opened = recordOpenOutcome && isOpened(result) ? result.account : undefined;
        const openOutcome = recordOpenOutcome
          ? toPersistedOpenOutcome(intent.id, result as OpenAccountOutcome)
          : undefined;

        await persistCustomerUnit(this.session, {
          customers: this.runtime.customers.list(),
        });
        await persistLedgerUnit(this.session, {
          ...(lockAccountId ? { lockAccountId } : {}),
          accounts: opened ? [opened] : [],
          ledgerAccounts: this.runtime.ledger.accounts.list(),
          intents: [intent],
          authorities: authority ? [authority] : [],
          openOutcomes: openOutcome ? [openOutcome] : [],
          events: newEvents,
        });
        await persistEvidenceOnClient(evidenceClient, newEvidence);
        await evidenceClient.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await evidenceClient.query('ROLLBACK');
        } catch {
          // already failed
        }
        lastError = error;
        if (!isEvidenceChainConflict(error) || attempt === 4) {
          throw error;
        }
      } finally {
        evidenceClient.release();
      }
    }
    throw lastError;
  }
}

function isEvidenceChainConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = 'code' in error ? String((error as { code?: string }).code) : '';
  const message = 'message' in error ? String((error as { message?: string }).message) : '';
  return code === '23514' || message.includes('prev hash does not match');
}

function extractAuthority(
  result: OpenAccountOutcome | MoneyMovementOutcome,
): ExecutionAuthority | null {
  if ('decision' in result && result.decision && result.decision.executionAuthority) {
    return result.decision.executionAuthority;
  }
  return null;
}

function isOpened(
  result: OpenAccountOutcome | MoneyMovementOutcome,
): result is Extract<OpenAccountOutcome, { outcome: 'OPENED' }> {
  return 'outcome' in result && result.outcome === 'OPENED' && 'account' in result;
}

function toPersistedOpenOutcome(intentId: string, result: OpenAccountOutcome): PersistedOpenOutcome {
  if (result.outcome === 'OPENED') {
    return {
      intentId,
      outcome: 'OPENED',
      accountId: result.account.id,
      decisionStatus: result.decision.status,
      evidenceRecordId: result.decision.evidenceRecordId,
      code: null,
      message: null,
    };
  }
  if (result.outcome === 'KERNEL_REFUSED') {
    return {
      intentId,
      outcome: 'KERNEL_REFUSED',
      accountId: null,
      decisionStatus: result.decision.status,
      evidenceRecordId: result.decision.evidenceRecordId,
      code: null,
      message: null,
    };
  }
  return {
    intentId,
    outcome: 'REJECTED',
    accountId: null,
    decisionStatus: result.decision?.status ?? 'BLOCK',
    evidenceRecordId: result.evidenceId,
    code: result.code,
    message: result.message,
  };
}

function reviveOpenOutcome(
  row: PersistedOpenOutcome,
  accounts: AccountStore,
  now: string,
): OpenAccountOutcome {
  const decidedAt = asUtcInstant(now);
  if (row.outcome === 'OPENED' && row.accountId) {
    const account = accounts.get(asAccountId(row.accountId));
    if (!account) {
      throw new Error(`persisted open outcome ${row.intentId} is missing account ${row.accountId}`);
    }
    return {
      outcome: 'OPENED',
      account,
      decision: {
        status: 'ALLOW',
        intentId: row.intentId,
        actionType: 'OPEN_ACCOUNT',
        proofs: [],
        executionAuthority: null,
        evidenceRecordId: row.evidenceRecordId,
        decidedAt,
      },
      replay: false,
    };
  }
  if (row.outcome === 'KERNEL_REFUSED') {
    return {
      outcome: 'KERNEL_REFUSED',
      decision: {
        status: row.decisionStatus as 'BLOCK' | 'DEFER' | 'REQUIRE_MANUAL_REVIEW',
        intentId: row.intentId,
        actionType: 'OPEN_ACCOUNT',
        proofs: [],
        executionAuthority: null,
        evidenceRecordId: row.evidenceRecordId,
        decidedAt,
      },
    };
  }
  return {
    outcome: 'REJECTED',
    code: row.code ?? 'REJECTED',
    message: row.message ?? 'persisted rejection',
    decision: null,
    evidenceId: row.evidenceRecordId,
  };
}

export type { Account };
