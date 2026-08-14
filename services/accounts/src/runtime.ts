import { FrozenClock, systemClock, type Clock } from '../../../packages/config/src/clock.ts';
import { CAPABILITIES } from '../../../packages/config/src/flags.ts';
import { EvidenceVault, type EvidencePersistSink } from '../../../packages/evidence/src/vault.ts';
import { DomainEventLog, type EventPersistSink } from '../../../packages/events/src/events.ts';
import { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import { GrowthAttributionLedger } from '../../../packages/ledger/src/growth.ts';
import { Ledger, type JournalPersistSink } from '../../../packages/ledger/src/journal.ts';
import { AuthorityIssuer } from '../../../packages/permissions/src/execution-authority.ts';
import { seedSimulationCatalog } from './catalog.ts';
import { MoneyMovementService } from './money-movement.ts';
import { AccountsService } from './open-account.ts';
import {
  AccountStore,
  CustomerStore,
  LegalEntityStore,
  ProductStore,
} from './stores.ts';

const SIMULATION_AUTHORITY_SECRET = 'solstice-simulation-ea-hmac-v1';

export type SimulationRuntime = {
  readonly capabilities: typeof CAPABILITIES;
  readonly clock: Clock;
  readonly issuer: AuthorityIssuer;
  readonly kernel: ComplianceKernel;
  readonly ledger: Ledger;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly growth: GrowthAttributionLedger;
  readonly customers: CustomerStore;
  readonly accounts: AccountStore;
  readonly accountsService: AccountsService;
  readonly money: MoneyMovementService;
};

export type SimulationRuntimeOptions = {
  readonly clock?: Clock;
  readonly authoritySecret?: string;
  readonly persist?: {
    readonly journal?: JournalPersistSink;
    readonly evidence?: EvidencePersistSink;
    readonly events?: EventPersistSink;
  };
  readonly customers?: CustomerStore;
  readonly accounts?: AccountStore;
  readonly products?: ProductStore;
  readonly legalEntities?: LegalEntityStore;
};

export function createSimulationRuntime(
  options: SimulationRuntimeOptions = {},
): SimulationRuntime {
  const clock = options.clock ?? systemClock;
  const issuer = new AuthorityIssuer(options.authoritySecret ?? SIMULATION_AUTHORITY_SECRET);
  const ledger = new Ledger(issuer, clock, undefined, options.persist?.journal);
  const evidence = new EvidenceVault(clock, options.persist?.evidence);
  const events = new DomainEventLog(options.persist?.events);
  const growth = new GrowthAttributionLedger();
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const customers = options.customers ?? new CustomerStore();
  const accounts = options.accounts ?? new AccountStore();
  const seeded = seedSimulationCatalog();
  const legalEntities = options.legalEntities ?? seeded.legalEntities;
  const products = options.products ?? seeded.products;
  const accountsService = new AccountsService(
    kernel,
    issuer,
    ledger,
    evidence,
    events,
    clock,
    customers,
    accounts,
    products,
    legalEntities,
  );
  const money = new MoneyMovementService(
    kernel,
    issuer,
    ledger,
    evidence,
    events,
    growth,
    clock,
    customers,
    accounts,
    products,
    legalEntities,
  );
  return {
    capabilities: CAPABILITIES,
    clock,
    issuer,
    kernel,
    ledger,
    evidence,
    events,
    growth,
    customers,
    accounts,
    accountsService,
    money,
  };
}

export { FrozenClock };
