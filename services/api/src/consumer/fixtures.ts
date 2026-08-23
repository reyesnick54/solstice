/**
 * Deterministic sandbox personas for Lovable / frontend development.
 * Clearly non-production. Balances are posted only through Kernel-gated
 * services/accounts — the BFF never invents ledger amounts.
 */

import { FrozenClock } from '../../../../packages/config/src/clock.ts';
import { asAccountId } from '../../../../packages/domain/src/account.ts';
import type { AccountClass } from '../../../../packages/domain/src/account-class.ts';
import {
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
} from '../../../../packages/domain/src/customer.ts';
import { asCurrencyCode } from '../../../../packages/domain/src/currency.ts';
import { asJurisdiction, asResidency } from '../../../../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../../../packages/domain/src/legal-entity.ts';
import { asProductId, type ProductId } from '../../../../packages/domain/src/product.ts';
import { isOk } from '../../../../packages/domain/src/result.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { asHoldId, freezeHold } from '../../../../packages/domain/src/hold.ts';
import type { IdentityCapability } from '../../../../packages/identity/src/capability.ts';
import { Money } from '../../../../packages/money/src/money.ts';
import { asIntentId } from '../../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type OpenAccountIntent, type PostDepositIntent } from '../../../../packages/permissions/src/action-types.ts';
import { PaymentsService } from '../../../../packages/payments/src/service.ts';
import { PaymentPlatform } from '../../../../packages/payments/src/platform/orchestrator.ts';
import { createSimulationRuntime, type SimulationRuntime } from '../../../accounts/src/runtime.ts';
import {
  createUniversalProviderRuntime,
  seedSimulationProviders,
} from '../../../../packages/sunrey-chain/src/provider-runtime/universal/index.ts';
import { InMemorySecretProvider } from '../../../../packages/security/src/secrets.ts';
import { CardsService } from '../../../../packages/cards/src/service.ts';
import { SIMULATION_GB_VIRTUAL_PROGRAM } from '../../../../packages/cards/src/program.ts';
import { createCardHoldGateway } from '../../../cards/src/hold-gateway.ts';
import { ConsumerCardsFacade } from '../../../cards/src/consumer.ts';
import { seedSimulationCatalog } from '../../../accounts/src/catalog.ts';
import { EconomicGraphService } from '../../../../packages/personal-economic-graph/src/service.ts';
import { GrowthOrchestrator } from '../../../../packages/platform/src/service.ts';
import { createAccountsReadAdapter } from './accounts-adapter.ts';
import { createGrowCommandPort } from './grow-adapter.ts';
import { createFxCommandPort } from './fx-adapter.ts';
import { createGrowOpportunityPort } from './grow-adapter.ts';
import {
  applyPersonaSeed,
  PEG_PERSONA_SEEDS,
  type PegPersonaId,
} from '../../../economic-graph/src/index.ts';
import type { ActionStatusResource } from './action-status.ts';
import { ConsumerBff, memoryPreferenceStore } from './orchestrator.ts';
import { createSandboxAgentRuntime, provisionSandboxAgent } from './agent.ts';
import type { AgentConversationRuntime } from '../../../../packages/sunrey-agent/src/runtime.ts';
import type {
  BffPrincipal,
  FeatureCapabilityMap,
  GrowPortfolioPort,
  OptionalDomainPort,
  OptionalDomainSummary,
} from './ports.ts';
import {
  asInvestmentAccountId,
  InvestmentPlatform,
  InvestmentsService,
} from '../../../investments/src/index.ts';
import type { SessionDirectory } from './session.ts';
import { ProductGrowthService } from '../../../../packages/platform/src/growth/product/service.ts';
import { createAgentConversationSurface, type AgentConversationSurface } from './conversation.ts';
import { createWalletProductFromKernel } from '../../../../packages/custody/src/product/sandbox.ts';
import type { WalletProductService } from '../../../../packages/custody/src/product/service.ts';

export const SANDBOX_LABEL = 'SANDBOX_FIXTURE_NON_PRODUCTION' as const;

export const SANDBOX_PERSONA_IDS = [
  'basic_verified',
  'kyc_pending',
  'multi_currency',
  'investment',
  'agent_enabled',
  'exchange',
  'restricted',
  'provider_down',
  'pending_activity',
  'zero_balance',
  'grow',
  'grow_new_user',
  'grow_healthy_saver',
  'grow_high_idle_cash',
  'grow_high_spender',
  'grow_investor',
  'grow_multi_currency',
  'grow_goal_oriented',
  'grow_liquidity_constrained',
  'grow_high_concentration',
] as const;
export type SandboxPersonaId = (typeof SANDBOX_PERSONA_IDS)[number];

export function sandboxToken(persona: SandboxPersonaId): string {
  return `sandbox.${persona}`;
}

const NOW = asUtcInstant('2026-08-21T09:00:00.000Z');

const READ_CAPABILITIES: readonly IdentityCapability[] = [
  'VIEW_ACCOUNT',
  'MANAGE_PROFILE',
  'VIEW_ECONOMIC_GRAPH',
  'DECLARE_ECONOMIC_FACT',
  'VIEW_GROWTH_PLAN',
  'VIEW_ECONOMIC_GRAPH',
  'VIEW_ECONOMIC_VALUE',
  'VAULT_VIEW_OWN',
  'EXCHANGE_VIEW',
  'PAYMENT_REQUEST',
  'FX_QUOTE_REQUEST',
  'TRANSFER_REQUEST',
  'MANAGE_BENEFICIARY',
  'PAYMENT_APPROVE',
  'POST_WITHDRAWAL_REQUEST',
  'CARD_MANAGE_REQUEST',
  'CUSTODY_OPERATE_REQUEST',
  'ADD_WITHDRAWAL_DESTINATION',
];

export type SandboxWorld = {
  readonly label: typeof SANDBOX_LABEL;
  readonly production: false;
  readonly runtime: SimulationRuntime;
  readonly bff: ConsumerBff;
  readonly sessions: SessionDirectory;
  readonly personas: Readonly<Record<SandboxPersonaId, BffPrincipal>>;
  readonly payments: PaymentPlatform;
  readonly agentRuntime: AgentConversationRuntime;
  readonly grow: ProductGrowthService;
  readonly conversation: AgentConversationSurface;
  readonly wallets: WalletProductService;
};

export function createSandboxWorld(options: { readonly providerDown?: boolean } = {}): SandboxWorld {
  const runtime = createSimulationRuntime({
    clock: new FrozenClock(NOW),
    provisionSimulatedActor: true,
  });
  const providerRuntime = createUniversalProviderRuntime();
  seedSimulationProviders(providerRuntime, NOW);
  if (options.providerDown) {
    for (const providerId of ['sim-payments', 'sim-fx', 'sim-cards'] as const) {
      providerRuntime.observeHealth({
        providerId,
        success: false,
        latencyMs: null,
        nowUtc: NOW,
      });
      providerRuntime.observeHealth({
        providerId,
        success: false,
        latencyMs: null,
        nowUtc: NOW,
      });
      providerRuntime.observeHealth({
        providerId,
        success: false,
        latencyMs: null,
        nowUtc: NOW,
      });
    }
  }
  const sessions: SessionDirectory = new Map();
  const personas = {} as Record<SandboxPersonaId, BffPrincipal>;
  const pendingActions = new Map<string, ActionStatusResource[]>();
  const agentCounts = new Map<string, number>();

  const basic = provisionPersona(runtime, {
    persona: 'basic_verified',
    customerId: 'cust_sandbox_basic',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [{ id: 'acct_sandbox_basic_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 25_000n }],
  });
  personas.basic_verified = basic.principal;
  sessions.set(sandboxToken('basic_verified'), basic.principal);

  const pending = provisionPersona(runtime, {
    persona: 'kyc_pending',
    customerId: 'cust_sandbox_kyc',
    kyc: 'IN_PROGRESS',
    customerActive: false,
    restricted: false,
    accounts: [],
  });
  personas.kyc_pending = pending.principal;
  sessions.set(sandboxToken('kyc_pending'), pending.principal);
  pendingActions.set(pending.principal.customerId, [
    Object.freeze({
      actionId: 'act_kyc_resume',
      kind: 'IDENTITY_VERIFICATION',
      status: 'ACTION_REQUIRED',
      approvalRequirement: 'STEP_UP_AUTHENTICATION',
      regulated: true,
      title: 'Complete identity verification',
      detail: 'KYC is in progress. This is a regulated state, not a UI shortcut.',
      createdAt: NOW,
    }),
  ]);

  const multi = provisionPersona(runtime, {
    persona: 'multi_currency',
    customerId: 'cust_sandbox_fx',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [
      { id: 'acct_sandbox_fx_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 200_000n },
      { id: 'acct_sandbox_fx_gbp', currency: 'GBP', productId: 'prod_demand_gbp_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 8_000n },
      { id: 'acct_sandbox_fx_sar', currency: 'SAR', productId: 'prod_demand_sar_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 8_000n },
    ],
  });
  personas.multi_currency = multi.principal;
  sessions.set(sandboxToken('multi_currency'), multi.principal);

  const invest = provisionPersona(runtime, {
    persona: 'investment',
    customerId: 'cust_sandbox_invest',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [
      { id: 'acct_sandbox_invest_cash', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 40_000n },
      { id: 'acct_sandbox_invest_sec', currency: 'USD', productId: 'prod_securities_usd_gb', accountClass: 'SECURITIES', deposit: 0n },
      { id: 'acct_sandbox_invest_brokerage', currency: 'USD', productId: 'prod_brokerage_cash_usd_gb', accountClass: 'BROKERAGE_CASH', deposit: 0n },
      { id: 'acct_sandbox_invest_pending', currency: 'USD', productId: 'prod_pending_usd_gb', accountClass: 'PENDING_SETTLEMENT', deposit: 0n },
    ],
  });
  personas.investment = invest.principal;
  sessions.set(sandboxToken('investment'), invest.principal);
  const growPortfolio = attachSandboxGrow(runtime, invest.principal);

  const agent = provisionPersona(runtime, {
    persona: 'agent_enabled',
    customerId: 'cust_sandbox_agent',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [{ id: 'acct_sandbox_agent_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 12_000n }],
  });
  personas.agent_enabled = agent.principal;
  sessions.set(sandboxToken('agent_enabled'), agent.principal);
  agentCounts.set(agent.principal.customerId, 2);
  const agentRuntime = createSandboxAgentRuntime(NOW);
  provisionSandboxAgent(agentRuntime, agent.principal, 'acct_sandbox_agent_usd');
  pendingActions.set(agent.principal.customerId, [
    Object.freeze({
      actionId: 'act_agent_proposal_1',
      kind: 'AGENT_PROPOSAL',
      status: 'AWAITING_APPROVAL',
      approvalRequirement: 'CUSTOMER_CONFIRMATION',
      regulated: true,
      title: 'Review agent proposal',
      detail: 'ALLOW on an agent-originated decision is not Execution Authority.',
      createdAt: NOW,
    }),
  ]);

  const exchange = provisionPersona(runtime, {
    persona: 'exchange',
    customerId: 'cust_sandbox_exchange',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [{ id: 'acct_sandbox_exchange_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 9_000n }],
  });
  personas.exchange = exchange.principal;
  sessions.set(sandboxToken('exchange'), exchange.principal);

  const restricted = provisionPersona(runtime, {
    persona: 'restricted',
    customerId: 'cust_sandbox_restricted',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: true,
    accounts: [{ id: 'acct_sandbox_restricted_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 5_000n }],
  });
  personas.restricted = restricted.principal;
  sessions.set(sandboxToken('restricted'), restricted.principal);
  runtime.accountProduct.applyRestriction({
    accountId: 'acct_sandbox_restricted_usd',
    code: 'COMPLIANCE_REVIEW',
    reason: 'sandbox restricted persona',
    actorId: 'operator_1',
  });

  const pendingActivity = provisionPersona(runtime, {
    persona: 'pending_activity',
    customerId: 'cust_sandbox_pending',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [{ id: 'acct_sandbox_pending_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 15_000n }],
  });
  personas.pending_activity = pendingActivity.principal;
  sessions.set(sandboxToken('pending_activity'), pendingActivity.principal);
  runtime.holds.put(
    freezeHold({
      id: asHoldId('hold_sandbox_pending'),
      accountId: asAccountId('acct_sandbox_pending_usd'),
      currency: asCurrencyCode('USD'),
      amountMinorUnits: 2_500n,
      purpose: 'OUTGOING_TRANSFER',
      state: 'ACTIVE',
      idempotencyKey: 'hold_sandbox_pending',
      createdAt: NOW,
      updatedAt: NOW,
      expiresAt: null,
      captureJournalId: null,
      epoch: 1,
    }),
  );

  const zero = provisionPersona(runtime, {
    persona: 'zero_balance',
    customerId: 'cust_sandbox_zero',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [{ id: 'acct_sandbox_zero_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 0n }],
  });
  personas.zero_balance = zero.principal;
  sessions.set(sandboxToken('zero_balance'), zero.principal);

  const providerDown = provisionPersona(runtime, {
    persona: 'provider_down',
    customerId: 'cust_sandbox_provider_down',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [{ id: 'acct_sandbox_provider_down_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 7_500n }],
  });
  personas.provider_down = providerDown.principal;
  sessions.set(sandboxToken('provider_down'), providerDown.principal);

  const growPersona = provisionPersona(runtime, {
    persona: 'grow',
    customerId: 'cust_sandbox_grow',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [
      { id: 'acct_sandbox_grow_checking', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 200_000n },
      { id: 'acct_sandbox_grow_savings', currency: 'USD', productId: 'prod_savings_usd_gb', accountClass: 'SAVINGS_DEPOSIT', deposit: 0n },
    ],
  });
  personas.grow = growPersona.principal;
  sessions.set(sandboxToken('grow'), growPersona.principal);
  const peg = new EconomicGraphService({ clock: new FrozenClock(NOW), events: runtime.events });
  const growPersonaMap: Readonly<Record<string, PegPersonaId>> = {
    grow_new_user: 'NEW_USER',
    grow_healthy_saver: 'HEALTHY_SAVER',
    grow_high_idle_cash: 'HIGH_IDLE_CASH',
    grow_high_spender: 'HIGH_SPENDER',
    grow_investor: 'INVESTOR',
    grow_multi_currency: 'MULTI_CURRENCY_USER',
    grow_goal_oriented: 'GOAL_ORIENTED_USER',
    grow_liquidity_constrained: 'LIQUIDITY_CONSTRAINED_USER',
    grow_high_concentration: 'HIGH_CONCENTRATION_USER',
  };
  for (const [sandboxId, personaId] of Object.entries(growPersonaMap)) {
    const seed = PEG_PERSONA_SEEDS.find((row) => row.personaId === personaId);
    if (!seed) {
      throw new Error(`missing PEG seed ${personaId}`);
    }
    const provisioned = provisionPersona(runtime, {
      persona: sandboxId as SandboxPersonaId,
      identityId: seed.subjectId,
      customerId: seed.customerId,
      kyc: 'VERIFIED',
      customerActive: true,
      restricted: false,
      accounts: [],
    });
    personas[sandboxId as SandboxPersonaId] = provisioned.principal;
    sessions.set(sandboxToken(sandboxId as SandboxPersonaId), provisioned.principal);
    const actor = runtime.identity.service.resolveActorContext(provisioned.principal.actorId);
    if (!actor.ok) {
      throw new Error(`grow actor missing for ${sandboxId}`);
    }
    applyPersonaSeed(peg, actor.value, seed);
  }

  const simulationPort = (reason: string, count = 0): OptionalDomainPort => ({
    summarize: () =>
      Object.freeze({
        availability: 'AVAILABLE_SIMULATION',
        state: 'SIMULATION_ONLY',
        provider: 'SIMULATED',
        reason,
        count,
      } satisfies OptionalDomainSummary),
  });

  const seeded = seedSimulationCatalog();
  const paymentsService = new PaymentsService(
    runtime.kernel,
    runtime.issuer,
    runtime.ledger,
    runtime.evidence,
    runtime.events,
    runtime.clock,
    {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    runtime.identity.service,
  );
  const payments = new PaymentPlatform(paymentsService, {
    kernel: runtime.kernel,
    issuer: runtime.issuer,
    ledger: runtime.ledger,
    evidence: runtime.evidence,
    events: runtime.events,
    clock: runtime.clock,
    catalog: {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    identity: runtime.identity.service,
    sessionFor: (actorId) => runtime.identity.service.activeSessionForActor(actorId),
  });

  const grow = new ProductGrowthService({
    clock: runtime.clock,
    events: runtime.events,
    evidence: runtime.evidence,
  });

  const bff = new ConsumerBff({
    now: () => runtime.clock.now(),
    accounts: createAccountsReadAdapter(runtime),
    preferences: memoryPreferenceStore(),
    fxEngine: createFxCommandPort(paymentsService, () => runtime.clock.now()),
    actions: {
      list(principal) {
        return pendingActions.get(principal.customerId) ?? [];
      },
    },
    notifications: {
      summarize() {
        return Object.freeze({
          availability: 'NOT_YET_PRODUCTIZED',
          state: 'FEATURE_DISABLED',
          provider: 'NOT_CONNECTED',
          reason: 'notification store is not productized',
          unreadCount: 0,
        });
      },
    },
    security: {
      alerts(principal) {
        if (principal.restricted) {
          return [
            Object.freeze({
              alertId: 'sec_restricted',
              severity: 'RESTRICTED',
              title: 'Account restricted',
              detail: 'Regulated restriction is visible to the client. It is not hidden for UI simplicity.',
            }),
          ];
        }
        return [];
      },
    },
    growPortfolio,
    grow: createGrowOpportunityPort({
      orchestrator: new GrowthOrchestrator({
        clock: runtime.clock,
        events: runtime.events,
        peg: new EconomicGraphService({ clock: runtime.clock, events: runtime.events }),
      }),
      accounts: createAccountsReadAdapter(runtime),
      actorFor(principal) {
        const actor = runtime.identity.service.resolveActorContext(principal.actorId);
        return actor.ok ? actor.value : principal;
      },
    }),
    growCommands: createGrowCommandPort({
      peg,
      identity: runtime.identity.service,
      valuePositions: (positions, target) => paymentsService.valuePositions(positions, target),
    }),
    agent: {
      summarize(principal) {
        const count = agentCounts.get(principal.customerId) ?? 0;
        return Object.freeze({
          availability: 'AVAILABLE_SIMULATION',
          state: count === 0 ? 'EMPTY' : 'SIMULATION_ONLY',
          provider: 'SIMULATED',
          reason: 'agent recommendations are proposals; the BFF cannot execute',
          count,
        });
      },
    },
    exchange: simulationPort('consumer Exchange APIs are simulation-only', 0),
    payments: simulationPort('payments rails are simulated', 0),
    fx: simulationPort('FX quotes are indicative simulation only', 0),
    cards: simulationPort('simulated card issuing; live processors are not connected', 1),
    cardFacade: options.providerDown ? undefined : attachSandboxCards(runtime, personas.basic_verified),
    vault: simulationPort('Personal Data Vault is subject-bound and simulated', 0),
    providerDown: options.providerDown ? { cards: true, payments: true, fx: true, custody: true } : {},
    providerRuntime,
  });

  const wallets = attachSandboxWallets(runtime, personas, { providerDown: options.providerDown === true });

  return Object.freeze({
    label: SANDBOX_LABEL,
    production: false,
    runtime,
    bff,
    sessions,
    personas: Object.freeze(personas),
    payments,
    agentRuntime,
    grow,
    conversation: createAgentConversationSurface(),
    wallets,
  });
}

function attachSandboxWallets(
  runtime: SimulationRuntime,
  personas: Record<SandboxPersonaId, BffPrincipal>,
  options: { readonly providerDown: boolean },
): WalletProductService {
  const wired = createWalletProductFromKernel({
    clock: runtime.clock,
    kernel: runtime.kernel,
    issuer: runtime.issuer,
    evidence: runtime.evidence,
    events: runtime.events,
    identity: runtime.identity.service,
    keyProvider: runtime.keyProvider,
    customers: { get: (id) => runtime.customers.get(id as ReturnType<typeof asCustomerId>) },
    chainAvailable: !options.providerDown,
    custodyAvailable: !options.providerDown,
  });
  const seeds: readonly { persona: SandboxPersonaId; walletId: string; assetId: 'SUNREY_COIN' | 'MOONREY_COIN'; status?: 'ACTIVE' | 'RESTRICTED'; seed: bigint }[] = [
    { persona: 'basic_verified', walletId: 'wal_sandbox_basic_sunrey', assetId: 'SUNREY_COIN', seed: 2_000_000n },
    { persona: 'basic_verified', walletId: 'wal_sandbox_basic_moonrey', assetId: 'MOONREY_COIN', seed: 1_000_000n },
    { persona: 'exchange', walletId: 'wal_sandbox_exchange_sunrey', assetId: 'SUNREY_COIN', seed: 1_500_000n },
    { persona: 'agent_enabled', walletId: 'wal_sandbox_agent_sunrey', assetId: 'SUNREY_COIN', seed: 800_000n },
    { persona: 'restricted', walletId: 'wal_sandbox_restricted_sunrey', assetId: 'SUNREY_COIN', status: 'RESTRICTED', seed: 100_000n },
  ];
  for (const seed of seeds) {
    const principal = personas[seed.persona];
    wired.product.provisionWallet({
      walletId: seed.walletId,
      ownerId: principal.customerId,
      assetId: seed.assetId,
      custodyModel: 'SUNREY_NATIVE',
      ...(seed.status ? { status: seed.status } : {}),
      seedMinorUnits: seed.seed,
      withdrawalEnabled: seed.status !== 'RESTRICTED',
    });
  }
  return wired.product;
}

function provisionPersona(
  runtime: SimulationRuntime,
  input: {
    readonly persona: SandboxPersonaId;
    readonly identityId?: string;
    readonly customerId: string;
    readonly kyc: 'VERIFIED' | 'IN_PROGRESS';
    readonly customerActive: boolean;
    readonly restricted: boolean;
    readonly accounts: readonly {
      readonly id: string;
      readonly currency: string;
      readonly productId: string;
      readonly accountClass: AccountClass;
      readonly deposit: bigint;
    }[];
  },
): { readonly principal: BffPrincipal; readonly customer: Customer } {
  const customer = seedCustomer(runtime, input.customerId, input.customerActive, input.kyc === 'VERIFIED');
  const actorId = `actor_sandbox_${input.persona}`;
  const provisioned = runtime.identity.provisionSimulatedActor({
    actorId,
    identityId: input.identityId ?? `idn_sandbox_${input.persona}`,
    jurisdiction: asJurisdiction('GB'),
    customerId: customer.id,
    capabilities: READ_CAPABILITIES,
    stepUp: input.kyc === 'VERIFIED' && !input.restricted,
  });
  if (!provisioned.ok) {
    throw new Error(`sandbox identity failed: ${provisioned.error.message}`);
  }
  const identity = runtime.identity.service.store.identities.get(input.identityId ?? `idn_sandbox_${input.persona}`);
  if (!identity) {
    throw new Error('sandbox identity missing after provision');
  }
  if (input.kyc === 'IN_PROGRESS') {
    runtime.identity.service.recordKyc({
      identityId: identity.id,
      providerRef: 'sandbox:kyc',
      verificationState: 'IN_PROGRESS',
      verificationLevel: 'NONE',
      jurisdiction: asJurisdiction('GB'),
      verifiedAttributes: Object.freeze([]),
      verifiedAt: null,
      expiresAt: null,
      reasonCodes: Object.freeze(['SANDBOX_KYC_PENDING']),
      evidenceRefs: Object.freeze([]),
    });
  }
  if (input.restricted) {
    const suspended = runtime.identity.service.suspendIdentity(identity.id);
    if (!suspended.ok) {
      throw new Error(suspended.error.message);
    }
  }

  for (const account of input.accounts) {
    openAndFund(runtime, customer.id, account);
  }

  const session = runtime.identity.service.activeSessionForActor(actorId);
  const facts = runtime.identity.service.identityFactsFor(actorId);
  const principal: BffPrincipal = Object.freeze({
    actorId,
    customerId: customer.id,
    identityId: identity.id,
    sessionId: session?.sessionId ?? `ses_sandbox_${input.persona}`,
    jurisdiction: 'GB',
    verification: input.kyc,
    customerStatus: input.restricted ? 'SUSPENDED' : input.customerActive ? 'ACTIVE' : 'PENDING_VERIFICATION',
    identityStatus: input.restricted ? 'SUSPENDED' : 'ACTIVE',
    capabilities: input.restricted ? ['VIEW_ACCOUNT', 'MANAGE_PROFILE'] : facts.authorizedCapabilities,
    risk: input.restricted ? 'RESTRICTED' : 'LOW',
    restricted: input.restricted,
    sandboxPersona: input.persona,
    deviceSummary: Object.freeze({
      deviceId: session?.deviceId ?? null,
      trustState: input.restricted ? 'BLOCKED' : 'KNOWN',
    }),
  });
  return { principal, customer };
}

function seedCustomer(
  runtime: SimulationRuntime,
  id: string,
  active: boolean,
  verified: boolean,
): Customer {
  let customer = createProspect({
    id: asCustomerId(id),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    residency: asResidency('GB'),
    verification: notStartedVerification(asUtcInstant('2027-08-21T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
  if (!isOk(pending)) {
    throw new Error('sandbox customer could not enter PENDING_VERIFICATION');
  }
  customer = pending.value.customer;
  if (verified) {
    customer = {
      ...customer,
      verification: Object.freeze({
        kycState: 'VERIFIED',
        kycRecordVersion: 1,
        refreshBy: asUtcInstant('2027-08-21T00:00:00.000Z'),
      }),
    };
  }
  if (active && verified) {
    const next = transitionCustomerStatus(customer, 'ACTIVE', NOW);
    if (!isOk(next)) {
      throw new Error('sandbox customer could not activate');
    }
    customer = next.value.customer;
  }
  runtime.customers.put(customer.id, customer);
  return customer;
}

function openAndFund(
  runtime: SimulationRuntime,
  ownerId: string,
  account: {
    readonly id: string;
    readonly currency: string;
    readonly productId: string;
    readonly accountClass: AccountClass;
    readonly deposit: bigint;
  },
): void {
  const open: OpenAccountIntent = {
    id: asIntentId(`open_${account.id}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `open_${account.id}`,
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(account.id),
      ownerId: asCustomerId(ownerId),
      productId: asProductId(account.productId) as ProductId,
      accountClass: account.accountClass,
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode(account.currency),
    },
  };
  const opened = runtime.accountsService.open(open);
  if (opened.outcome !== 'OPENED') {
    throw new Error(`sandbox open failed for ${account.id}: ${opened.outcome}`);
  }
  if (account.deposit <= 0n) {
    return;
  }
  const deposit: PostDepositIntent = {
    id: asIntentId(`dep_${account.id}`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `dep_${account.id}`,
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_FUNDING',
    payload: {
      accountId: opened.account.id,
      amount: Money.fromMinorUnits(account.deposit, account.currency),
    },
  };
  const posted = runtime.money.deposit(deposit);
  if (posted.outcome !== 'POSTED') {
    throw new Error(`sandbox deposit failed for ${account.id}: ${posted.outcome}`);
  }
}

export function listSandboxPersonas(): readonly {
  readonly id: SandboxPersonaId;
  readonly token: string;
  readonly label: typeof SANDBOX_LABEL;
}[] {
  return SANDBOX_PERSONA_IDS.map((id) =>
    Object.freeze({
      id,
      token: sandboxToken(id),
      label: SANDBOX_LABEL,
    }),
  );
}

export function capabilitiesFor(world: SandboxWorld, persona: SandboxPersonaId): FeatureCapabilityMap {
  return world.bff.capabilities(world.personas[persona]);
}

function attachSandboxGrow(runtime: SimulationRuntime, principal: BffPrincipal): GrowPortfolioPort {
  const seeded = seedSimulationCatalog();
  const investments = new InvestmentsService(
    runtime.kernel,
    runtime.issuer,
    runtime.evidence,
    runtime.events,
    runtime.clock,
    {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    runtime.identity.service,
    runtime.ledger,
  );
  const opened = investments.openInvestmentAccount({
    id: asIntentId('sandbox_inv_open'),
    actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
    idempotencyKey: 'sandbox_inv_open',
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: asAccountId('acct_sandbox_invest_cash'),
      investmentAccountId: 'inv_sandbox_invest',
      customerId: asCustomerId(principal.customerId),
      brokerageCashAccountId: asAccountId('acct_sandbox_invest_brokerage'),
      securitiesAccountId: asAccountId('acct_sandbox_invest_sec'),
      pendingSettlementAccountId: asAccountId('acct_sandbox_invest_pending'),
      productId: asProductId('prod_brokerage_cash_usd_gb'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  });
  if (opened.outcome === 'OK') {
    investments.fundBrokerageCash({
      id: asIntentId('sandbox_inv_fund'),
      actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
      idempotencyKey: 'sandbox_inv_fund',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: asAccountId('acct_sandbox_invest_brokerage'),
        sourceAccountId: asAccountId('acct_sandbox_invest_cash'),
        amount: Money.fromMinorUnits(20_000n, 'USD'),
      },
    });
    investments.createPaperOrder({
      id: asIntentId('sandbox_inv_buy'),
      actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
      idempotencyKey: 'sandbox_inv_buy',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: asAccountId('acct_sandbox_invest_brokerage'),
        investmentAccountId: 'inv_sandbox_invest',
        orderId: 'ord_sandbox_invest',
        instrumentId: 'SIM-ETF-1',
        side: 'BUY',
        quantityUnits: '100000000',
        orderType: 'MARKET_SIMULATION',
      },
    });
    investments.valuePortfolio(asInvestmentAccountId('inv_sandbox_invest'));
  }
  const platform = new InvestmentPlatform(investments);
  if (opened.outcome === 'OK') {
    const portfolio = platform.attachFromInvestmentAccount(asInvestmentAccountId('inv_sandbox_invest'), {
      strategyRef: 'sandbox-balanced',
      riskProfileRef: 'moderate',
      goalLinks: Object.freeze(['grow-my-money']),
    });
    if (portfolio) {
      platform.recordCashFlow(portfolio.portfolioId, {
        at: NOW,
        amount: Money.fromMinorUnits(20_000n, 'USD'),
        kind: 'DEPOSIT',
      });
    }
  }
  const deny = (principalRow: BffPrincipal) => {
    if (principalRow.customerId !== principal.customerId) {
      return { error: 'RESOURCE_NOT_OWNED' as const };
    }
    return null;
  };
  const map = <T>(principalRow: BffPrincipal, read: () => { readonly outcome: 'OK'; readonly value: T } | { readonly outcome: 'DENIED'; readonly code: string }) => {
    const cross = deny(principalRow);
    if (cross) {
      return cross;
    }
    const result = read();
    if (result.outcome !== 'OK') {
      return { error: result.code === 'RESOURCE_NOT_OWNED' ? ('RESOURCE_NOT_OWNED' as const) : ('NOT_FOUND' as const) };
    }
    return result.value;
  };
  return {
    summarize() {
      return Object.freeze({
        availability: 'AVAILABLE_SIMULATION',
        state: 'SIMULATION_ONLY',
        provider: 'SIMULATED',
        reason: 'Grow My Money portfolio is a simulation laboratory path',
        count: 1,
      });
    },
    portfolio: (row) => map(row, () => platform.growPortfolio(row.customerId)),
    holdings: (row) => map(row, () => platform.growHoldings(row.customerId, runtime.clock.now())),
    performance: (row) => map(row, () => platform.growPerformance(row.customerId, NOW, runtime.clock.now())),
    allocation: (row) => map(row, () => platform.growAllocation(row.customerId)),
    risk: (row) => map(row, () => platform.growRisk(row.customerId, runtime.clock.now())),
  };
}

function attachSandboxCards(runtime: SimulationRuntime, principal: BffPrincipal): ConsumerCardsFacade {
  const processorActorId = 'actor_sandbox_card_processor';
  const operationsActorId = 'actor_sandbox_card_ops';
  const processor = runtime.identity.provisionSimulatedActor({
    actorId: processorActorId,
    identityId: 'idn_sandbox_card_processor',
    jurisdiction: asJurisdiction('GB'),
    capabilities: ['CARD_AUTHORIZE_REQUEST', 'CARD_CLEAR_REQUEST'],
  });
  const operations = runtime.identity.provisionSimulatedActor({
    actorId: operationsActorId,
    identityId: 'idn_sandbox_card_ops',
    jurisdiction: asJurisdiction('GB'),
    capabilities: ['HOLD_REQUEST', 'CARD_MANAGE_REQUEST'],
    stepUp: true,
  });
  if (!processor.ok || !operations.ok) {
    throw new Error('sandbox card actors failed');
  }
  const secrets = new InMemorySecretProvider('simulation', {
    'card-processor-callback': 'sim-card-processor-hmac-not-a-production-secret',
  });
  const seeded = seedSimulationCatalog();
  const cards = new CardsService(
    runtime.kernel,
    runtime.issuer,
    runtime.ledger,
    runtime.evidence,
    runtime.events,
    runtime.clock,
    {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    runtime.identity.service,
    createCardHoldGateway(runtime.banking, runtime.ledger, runtime.clock),
    secrets,
    { processorActorId, operationsActorId },
  );
  const requested = cards.requestCard({
    id: asIntentId('sandbox_card_basic'),
    actionType: ACTION_TYPES.REQUEST_CARD,
    idempotencyKey: 'sandbox_card_basic',
    actorId: principal.actorId,
    requestedAt: NOW,
    purpose: 'CUSTOMER_CARD',
    payload: {
      cardId: 'card_sandbox_basic_virtual',
      accountId: asAccountId('acct_sandbox_basic_usd'),
      ownerId: asCustomerId(principal.customerId),
      programId: SIMULATION_GB_VIRTUAL_PROGRAM.programId,
      formFactor: 'VIRTUAL',
    },
  });
  if (requested.outcome === 'OK' && requested.value.status === 'PENDING') {
    cards.activateCard({
      id: asIntentId('sandbox_card_basic_act'),
      actionType: ACTION_TYPES.ACTIVATE_CARD,
      idempotencyKey: 'sandbox_card_basic_act',
      actorId: principal.actorId,
      requestedAt: NOW,
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: requested.value.cardId, accountId: requested.value.fundingAccountId },
    });
  }
  return new ConsumerCardsFacade(cards, runtime.identity.service, () => runtime.clock.now());
}
