import { asAccountId, type Account } from '../../../packages/domain/src/account.ts';
import type { Customer } from '../../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import type { EvidencePersistSink } from '../../../packages/evidence/src/vault.ts';
import type { EventPersistSink } from '../../../packages/events/src/events.ts';
import type {
  AdjustHoldIntent,
  CreateHoldIntent,
  InternalTransferIntent,
  PostDepositIntent,
  PostFeeIntent,
  PostReversalIntent,
  PostWithdrawalIntent,
} from '../../../packages/permissions/src/action-types.ts';
import type { BankingOutcome } from './banking-operations.ts';
import type { FeeAssessment } from '../../../packages/domain/src/fee.ts';
import type { FundsHold } from '../../../packages/domain/src/hold.ts';
import type { ReversalRecord } from '../../../packages/domain/src/reversal.ts';
import type { ActionIntent } from '../../../packages/permissions/src/action-intent.ts';
import type { ExecutionAuthority } from '../../../packages/permissions/src/execution-authority.ts';
import type { OpenAccountIntent } from '../../../packages/permissions/src/action-types.ts';
import { AuthenticationService } from '../../../packages/identity/src/authentication-service.ts';
import {
  loadAuthenticationSnapshot,
  loadEvidenceRecords,
  loadIdentitySnapshot,
  openPersistenceSession,
  persistAuthenticationSnapshot,
  persistCustomerUnit,
  persistEvidenceOnClient,
  persistEvidenceUnit,
  persistIdentitySnapshot,
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
  readonly authentication: AuthenticationService;
  persistAuthentication(): Promise<void>;
  saveCustomer(customer: Customer): Promise<void>;
  open(intent: OpenAccountIntent): Promise<OpenAccountOutcome>;
  postDeposit(intent: PostDepositIntent): Promise<MoneyMovementOutcome>;
  postWithdrawal(intent: PostWithdrawalIntent): Promise<MoneyMovementOutcome>;
  postTransfer(intent: InternalTransferIntent): Promise<MoneyMovementOutcome>;
  createHold(intent: CreateHoldIntent): Promise<BankingOutcome<FundsHold>>;
  adjustHold(intent: AdjustHoldIntent): Promise<BankingOutcome<FundsHold>>;
  postFee(intent: PostFeeIntent): Promise<BankingOutcome<FeeAssessment>>;
  postReversal(intent: PostReversalIntent): Promise<BankingOutcome<ReversalRecord>>;
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
    provisionSimulatedActor: false,
    persist: {
      journal: session.journalSink,
      evidence: evidenceSink,
      events: eventSink,
    },
  });
  runtime.ledger.hydrateFromPersisted(loaded.journals);
  runtime.evidence.hydrateFromPersisted(loaded.evidence);
  runtime.events.hydrateFromPersisted(loaded.events);
  runtime.banking.hydrateHolds(loaded.holds);
  runtime.banking.hydrateReversals(loaded.reversals);
  runtime.banking.hydrateFees(loaded.fees);
  if (loaded.policy.versions.length > 0) {
    runtime.kernel.policy.registry.hydrate(loaded.policy);
    runtime.kernel.policy.reviews.hydrate(loaded.policy.reviews);
  }
  for (const account of loaded.accounts) {
    runtime.ledger.accounts.registerOpenedAccount(account);
  }

  const authentication = new AuthenticationService({
    identity: runtime.identity.service,
    clock: runtime.clock,
    keys: runtime.keyProvider,
    events: runtime.events,
    evidence: runtime.evidence,
  });

  const identitySnapshot = await loadIdentitySnapshot(session.pools.customer);
  if (identitySnapshot) {
    runtime.identity.service.hydrate(identitySnapshot);
  } else {
    const beforeEvidence = runtime.evidence.count();
    const beforeEvents = runtime.events.list().length;
    const provisioned = runtime.identity.provisionSimulatedActor({
      actorId: 'operator_1',
      identityId: 'idn_sim_operator_1',
      jurisdiction: asJurisdiction('GB'),
    });
    if (!provisioned.ok) {
      throw new Error(`simulated identity adapter failed: ${provisioned.error.message}`);
    }
    await persistIdentitySnapshot(session.pools.customer, runtime.identity.service.snapshot());
    const newEvidence = runtime.evidence.list().slice(beforeEvidence);
    const newEvents = runtime.events.list().slice(beforeEvents);
    if (newEvidence.length > 0) {
      await persistEvidenceUnit(session, newEvidence);
    }
    if (newEvents.length > 0) {
      await persistLedgerUnit(session, { events: newEvents });
    }
  }
  const authSnapshot = await loadAuthenticationSnapshot(session.pools.customer);
  if (authSnapshot) {
    authentication.hydrate(authSnapshot);
  }

  const openOutcomes: Array<readonly [string, OpenAccountOutcome]> = [];
  for (const row of loaded.openOutcomes) {
    openOutcomes.push([row.intentId, reviveOpenOutcome(row, accounts, runtime.clock.now())]);
  }
  runtime.accountsService.hydrateOpenOutcomes(openOutcomes);

  await persistCustomerUnit(session, {
    legalEntities: legalEntities.list(),
    policy: {
      ...runtime.kernel.policy.registry.snapshot(),
      reviews: runtime.kernel.policy.reviews.list(),
    },
  });
  await persistLedgerUnit(session, {
    products: products.list(),
    ledgerAccounts: runtime.ledger.accounts.list(),
  });

  return new DurableRuntime(env, session, runtime, options, authentication);
}

class DurableRuntime implements DurableSimulationRuntime {
  readonly env: PersistenceEnv;
  readonly session: PersistenceSession;
  readonly runtime: SimulationRuntime;
  readonly authentication: AuthenticationService;
  private readonly options: Omit<SimulationRuntimeOptions, 'persist' | 'customers' | 'accounts'>;

  constructor(
    env: PersistenceEnv,
    session: PersistenceSession,
    runtime: SimulationRuntime,
    options: Omit<SimulationRuntimeOptions, 'persist' | 'customers' | 'accounts'>,
    authentication: AuthenticationService,
  ) {
    this.env = env;
    this.session = session;
    this.runtime = runtime;
    this.options = options;
    this.authentication = authentication;
  }

  async persistAuthentication(): Promise<void> {
    await persistIdentitySnapshot(this.session.pools.customer, this.runtime.identity.service.snapshot());
    await persistAuthenticationSnapshot(this.session.pools.customer, this.authentication.snapshot());
  }

  async saveCustomer(customer: Customer): Promise<void> {
    const previous = this.runtime.customers.get(customer.id);
    this.runtime.customers.put(customer.id, customer);
    await persistCustomerUnit(this.session, { customers: [customer] });
    if (previous && previous.status !== customer.status) {
      const event = this.runtime.events.append({
        eventType: 'CustomerStatusChanged',
        schemaVersion: 1,
        occurredAt: this.runtime.clock.now(),
        correlationId: customer.id,
        jurisdiction: customer.jurisdiction,
        aggregateType: 'customer',
        aggregateId: customer.id,
        payload: {
          customerId: customer.id,
          fromStatus: previous.status,
          toStatus: customer.status,
          customerVersion: customer.version,
        },
      });
      await persistLedgerUnit(this.session, { events: [event] });
    }
  }

  async open(intent: OpenAccountIntent): Promise<OpenAccountOutcome> {
    return this.runLocked(intent, undefined, true, () => this.runtime.accountsService.open(intent));
  }

  async postDeposit(intent: PostDepositIntent): Promise<MoneyMovementOutcome> {
    return this.runLocked(intent, intent.payload.accountId, false, () =>
      this.runtime.money.deposit(intent),
    );
  }

  async postWithdrawal(intent: PostWithdrawalIntent): Promise<MoneyMovementOutcome> {
    return this.runLocked(intent, intent.payload.accountId, false, () =>
      this.runtime.money.withdraw(intent),
    );
  }

  async postTransfer(intent: InternalTransferIntent): Promise<MoneyMovementOutcome> {
    return this.runLocked(intent, intent.payload.sourceAccountId, false, () =>
      this.runtime.money.transfer(intent),
    );
  }

  async createHold(intent: CreateHoldIntent): Promise<BankingOutcome<FundsHold>> {
    return this.runBanking(intent, intent.payload.accountId, () => this.runtime.banking.createHold(intent));
  }

  async adjustHold(intent: AdjustHoldIntent): Promise<BankingOutcome<FundsHold>> {
    return this.runBanking(intent, intent.payload.accountId, () => this.runtime.banking.adjustHold(intent));
  }

  async postFee(intent: PostFeeIntent): Promise<BankingOutcome<FeeAssessment>> {
    return this.runBanking(intent, intent.payload.accountId, () => this.runtime.banking.postFee(intent));
  }

  async postReversal(intent: PostReversalIntent): Promise<BankingOutcome<ReversalRecord>> {
    return this.runBanking(intent, intent.payload.accountId, () => this.runtime.banking.postReversal(intent));
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
      try {
        await evidenceClient.query('BEGIN');
        await evidenceClient.query('SELECT pg_advisory_xact_lock(872514001)');
        const latestEvidence = await loadEvidenceRecords(evidenceClient);
        this.runtime.evidence.reloadFromPersisted(latestEvidence);
        const committed = await this.session.load();
        this.runtime.ledger.reloadFromPersisted(committed.journals);
        this.runtime.events.reloadFromPersisted(committed.events);
        this.runtime.banking.hydrateHolds(committed.holds);
        this.runtime.banking.hydrateReversals(committed.reversals);
        this.runtime.banking.hydrateFees(committed.fees);
        for (const account of committed.accounts) {
          this.runtime.accounts.put(account.id, account);
          this.runtime.ledger.accounts.registerOpenedAccount(account);
        }
        const beforeEvidence = this.runtime.evidence.count();
        const beforeEvents = this.runtime.events.list().length;
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
          policy: {
            ...this.runtime.kernel.policy.registry.snapshot(),
            reviews: this.runtime.kernel.policy.reviews.list(),
          },
        });
        await persistLedgerUnit(this.session, {
          ...(lockAccountId ? { lockAccountId } : {}),
          accounts: opened ? [opened] : [],
          ledgerAccounts: this.runtime.ledger.accounts.list(),
          intents: [intent],
          authorities: authority ? [authority] : [],
          openOutcomes: openOutcome ? [openOutcome] : [],
          events: newEvents,
          holds: this.runtime.holds.list(),
          reversals: this.runtime.banking.listReversals(),
          fees: this.runtime.banking.listFees(),
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

  private async runBanking<T>(
    intent: ActionIntent,
    lockAccountId: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const beforeEvidence = this.runtime.evidence.count();
    const beforeEvents = this.runtime.events.list().length;
    const result = await fn();
    const newEvidence = this.runtime.evidence.list().slice(beforeEvidence);
    const newEvents = this.runtime.events.list().slice(beforeEvents);
    const authority =
      result &&
      typeof result === 'object' &&
      'decision' in result &&
      result.decision &&
      typeof result.decision === 'object' &&
      'executionAuthority' in result.decision
        ? (result.decision.executionAuthority as ExecutionAuthority | null)
        : null;
    await persistLedgerUnit(this.session, {
      lockAccountId,
      ledgerAccounts: this.runtime.ledger.accounts.list(),
      intents: [intent],
      authorities: authority ? [authority] : [],
      events: newEvents,
      holds: this.runtime.holds.list(),
      reversals: this.runtime.banking.listReversals(),
      fees: this.runtime.banking.listFees(),
    });
    if (newEvidence.length > 0) {
      await persistEvidenceUnit(this.session, newEvidence);
    }
    return result;
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
