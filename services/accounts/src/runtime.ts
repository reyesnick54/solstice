import { FrozenClock, systemClock, type Clock } from '../../../packages/config/src/clock.ts';
import { CAPABILITIES } from '../../../packages/config/src/flags.ts';
import { EvidenceVault, type EvidencePersistSink } from '../../../packages/evidence/src/vault.ts';
import { DomainEventLog, type EventPersistSink } from '../../../packages/events/src/events.ts';
import { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import { GrowthAttributionLedger } from '../../../packages/ledger/src/growth.ts';
import { Ledger, type JournalPersistSink } from '../../../packages/ledger/src/journal.ts';
import { AuthorityIssuer } from '../../../packages/permissions/src/execution-authority.ts';
import type { KeyProvider } from '../../../packages/security/src/provider.ts';
import {
  createSimulationKeyProvider,
  SimulationKeyProvider,
} from '../../../packages/security/src/simulation.ts';
import { seedSimulationCatalog } from './catalog.ts';
import { securityEventSink, securityEvidenceSink } from './security-audit.ts';
import { MoneyMovementService } from './money-movement.ts';
import { AccountsService } from './open-account.ts';
import {
  AccountStore,
  CustomerStore,
  LegalEntityStore,
  ProductStore,
} from './stores.ts';

export type SimulationRuntime = {
  readonly capabilities: typeof CAPABILITIES;
  readonly clock: Clock;
  readonly issuer: AuthorityIssuer;
  readonly keyProvider: KeyProvider;
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
  readonly keyProvider?: KeyProvider;
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
  const evidence = new EvidenceVault(clock, options.persist?.evidence);
  const events = new DomainEventLog(options.persist?.events);
  const keyProvider =
    options.keyProvider ??
    createSimulationKeyProvider({
      clock: { now: () => clock.now() },
    });
  if (keyProvider instanceof SimulationKeyProvider) {
    keyProvider.attachAuditSinks({
      events: securityEventSink(events, () => clock.now()),
      evidence: securityEvidenceSink(evidence),
    });
  }
  const issuer = new AuthorityIssuer(keyProvider);
  const ledger = new Ledger(issuer, clock, undefined, options.persist?.journal);
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
    keyProvider,
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
