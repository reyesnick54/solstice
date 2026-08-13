import { FrozenClock, systemClock, type Clock } from '../../../packages/config/src/clock.ts';
import { CAPABILITIES } from '../../../packages/config/src/flags.ts';
import { EvidenceVault } from '../../../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../../../packages/events/src/events.ts';
import { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import { GrowthAttributionLedger } from '../../../packages/ledger/src/growth.ts';
import { Ledger } from '../../../packages/ledger/src/journal.ts';
import { AuthorityIssuer } from '../../../packages/permissions/src/execution-authority.ts';
import { seedSimulationCatalog } from './catalog.ts';
import { MoneyMovementService } from './money-movement.ts';
import { AccountsService } from './open-account.ts';
import { AccountStore, CustomerStore } from './stores.ts';

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

export function createSimulationRuntime(
  options: { clock?: Clock; authoritySecret?: string } = {},
): SimulationRuntime {
  const clock = options.clock ?? systemClock;
  const issuer = new AuthorityIssuer(options.authoritySecret ?? SIMULATION_AUTHORITY_SECRET);
  const ledger = new Ledger(issuer, clock);
  const evidence = new EvidenceVault(clock);
  const events = new DomainEventLog();
  const growth = new GrowthAttributionLedger();
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const customers = new CustomerStore();
  const accounts = new AccountStore();
  const { legalEntities, products } = seedSimulationCatalog();
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
