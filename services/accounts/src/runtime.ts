import { FrozenClock, type Clock } from '../../../packages/config/src/clock.ts';
import { CAPABILITIES } from '../../../packages/config/src/flags.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { asJurisdiction } from '../../../packages/domain/src/jurisdiction.ts';
import { EvidenceVault, type EvidencePersistSink } from '../../../packages/evidence/src/vault.ts';
import { DomainEventLog, type EventPersistSink } from '../../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../packages/identity/src/simulation.ts';
import {
  ComplianceFabric,
  type ComplianceEventRecord,
} from '../../../packages/kernel/src/compliance/fabric.ts';
import { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import { createSimulationPolicyEngine } from '../../../packages/kernel/src/policy/create.ts';
import type { PolicyEventRecord } from '../../../packages/kernel/src/policy/registry.ts';
import { DEFAULT_PROOFS } from '../../../packages/kernel/src/proofs.ts';
import { GrowthAttributionLedger } from '../../../packages/ledger/src/growth.ts';
import { Ledger, type JournalPersistSink } from '../../../packages/ledger/src/journal.ts';
import { AuthorityIssuer } from '../../../packages/permissions/src/execution-authority.ts';
import type { KeyProvider } from '../../../packages/security/src/provider.ts';
import {
  createSimulationKeyProvider,
  SimulationKeyProvider,
} from '../../../packages/security/src/simulation.ts';
import { AccountProductService } from './account-product-service.ts';
import { BankingOperationsService } from './banking-operations.ts';
import { seedSimulationCatalog } from './catalog.ts';
import { HoldStore } from './hold-store.ts';
import { securityEventSink, securityEvidenceSink } from './security-audit.ts';
import { MoneyMovementService } from './money-movement.ts';
import { AccountsService } from './open-account.ts';
import { RestrictionStore, FinancialAccountOverlayStore } from './restriction-store.ts';
import {
  AccountStore,
  CustomerStore,
  LegalEntityStore,
  ProductStore,
} from './stores.ts';
import { ResourceOwnershipRegistry } from '../../../packages/identity/src/index.ts';

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
  readonly banking: BankingOperationsService;
  readonly holds: HoldStore;
  readonly identity: SimulatedIdentityAdapter;
  readonly compliance: ComplianceFabric;
  readonly restrictions: RestrictionStore;
  readonly accountProduct: AccountProductService;
  readonly ownership: ResourceOwnershipRegistry;
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
  readonly provisionSimulatedActor?: boolean;
};

export function createSimulationRuntime(
  options: SimulationRuntimeOptions = {},
): SimulationRuntime {
  const clock =
    options.clock ?? new FrozenClock(asUtcInstant('2026-08-13T15:00:00.000Z'));
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
  const policy = createSimulationPolicyEngine({
    record(event) {
      appendPolicyEvent(events, event);
    },
  });
  const kernel = new ComplianceKernel(issuer, evidence, clock, DEFAULT_PROOFS, policy);
  const compliance = new ComplianceFabric({
    clock,
    evidence,
    events: {
      record(event) {
        appendComplianceEvent(events, event);
      },
    },
  });
  const customers = options.customers ?? new CustomerStore();
  const accounts = options.accounts ?? new AccountStore();
  const seeded = seedSimulationCatalog();
  const legalEntities = options.legalEntities ?? seeded.legalEntities;
  const products = options.products ?? seeded.products;
  const identity = new SimulatedIdentityAdapter({
    clock,
    keys: keyProvider,
    evidence,
    events,
  });
  if (options.provisionSimulatedActor !== false) {
    const provisioned = identity.provisionSimulatedActor({
      actorId: 'operator_1',
      identityId: 'idn_sim_operator_1',
      jurisdiction: asJurisdiction('GB'),
    });
    if (!provisioned.ok) {
      throw new Error(`simulated identity adapter failed: ${provisioned.error.message}`);
    }
  }
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
    identity.service,
    compliance,
  );
  const holds = new HoldStore();
  const restrictions = new RestrictionStore();
  const overlays = new FinancialAccountOverlayStore();
  const ownership = new ResourceOwnershipRegistry();
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
    identity.service,
    holds,
    compliance,
    restrictions,
  );
  const banking = new BankingOperationsService(
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
    identity.service,
    holds,
    restrictions,
  );
  const accountProduct = new AccountProductService({
    accounts,
    ledger,
    holds,
    clock,
    evidence,
    events,
    restrictions,
    overlays,
    ownership,
    identity: identity.service,
  });
  accountsService.attachProductLayer(accountProduct);
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
    banking,
    holds,
    identity,
    compliance,
    restrictions,
    accountProduct,
    ownership,
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

function appendComplianceEvent(events: DomainEventLog, event: ComplianceEventRecord): void {
  const occurredAt = asUtcInstant(event.occurredAt);
  const payload = event.payload;
  if (event.eventType === 'ComplianceScreeningCompleted') {
    events.append({
      eventType: 'ComplianceScreeningCompleted',
      schemaVersion: 1,
      occurredAt,
      payload: {
        screeningId: String(payload.screeningId ?? ''),
        screeningType: String(payload.screeningType ?? ''),
        outcome: String(payload.outcome ?? ''),
        subjectRef: String(payload.subjectRef ?? ''),
        providerRef: String(payload.providerRef ?? ''),
        providerHash: String(payload.providerHash ?? ''),
        reasonCodes: Array.isArray(payload.reasonCodes) ? payload.reasonCodes : [],
        ...(payload.policyVersionId ? { policyVersionId: String(payload.policyVersionId) } : {}),
        ...(payload.jurisdiction ? { jurisdiction: String(payload.jurisdiction) } : {}),
      },
    });
    return;
  }
  if (event.eventType === 'ComplianceScreeningReviewRequired') {
    events.append({
      eventType: 'ComplianceScreeningReviewRequired',
      schemaVersion: 1,
      occurredAt,
      payload: {
        screeningId: String(payload.screeningId ?? ''),
        screeningType: String(payload.screeningType ?? ''),
        outcome: String(payload.outcome ?? ''),
        subjectRef: String(payload.subjectRef ?? ''),
        reasonCodes: Array.isArray(payload.reasonCodes) ? payload.reasonCodes : [],
      },
    });
    return;
  }
  if (event.eventType === 'ComplianceCaseOpened') {
    events.append({
      eventType: 'ComplianceCaseOpened',
      schemaVersion: 1,
      occurredAt,
      payload: {
        caseId: String(payload.caseId ?? ''),
        caseType: String(payload.caseType ?? ''),
        subjectRef: String(payload.subjectRef ?? ''),
        reasonCodes: Array.isArray(payload.reasonCodes) ? payload.reasonCodes : [],
        ...(payload.screeningId ? { screeningId: String(payload.screeningId) } : {}),
      },
    });
    return;
  }
  if (event.eventType === 'ComplianceCaseDecided') {
    events.append({
      eventType: 'ComplianceCaseDecided',
      schemaVersion: 1,
      occurredAt,
      payload: {
        caseId: String(payload.caseId ?? ''),
        decision: String(payload.decision ?? ''),
        reasonCodes: Array.isArray(payload.reasonCodes) ? payload.reasonCodes : [],
      },
    });
    return;
  }
  if (event.eventType === 'ComplianceAlertCreated') {
    events.append({
      eventType: 'ComplianceAlertCreated',
      schemaVersion: 1,
      occurredAt,
      payload: {
        alertId: String(payload.alertId ?? ''),
        outcome: String(payload.outcome ?? ''),
        subjectRef: String(payload.subjectRef ?? ''),
        reasonCodes: Array.isArray(payload.reasonCodes) ? payload.reasonCodes : [],
      },
    });
    return;
  }
  events.append({
    eventType: 'FraudRiskEvaluated',
    schemaVersion: 1,
    occurredAt,
    payload: {
      evaluationId: String(payload.evaluationId ?? ''),
      outcome: String(payload.outcome ?? ''),
      subjectRef: String(payload.subjectRef ?? ''),
      reasonCodes: Array.isArray(payload.reasonCodes) ? payload.reasonCodes : [],
    },
  });
}

export { FrozenClock };
