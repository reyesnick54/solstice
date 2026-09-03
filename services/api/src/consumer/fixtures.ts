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
import { createFxReferenceBffPort } from './fx-reference-adapter.ts';
import { createGrowOpportunityPort } from './grow-adapter.ts';
import type { GrowOpportunityPort } from './grow-adapter.ts';
import { createPreviewAiGateway, PreviewMarketResearchCache } from '../preview-ai.ts';
import {
  applyPersonaSeed,
  PEG_PERSONA_SEEDS,
  type PegPersonaId,
} from '../../../economic-graph/src/index.ts';
import type { ActionStatusResource } from './action-status.ts';
import { ConsumerBff, memoryPreferenceStore } from './orchestrator.ts';
import { createAgentBffFacade, type AgentBffFacade } from './agent-dispatch.ts';
import { createExchangeBffSurface } from './exchange-bff.ts';
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
import { createSandboxMoneyIntegration } from './money-integration/sandbox.ts';
import type { MoneyIntegrationPlatform } from './money-integration/platform.ts';
import type { NativeClearingEngine } from '../../../../packages/sunrey-exchange/src/native-clearing/engine.ts';
import type { ConsumerBffRuntime } from './handler.ts';
import { createSandboxRightsMarketplace } from '../../../../packages/information-market/src/rights-marketplace/index.ts';
import type { InformationRightsMarketplace } from '../../../../packages/information-market/src/rights-marketplace/index.ts';
import { createHinContributionSurface, type HinContributionSurface } from './hin-adapter.ts';
import { createProductiveEconomySurface, type ProductiveEconomySurface } from './productive-economy-adapter.ts';
import { createExternalDataPlane } from '../../../../packages/external-data/src/index.ts';
import { createWorldExternalDataBff, type WorldExternalDataBff } from './world-external-data-adapter.ts';
import { createTravelBff, type TravelBff } from './travel-adapter.ts';
import { createAgentExternalEvidenceBff, type AgentExternalEvidenceBff } from './agent-evidence-adapter.ts';
import { createEnvironmentalOracleBff, type EnvironmentalOracleBff } from './environmental-adapter.ts';
import { createOpportunityIntelligenceBff, type OpportunityIntelligenceBff } from './opportunity-adapter.ts';
import {
  createSubscriptionIntelligenceBff,
  type SubscriptionIntelligenceBff,
} from './subscription-intelligence-adapter.ts';
import { SubscriptionIntelligenceService } from '../../../../packages/platform/src/subscription-intelligence/index.ts';
import { asEconomicActivityId, asEconomicGraphId, deterministicActivityId } from '../../../../packages/personal-economic-graph/src/ids.ts';
import type { EconomicActivity } from '../../../../packages/personal-economic-graph/src/store.ts';
import { createSandboxAccessEconomy, type HumanAccessEconomyProduct } from '../../../../packages/human-access-economy/src/service.ts';
import {
  PersonalEconomyBffSurface,
  type PersonalEconomyBffDeps,
} from './personal-economy.ts';
import { createSandboxHinAccessBridge } from '../../../../packages/information-market/src/network/access-integration/index.ts';
import type { HumanInformationAccessBridge } from '../../../../packages/human-access-economy/src/hin-access.ts';

import { ConsentService } from '../../../../packages/consent/src/service.ts';
import { ConsentDataRightsEngine } from '../../../../packages/consent/src/product/engine.ts';
import { PersonalDataVault } from '../../../../packages/personal-data-vault/src/service.ts';
import {
  PersonalDataVaultProduct,
  type VaultPersonaId,
} from '../../../../packages/personal-data-vault/src/product/index.ts';
import {
  SANDBOX_LABEL,
  SANDBOX_PERSONA_IDS,
  sandboxToken,
  type SandboxPersonaId,
} from './sandbox-personas.ts';

export {
  SANDBOX_LABEL,
  SANDBOX_PERSONA_IDS,
  sandboxToken,
  listSandboxPersonas,
} from './sandbox-personas.ts';
export type { SandboxPersonaId } from './sandbox-personas.ts';

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
  'VAULT_INGEST_OWN',
  'VAULT_EXPORT_OWN',
  'VAULT_DELETE_OWN',
  'EXCHANGE_VIEW',
  'EXCHANGE_OPERATE_REQUEST',
  'PAYMENT_REQUEST',
  'FX_QUOTE_REQUEST',
  'TRANSFER_REQUEST',
  'MANAGE_BENEFICIARY',
  'PAYMENT_APPROVE',
  'POST_WITHDRAWAL_REQUEST',
  'CARD_MANAGE_REQUEST',
  'CUSTODY_OPERATE_REQUEST',
  'ADD_WITHDRAWAL_DESTINATION',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
];

export type SandboxWorld = {
  readonly label: typeof SANDBOX_LABEL;
  readonly production: false;
  readonly runtime: SimulationRuntime;
  readonly bff: ConsumerBff;
  readonly sessions: SessionDirectory;
  readonly personas: Readonly<Record<SandboxPersonaId, BffPrincipal>>;
  readonly payments: PaymentPlatform;
  readonly agent: AgentBffFacade;
  readonly agentRuntime: AgentConversationRuntime;
  readonly grow: ProductGrowthService;
  readonly growOpportunity: GrowOpportunityPort;
  readonly previewDiagnostics: () => Readonly<Record<string, unknown>>;
  readonly conversation: AgentConversationSurface;
  readonly wallets: WalletProductService;
  readonly moneyIntegration: MoneyIntegrationPlatform;
  readonly nativeClearing: NativeClearingEngine;
  readonly hin: InformationRightsMarketplace;
  readonly hinContributions: HinContributionSurface;
  readonly productiveEconomy: ProductiveEconomySurface;
  readonly exchange: ReturnType<typeof createExchangeBffSurface>;
  readonly dataRights: ConsentDataRightsEngine;
  readonly vault: PersonalDataVaultProduct;
  readonly access: HumanAccessEconomyProduct;
  readonly personalEconomy: PersonalEconomyBffSurface;
  readonly hinAccess: HumanInformationAccessBridge;
  readonly worldExternalData: WorldExternalDataBff;
  readonly environmental: EnvironmentalOracleBff;
  readonly travel: TravelBff;
  readonly agentExternalEvidence: AgentExternalEvidenceBff;
  readonly opportunity: OpportunityIntelligenceBff;
  readonly subscriptions: SubscriptionIntelligenceBff;
  readonly providerDown: Readonly<Record<string, boolean>>;
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
  let growOpportunityForAgent: GrowOpportunityPort | undefined;

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
  const agentRuntime = createSandboxAgentRuntime(NOW, {
    opportunities: (ownerId) => {
      if (!growOpportunityForAgent || ownerId !== agent.principal.customerId) return [];
      const listed = growOpportunityForAgent.list(agent.principal);
      if (!listed || typeof listed !== 'object' || !('items' in listed) || !Array.isArray(listed.items)) return [];
      return listed.items
        .filter((item): item is { title: string; summary: string } =>
          Boolean(item && typeof item === 'object' && typeof item.title === 'string' && typeof item.summary === 'string'),
        )
        .map((item) => ({ title: item.title, summary: item.summary }));
    },
  });
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

  const personalEconomyPersona = provisionPersona(runtime, {
    persona: 'personal_economy',
    customerId: 'cust_sandbox_personal_economy',
    kyc: 'VERIFIED',
    customerActive: true,
    restricted: false,
    accounts: [
      {
        id: 'acct_sandbox_pe_cash',
        currency: 'USD',
        productId: 'prod_demand_usd_gb',
        accountClass: 'DEMAND_DEPOSIT',
        deposit: 25_000n,
      },
    ],
  });
  personas.personal_economy = personalEconomyPersona.principal;
  sessions.set(sandboxToken('personal_economy'), personalEconomyPersona.principal);

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

  const vaultPersonaMap: Readonly<Record<string, VaultPersonaId>> = {
    vault_minimal: 'MINIMAL',
    vault_financial: 'FINANCIAL',
    vault_employment: 'EMPLOYMENT_SKILLS',
    vault_multi_source: 'MULTI_SOURCE',
    vault_derived: 'DERIVED',
    vault_disputed: 'DISPUTED',
    vault_revoked: 'REVOKED',
    vault_restricted_agent: 'RESTRICTED_AGENT',
  };
  for (const [sandboxId, personaId] of Object.entries(vaultPersonaMap)) {
    const provisioned = provisionPersona(runtime, {
      persona: sandboxId as SandboxPersonaId,
      customerId: `cust_sandbox_${sandboxId}`,
      kyc: 'VERIFIED',
      customerActive: true,
      restricted: false,
      accounts: [],
    });
    personas[sandboxId as SandboxPersonaId] = provisioned.principal;
    sessions.set(sandboxToken(sandboxId as SandboxPersonaId), provisioned.principal);
    void personaId;
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
  const previewAiGateway = createPreviewAiGateway(runtime);
  const marketResearch = new PreviewMarketResearchCache(previewAiGateway, () => runtime.clock.now());
  const growthOrchestrator = new GrowthOrchestrator({
    clock: runtime.clock,
    events: runtime.events,
    peg: new EconomicGraphService({ clock: runtime.clock, events: runtime.events }),
  });
  const growOpportunity = createGrowOpportunityPort({
    orchestrator: growthOrchestrator,
    accounts: createAccountsReadAdapter(runtime),
    marketResearch: () => marketResearch.get(),
    actorFor(principal) {
      const actor = runtime.identity.service.resolveActorContext(principal.actorId);
      return actor.ok ? actor.value : principal;
    },
  });
  growOpportunityForAgent = growOpportunity;

  const access = createSandboxAccessEconomy(personas.basic_verified.customerId);

  const bff = new ConsumerBff({
    now: () => runtime.clock.now(),
    accounts: createAccountsReadAdapter(runtime),
    preferences: memoryPreferenceStore(),
    fxEngine: createFxCommandPort(paymentsService, () => runtime.clock.now()),
    fxReference: createFxReferenceBffPort(),
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
    grow: growOpportunity,
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
    access: {
      homeSummary(principal) {
        access.seedCustomer(principal.customerId);
        const outcome = access.homeSummary({
          actorId: principal.actorId,
          customerId: principal.customerId,
          verified: principal.verification === 'VERIFIED' && principal.customerStatus !== 'PENDING_VERIFICATION',
          restricted: principal.restricted || principal.customerStatus === 'SUSPENDED',
        });
        if (!outcome.ok) {
          const denied = outcome as unknown as { readonly ok: false; readonly error: { readonly message: string } };
          return Object.freeze({
            schema: 'sunrey.consumer.access.home-summary.v1' as const,
            productionReady: false as const,
            productionActive: false as const,
            liveConnectivityEnabled: false as const,
            navigationLabel: 'Access' as const,
            title: 'Your Available Access',
            categories: Object.freeze([]),
            nextExpiration: null,
            primaryCta: 'Explore Access' as const,
            capability: Object.freeze({
              enabled: false,
              state: 'FEATURE_DISABLED' as const,
              reason: denied.error.message,
            }),
            terminology: Object.freeze({
              access: 'Access',
              availableAccess: 'Available Access',
              accessCovers: 'Access covers',
              youPay: 'You pay',
              accessUsed: 'Access used',
              remainingAccess: 'Remaining Access',
            }),
          });
        }
        return outcome.value;
      },
    },
  });

  const wallets = attachSandboxWallets(runtime, personas, { providerDown: options.providerDown === true });
  const moneySandbox = createSandboxMoneyIntegration({
    walletProduct: wallets,
    exchangeCustomerId: personas.exchange.customerId,
    counterpartyCustomerId: personas.basic_verified.customerId,
  });
  const moneyIntegration = moneySandbox.platform;
  const nativeClearing = moneySandbox.nativeClearing;
  const hin = createSandboxRightsMarketplace(runtime.clock, personas.basic_verified.customerId);
  const hinContributions = createHinContributionSurface();
  const productiveEconomy = createProductiveEconomySurface();
  const vault = attachSandboxVault(runtime, personas);
  const dataRights = attachSandboxDataRights(runtime, vault);
  const hinAccess = createSandboxHinAccessBridge(runtime.clock, personas.basic_verified.identityId);

  const personalEconomyPeg = new EconomicGraphService({ clock: new FrozenClock(NOW), events: runtime.events });
  personalEconomyPeg.registerAccountCurrency('acct_sandbox_pe_cash', 'USD');
  personalEconomyPeg.ingestAll(
    [
      {
        eventType: 'AccountOpened',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt_sandbox_pe_open',
        payload: {
          accountId: asAccountId('acct_sandbox_pe_cash'),
          ownerId: personalEconomyPersona.customer.id,
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea_sandbox_pe',
          intentId: 'I-sandbox-pe-open',
        },
      },
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'evt_sandbox_pe_deposit',
        payload: {
          journalId: 'j_sandbox_pe_deposit',
          accountId: asAccountId('acct_sandbox_pe_cash'),
          amountMinorUnits: '2500000',
          currency: 'USD',
        },
      },
    ],
    personalEconomyPersona.principal.identityId,
  );
  const personalEconomyOrchestrator = new GrowthOrchestrator({
    clock: runtime.clock,
    events: runtime.events,
    peg: personalEconomyPeg,
  });
  const personalEconomySnapshotPorts = () =>
    Object.freeze({
      investmentLabels: Object.freeze([
        Object.freeze({ label: 'Brokerage portfolio', minorUnits: '10000000', currency: 'USD' }),
      ]),
      sunReyHoldings: Object.freeze({
        assetId: 'SUNREY_COIN' as const,
        label: 'SunRey Coin',
        quantityMinorUnits: '100',
        valuationCurrency: 'USD',
        estimatedValueMinorUnits: '10000',
        authoritativeBalance: false as const,
        simulationOnly: true as const,
      }),
      moonReyHoldings: Object.freeze({
        assetId: 'MOONREY_COIN' as const,
        label: 'MoonRey Coin',
        quantityMinorUnits: '100',
        valuationCurrency: 'USD',
        estimatedValueMinorUnits: '8000',
        authoritativeBalance: false as const,
        simulationOnly: true as const,
      }),
      accessEntitlements: Object.freeze([
        Object.freeze({
          category: 'TRAVEL',
          label: 'Travel access',
          remainingUnits: 1,
          expiresAt: asUtcInstant('2027-01-01T00:00:00.000Z'),
          reservationRef: null,
        }),
      ]),
      plannedAccessDemand: Object.freeze([
        Object.freeze({
          category: 'TRAVEL',
          label: 'Two vacations next year',
          plannedUnits: 2,
          targetWindow: '2027',
          premiumTopUpRequiredMinorUnits: '300000',
          currency: 'USD',
        }),
      ]),
      productiveContributionOpportunities: Object.freeze([
        Object.freeze({
          opportunityId: 'prod_gpu_spare',
          kind: 'PRODUCTIVE_CAPACITY' as const,
          title: 'Contribute spare GPU capacity',
          category: 'COMPUTE',
          executable: false as const,
          rationale: 'Productive contribution may support network goals without promising returns.',
        }),
      ]),
    });
  const personalEconomy = new PersonalEconomyBffSurface({
    peg: personalEconomyPeg,
    orchestrator: personalEconomyOrchestrator,
    clock: runtime.clock,
    resolveActor(principal) {
      const actor = runtime.identity.service.resolveActorContext(principal.actorId);
      return actor.ok ? actor.value : principal;
    },
    snapshotPortsFor(principal) {
      if (principal.customerId !== personalEconomyPersona.principal.customerId) {
        return Object.freeze({});
      }
      return personalEconomySnapshotPorts();
    },
    constraintsFor(principal) {
      if (principal.customerId !== personalEconomyPersona.principal.customerId) {
        return Object.freeze({ minimumEmergencyCash: { minorUnits: '0', currency: 'USD' } });
      }
      return Object.freeze({
        minimumEmergencyCash: { minorUnits: '1500000', currency: 'USD' },
        maximumInvestmentRisk: 'MODERATE' as const,
        desiredTravelAccessUnits: 2,
        timeHorizonMonths: 12,
      });
    },
  } satisfies PersonalEconomyBffDeps);

  const worldExternalData = createWorldExternalDataBff(createExternalDataPlane({ nowUtc: NOW }));
  const environmental = createEnvironmentalOracleBff();
  const travel = createTravelBff({ environmental, world: worldExternalData, nowUtc: NOW });
  const agentExternalEvidence = createAgentExternalEvidenceBff(createExternalDataPlane({ nowUtc: NOW }));
  const opportunity = createOpportunityIntelligenceBff();

  const subscriptionService = new SubscriptionIntelligenceService({ clock: new FrozenClock(NOW) });
  const subscriptions = createSubscriptionIntelligenceBff(subscriptionService);
  seedSandboxSubscriptionActivities(subscriptionService, personas.basic_verified.identityId);

  return Object.freeze({
    label: SANDBOX_LABEL,
    production: false,
    runtime,
    bff,
    sessions,
    personas: Object.freeze(personas),
    payments,
    agent: createAgentBffFacade(NOW),
    agentRuntime,
    grow,
    growOpportunity,
    previewDiagnostics: () => marketResearch.diagnostics(),
    conversation: createAgentConversationSurface(),
    wallets,
    moneyIntegration,
    nativeClearing,
    hin,
    hinContributions,
    productiveEconomy,
    vault,
    exchange: createExchangeBffSurface(),
    dataRights,
    access,
    personalEconomy,
    hinAccess,
    worldExternalData,
    environmental,
    travel,
    agentExternalEvidence,
    opportunity,
    subscriptions,
    providerDown: options.providerDown ? { cards: true, payments: true, fx: true, custody: true } : {},
  });
}

/** Canonical Consumer BFF runtime assembled from a sandbox world. */
export function consumerBffRuntimeFromWorld(world: SandboxWorld): ConsumerBffRuntime {
  return Object.freeze({
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    agent: world.agent,
    agentRuntime: world.agentRuntime,
    grow: world.grow,
    previewDiagnostics: world.previewDiagnostics,
    conversation: world.conversation,
    wallets: world.wallets,
    moneyIntegration: world.moneyIntegration,
    hin: world.hin,
    hinContributions: world.hinContributions,
    productiveEconomy: world.productiveEconomy,
    exchange: world.exchange,
    dataRights: world.dataRights,
    vault: world.vault,
    access: world.access,
    personalEconomy: world.personalEconomy,
    hinAccess: world.hinAccess,
    worldExternalData: world.worldExternalData,
    environmental: world.environmental,
    travel: world.travel,
    agentExternalEvidence: world.agentExternalEvidence,
    opportunity: world.opportunity,
    subscriptions: world.subscriptions,
  });
}

function seedSandboxSubscriptionActivities(
  service: SubscriptionIntelligenceService,
  subjectId: string,
): void {
  const graphId = asEconomicGraphId('egr_sandbox_sub');
  const months = ['03', '04', '05', '06', '07', '08'];
  const activities = months.map((month, index) => ({
    activityId: deterministicActivityId(`src_netflix_${index}`),
    graphId,
    subjectId,
    accountId: 'acct_sandbox_basic_usd',
    direction: 'OUTFLOW' as const,
    amount: { minorUnits: index === months.length - 1 ? '1299' : '999', currency: 'USD' },
    occurredAt: asUtcInstant(`2026-${month}-15T10:00:00.000Z`),
    counterpart: {
      kind: 'MERCHANT' as const,
      ref: 'merch_netflix',
      label: 'NETFLIX.COM 866-579-7172',
    },
    classification: 'SUBSCRIPTION' as const,
    sourceType: 'CANONICAL_LEDGER' as const,
    sourceRef: `src_netflix_${index}`,
    sourceEventType: 'CustomerActivityRecorded',
    sourceEventId: `evt_netflix_${index}`,
  })) as EconomicActivity[];
  const spotifyMonths = ['04', '05', '06', '07', '08'];
  for (const [index, month] of spotifyMonths.entries()) {
    activities.push({
      activityId: deterministicActivityId(`src_spotify_${index}`),
      graphId,
      subjectId,
      accountId: 'acct_sandbox_basic_usd',
      direction: 'OUTFLOW' as const,
      amount: { minorUnits: '1099', currency: 'USD' },
      occurredAt: asUtcInstant(`2026-${month}-12T10:00:00.000Z`),
      counterpart: {
        kind: 'MERCHANT' as const,
        ref: 'merch_spotify',
        label: 'SPOTIFY USA',
      },
      classification: 'SUBSCRIPTION' as const,
      sourceType: 'CANONICAL_LEDGER' as const,
      sourceRef: `src_spotify_${index}`,
      sourceEventType: 'CustomerActivityRecorded',
      sourceEventId: `evt_spotify_${index}`,
    });
  }
  service.analyze({
    subjectId,
    activities: Object.freeze(activities),
    usageSignals: Object.freeze([
      Object.freeze({
        obligationId: 'pending' as never,
        usageLevel: 'NONE' as const,
        source: 'USER_AUTHORIZED' as const,
        observedAt: asUtcInstant(NOW),
      }),
    ]),
  });
  const snapshot = service.getSnapshot(subjectId);
  const netflix = snapshot.obligations.find((item) => item.merchant.normalizedMerchant === 'Netflix');
  if (netflix) {
    service.analyze({
      subjectId,
      activities: Object.freeze(activities),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: netflix.id,
          usageLevel: 'NONE' as const,
          source: 'USER_AUTHORIZED' as const,
          observedAt: asUtcInstant(NOW),
        }),
      ]),
    });
  }
}

function attachSandboxDataRights(
  runtime: SimulationRuntime,
  vault: PersonalDataVaultProduct,
): ConsentDataRightsEngine {
  const consent = new ConsentService({
    clock: runtime.clock,
    keys: runtime.keyProvider,
    evidence: runtime.evidence,
    events: runtime.events,
  });
  void vault;
  return new ConsentDataRightsEngine({
    clock: runtime.clock,
    consent,
    evidence: runtime.evidence,
    events: runtime.events,
  });
}

function attachSandboxVault(
  runtime: SimulationRuntime,
  personas: Record<SandboxPersonaId, BffPrincipal>,
): PersonalDataVaultProduct {
  const core = new PersonalDataVault({
    clock: runtime.clock,
    keys: runtime.keyProvider,
    evidence: runtime.evidence,
    events: runtime.events,
  });
  const product = new PersonalDataVaultProduct({
    clock: runtime.clock,
    events: runtime.events,
    vault: core,
  });
  const seeds: readonly { sandboxId: SandboxPersonaId; personaId: VaultPersonaId }[] = [
    { sandboxId: 'basic_verified', personaId: 'MINIMAL' },
    { sandboxId: 'vault_minimal', personaId: 'MINIMAL' },
    { sandboxId: 'vault_financial', personaId: 'FINANCIAL' },
    { sandboxId: 'vault_employment', personaId: 'EMPLOYMENT_SKILLS' },
    { sandboxId: 'vault_multi_source', personaId: 'MULTI_SOURCE' },
    { sandboxId: 'vault_derived', personaId: 'DERIVED' },
    { sandboxId: 'vault_disputed', personaId: 'DISPUTED' },
    { sandboxId: 'vault_revoked', personaId: 'REVOKED' },
    { sandboxId: 'vault_restricted_agent', personaId: 'RESTRICTED_AGENT' },
  ];
  for (const seed of seeds) {
    const principal = personas[seed.sandboxId];
    if (!principal) {
      continue;
    }
    const actor = runtime.identity.service.resolveActorContext(principal.actorId);
    if (!actor.ok) {
      throw new Error(`vault actor missing for ${seed.sandboxId}`);
    }
    const seeded = product.seedPersona(actor.value, actor.value.subjectId, seed.personaId);
    if (!seeded.ok) {
      throw new Error(`vault seed failed for ${seed.sandboxId}: ${seeded.error.message}`);
    }
  }
  return product;
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
