import { FrozenClock, systemClock, type Clock } from '../../../packages/config/src/clock.ts';
import { CAPABILITIES } from '../../../packages/config/src/flags.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { EvidenceVault, type EvidencePersistSink } from '../../../packages/evidence/src/vault.ts';
import { DomainEventLog, type EventPersistSink } from '../../../packages/events/src/events.ts';
import { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import { createSimulationPolicyEngine } from '../../../packages/kernel/src/policy/create.ts';
import type { PolicyEventRecord } from '../../../packages/kernel/src/policy/registry.ts';
import { DEFAULT_PROOFS } from '../../../packages/kernel/src/proofs.ts';
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
  const policy = createSimulationPolicyEngine({
    record(event) {
      appendPolicyEvent(events, event);
    },
  });
  const kernel = new ComplianceKernel(issuer, evidence, clock, DEFAULT_PROOFS, policy);
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

function appendPolicyEvent(events: DomainEventLog, event: PolicyEventRecord): void {
  const occurredAt = asUtcInstant(event.occurredAt);
  if (event.eventType === 'PolicyPackActivated' || event.eventType === 'PolicyPackRetired') {
    events.append({
      eventType: event.eventType,
      schemaVersion: 1,
      occurredAt,
      payload: {
        packId: event.payload.packId ?? '',
        versionId: event.payload.versionId ?? '',
        packHash: event.payload.packHash ?? '',
        lifecycle: event.payload.lifecycle ?? '',
      },
    });
    return;
  }
  if (event.eventType === 'PolicyReviewRequested') {
    events.append({
      eventType: 'PolicyReviewRequested',
      schemaVersion: 1,
      occurredAt,
      payload: {
        reviewId: event.payload.reviewId ?? '',
        decision: event.payload.decision ?? '',
        packId: event.payload.packId ?? null,
        versionId: event.payload.versionId ?? null,
        factsHash: event.payload.factsHash ?? '',
      },
    });
    return;
  }
  events.append({
    eventType: 'PolicyReviewDecided',
    schemaVersion: 1,
    occurredAt,
    payload: {
      reviewId: event.payload.reviewId ?? '',
      status: event.payload.status ?? '',
      decidedByKind: event.payload.decidedByKind ?? '',
      packId: event.payload.packId ?? null,
      factsHash: event.payload.factsHash ?? '',
    },
  });
}

export { FrozenClock };
