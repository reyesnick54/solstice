import { FrozenClock } from '../packages/config/src/clock.ts';
import { type Account } from '../packages/domain/src/account.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../packages/events/src/events.ts';
import { InvestmentsService } from '../packages/investments/src/service.ts';
import { Money } from '../packages/money/src/money.ts';
import { EconomicGraphService } from '../packages/personal-economic-graph/src/service.ts';
import { GrowthOrchestrator } from '../packages/platform/src/service.ts';
import { GrowLifecycleService } from '../packages/platform/src/grow/service.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import {
  createUniversalProviderRuntime,
  seedSimulationProviders,
} from '../packages/sunrey-chain/src/provider-runtime/universal/index.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createSimulationRuntime, type SimulationRuntime } from '../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent } from '../services/accounts/src/test-helpers.ts';
import { createAccountsReadAdapter } from '../services/api/src/consumer/accounts-adapter.ts';
import { GrowBffSurface } from '../services/api/src/consumer/grow.ts';
import { handleConsumerBff, type BffRequest, type BffResponse, type ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';
import { ConsumerBff, memoryPreferenceStore } from '../services/api/src/consumer/orchestrator.ts';
import type { BffPrincipal, GrowPortfolioPort } from '../services/api/src/consumer/ports.ts';
import { startConsumerBff } from '../services/api/src/consumer/http.ts';

export const PHASE_E_NOW = asUtcInstant('2026-08-22T12:00:00.000Z');
export const PHASE_E_TOKEN = 'sandbox.phase_e_grow';

export type PhaseEWorld = {
  readonly runtime: SimulationRuntime;
  readonly clock: FrozenClock;
  readonly principal: BffPrincipal;
  readonly actor: unknown;
  readonly peg: EconomicGraphService;
  readonly orchestrator: GrowthOrchestrator;
  readonly grow: GrowLifecycleService;
  readonly investments: InvestmentsService;
  readonly growBff: GrowBffSurface;
  readonly providers: ReturnType<typeof createUniversalProviderRuntime>;
  readonly demand: Account;
  readonly brokerage: Account;
  readonly handle: (
    request: Omit<BffRequest, 'authorization' | 'body' | 'query'> & {
      readonly authorization?: string;
      readonly body?: unknown;
      readonly query?: Readonly<Record<string, string>>;
    },
  ) => BffResponse;
  readonly startHttp: () => ReturnType<typeof startConsumerBff>;
};

export function createPhaseEWorld(suffix = 'e1'): PhaseEWorld {
  const clock = new FrozenClock(PHASE_E_NOW);
  const runtime = createSimulationRuntime({ clock, provisionSimulatedActor: true });
  const customer = activateCustomer(runtime, `cust_phase_e_${suffix}`);
  const seeded = seedSimulationCatalog();
  const demand = mustOpen(
    runtime.accountsService.open(
      openIntent({ id: `${suffix}_open_d`, accountId: `acct_${suffix}_d`, ownerId: customer.id }),
    ),
  );
  const brokerage = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${suffix}_open_b`,
        accountId: `acct_${suffix}_b`,
        ownerId: customer.id,
        productId: asProductId('prod_brokerage_cash_usd_gb'),
        accountClass: 'BROKERAGE_CASH',
      }),
    ),
  );
  const securities = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${suffix}_open_s`,
        accountId: `acct_${suffix}_s`,
        ownerId: customer.id,
        productId: asProductId('prod_securities_usd_gb'),
        accountClass: 'SECURITIES',
      }),
    ),
  );
  const pending = mustOpen(
    runtime.accountsService.open(
      openIntent({
        id: `${suffix}_open_p`,
        accountId: `acct_${suffix}_p`,
        ownerId: customer.id,
        productId: asProductId('prod_pending_usd_gb'),
        accountClass: 'PENDING_SETTLEMENT',
      }),
    ),
  );
  const funded = runtime.money.deposit({
    id: asIntentId(`${suffix}_dep`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `${suffix}_dep`,
    actorId: 'operator_1',
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: demand.id, amount: Money.fromMinorUnits(500_000n, 'USD') },
  });
  if (funded.outcome !== 'POSTED') {
    throw new Error(`phase e deposit failed: ${funded.outcome}`);
  }

  const actorId = `actor_phase_e_${suffix}`;
  const identityId = `idn_phase_e_${suffix}`;
  const provisioned = runtime.identity.provisionSimulatedActor({
    actorId,
    identityId,
    jurisdiction: asJurisdiction('GB'),
    customerId: customer.id,
    capabilities: [
      'VIEW_ACCOUNT',
      'VIEW_GROWTH_PLAN',
      'CONFIRM_ECONOMIC_MANDATE',
      'VIEW_ECONOMIC_GRAPH',
      'DECLARE_ECONOMIC_FACT',
      'INVESTMENT_OPERATE_REQUEST',
      'INVESTMENT_PROPOSE',
    ],
    stepUp: true,
  });
  if (!provisioned.ok) {
    throw new Error(provisioned.error.message);
  }
  const actorResult = runtime.identity.service.resolveActorContext(actorId);
  if (!actorResult.ok) {
    throw new Error('phase e actor');
  }
  const actor = actorResult.value;
  const session = runtime.identity.service.activeSessionForActor(actorId);
  const facts = runtime.identity.service.identityFactsFor(actorId);
  const principal: BffPrincipal = Object.freeze({
    actorId,
    customerId: customer.id,
    identityId: actor.subjectId,
    sessionId: session?.sessionId ?? `ses_phase_e_${suffix}`,
    jurisdiction: 'GB',
    verification: 'VERIFIED',
    customerStatus: 'ACTIVE',
    identityStatus: 'ACTIVE',
    capabilities: facts.authorizedCapabilities,
    risk: 'STANDARD',
    restricted: false,
    sandboxPersona: 'investment',
    deviceSummary: Object.freeze({ deviceId: session?.deviceId ?? null, trustState: 'KNOWN' }),
  });

  const events = runtime.events;
  const evidence = runtime.evidence;
  const peg = new EconomicGraphService({ clock, events });
  seedPhaseEPeg(peg, actor, principal.identityId, customer.id, demand.id, brokerage.id);
  const orchestrator = new GrowthOrchestrator({ clock, events, peg, evidence });
  const compiled = orchestrator.interpretAndCompile(actor, {
    subjectId: principal.identityId,
    sourceText:
      'Keep at least $500 liquid. Build my emergency fund. Invest eligible surplus later. Ask me before any movement over $100.',
  });
  if (!compiled.ok) {
    throw new Error(`mandate compile failed: ${'message' in compiled.error ? compiled.error.message : compiled.error.code}`);
  }
  const activated = orchestrator.confirmAndActivate(actor, principal.identityId);
  if (!activated.ok) {
    throw new Error(`mandate activate failed: ${'message' in activated.error ? activated.error.message : activated.error.code}`);
  }
  const grow = new GrowLifecycleService({ clock, evidence });
  const investments = new InvestmentsService(
    runtime.kernel,
    runtime.issuer,
    evidence,
    events,
    clock,
    {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    runtime.identity.service,
    runtime.ledger,
  );
  const providers = createUniversalProviderRuntime();
  seedSimulationProviders(providers, PHASE_E_NOW);
  const openedInvest = investments.openInvestmentAccount({
    id: asIntentId(`${suffix}_inv_open`),
    actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
    idempotencyKey: `${suffix}_inv_open`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: demand.id,
      investmentAccountId: `inv_${suffix}`,
      customerId: customer.id,
      brokerageCashAccountId: brokerage.id,
      securitiesAccountId: securities.id,
      pendingSettlementAccountId: pending.id,
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  });
  if (openedInvest.outcome !== 'OK') {
    throw new Error(`phase e investment profile: ${openedInvest.outcome}`);
  }
  const growBff = new GrowBffSurface({
    peg,
    orchestrator,
    grow,
    investments,
    providers,
    ledger: runtime.ledger,
    accounts: runtime.accounts,
    resolveActor: (id) => {
      const resolved = runtime.identity.service.resolveActorContext(id);
      return resolved.ok ? resolved.value : null;
    },
    now: () => clock.now(),
    investmentAccountsFor: (customerId) =>
      customerId === customer.id
        ? {
            investmentAccountId: `inv_${suffix}`,
            demandAccountId: demand.id,
            brokerageCashAccountId: brokerage.id,
            securitiesAccountId: securities.id,
            pendingSettlementAccountId: pending.id,
          }
        : null,
    suitabilityFor: (row) => ({
      kycComplete: row.verification === 'VERIFIED',
      jurisdictionPermitted: row.jurisdiction === 'GB' || row.jurisdiction === 'US',
      accountRestricted: row.restricted,
      customerEligible: row.customerStatus === 'ACTIVE',
      riskProfile: row.risk === 'RESTRICTED' ? 'LOW' : 'MODERATE',
      proposalRiskClass: 'MODERATE',
    }),
  });
  const growPortfolio: GrowPortfolioPort = {
    summarize: () =>
      Object.freeze({
        availability: 'AVAILABLE_SIMULATION',
        state: 'SIMULATION_ONLY',
        provider: 'SIMULATED',
        reason: 'Grow My Money sandbox productization',
        count: 1,
      }),
    portfolio: (row) => growBff.portfolio(row, 'req_phase_e'),
    holdings: (row) => {
      const view = growBff.portfolio(row, 'req_phase_e');
      return view && typeof view === 'object' && 'holdings' in view ? view.holdings : view;
    },
    performance: (row) => growBff.performance(row, 'req_phase_e'),
    allocation: (row) => {
      const view = growBff.portfolio(row, 'req_phase_e');
      return view && typeof view === 'object' && 'allocation' in view ? view.allocation : view;
    },
    risk: (row) => {
      const view = growBff.portfolio(row, 'req_phase_e');
      return view && typeof view === 'object' && 'risk' in view ? view.risk : view;
    },
  };
  const bff = new ConsumerBff({
    now: () => clock.now(),
    accounts: createAccountsReadAdapter(runtime),
    preferences: memoryPreferenceStore(),
    grow: {
      summarize: () =>
        Object.freeze({
          availability: 'AVAILABLE_SIMULATION',
          state: 'SIMULATION_ONLY',
          provider: 'SIMULATED',
          reason: 'Grow My Money sandbox productization',
          count: 1,
        }),
    },
    growPortfolio,
    providerRuntime: providers,
  });
  const sessions = new Map([[PHASE_E_TOKEN, principal]]);
  const consumerRuntime: ConsumerBffRuntime = {
    bff,
    sessions,
    identity: runtime.identity.service,
    grow: growBff,
  };
  return {
    runtime,
    clock,
    principal,
    actor,
    peg,
    orchestrator,
    grow,
    investments,
    growBff,
    providers,
    demand,
    brokerage,
    handle: (request) =>
      handleConsumerBff(consumerRuntime, {
        method: request.method,
        path: request.path,
        query: request.query ?? {},
        body: request.body,
        authorization: request.authorization ?? `Bearer ${PHASE_E_TOKEN}`,
        requestId: request.requestId ?? 'req_phase_e',
        ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
      }),
    startHttp: () => startConsumerBff({ runtime: consumerRuntime }),
  };
}

function mustOpen(result: { readonly outcome: string; readonly account?: Account }): Account {
  if (result.outcome !== 'OPENED' || !result.account) {
    throw new Error(`account open failed: ${result.outcome}`);
  }
  return result.account;
}

function seedPhaseEPeg(
  peg: EconomicGraphService,
  actor: unknown,
  subjectId: string,
  customerId: string,
  demandId: string,
  savingsId: string,
): void {
  peg.registerAccountCurrency(demandId, 'USD');
  peg.registerAccountCurrency(savingsId, 'USD');
  peg.openGraph(actor, subjectId, asCustomerId(customerId));
  peg.registerOverlay({
    sourceEventId: `${subjectId}_sal`,
    subjectId,
    classification: 'SALARY',
    counterpart: { kind: 'EMPLOYER', ref: 'acme', label: 'Acme' },
  });
  peg.ingestAll(
    [
      event('AccountOpened', { accountId: demandId, ownerId: customerId, accountClass: 'DEMAND_DEPOSIT' }, `${subjectId}_open_d`),
      event('AccountOpened', { accountId: savingsId, ownerId: customerId, accountClass: 'SAVINGS_DEPOSIT' }, `${subjectId}_open_s`),
      event('DepositPosted', { journalId: 'j1', accountId: demandId, amountMinorUnits: '500000', currency: 'USD' }, `${subjectId}_sal`),
      event('AccountPositionChanged', { accountId: demandId, amountMinorUnits: '500000', currency: 'USD' }, `${subjectId}_pos`),
    ],
    subjectId,
  );
  peg.declareIncomeSource(actor, subjectId, {
    incomeKind: 'SALARY',
    label: 'Salary',
    estimatedAmount: { minorUnits: '400000', currency: 'USD' },
  });
  peg.declareGoal(actor, subjectId, {
    goalKind: 'EMERGENCY_RESERVE',
    label: 'Emergency fund',
    target: { minorUnits: '2000000', currency: 'USD' },
    priority: 1,
  });
  peg.materializeRecurring(subjectId);
  peg.proposeOpportunities(subjectId);
}

function event(eventType: DomainEvent['eventType'], payload: Record<string, unknown>, eventId: string): DomainEvent {
  return {
    eventType,
    schemaVersion: 1,
    occurredAt: PHASE_E_NOW,
    eventId,
    payload,
  } as DomainEvent;
}

