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
import type { IdentityCapability } from '../../../../packages/identity/src/capability.ts';
import { Money } from '../../../../packages/money/src/money.ts';
import { asIntentId } from '../../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type OpenAccountIntent, type PostDepositIntent } from '../../../../packages/permissions/src/action-types.ts';
import { PaymentsService } from '../../../../packages/payments/src/service.ts';
import { PaymentPlatform } from '../../../../packages/payments/src/platform/orchestrator.ts';
import { createSimulationRuntime, type SimulationRuntime } from '../../../accounts/src/runtime.ts';
import { seedSimulationCatalog } from '../../../accounts/src/catalog.ts';
import { createAccountsReadAdapter } from './accounts-adapter.ts';
import type { ActionStatusResource } from './action-status.ts';
import { ConsumerBff, memoryPreferenceStore } from './orchestrator.ts';
import type {
  BffPrincipal,
  FeatureCapabilityMap,
  OptionalDomainPort,
  OptionalDomainSummary,
} from './ports.ts';
import type { SessionDirectory } from './session.ts';

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
] as const;
export type SandboxPersonaId = (typeof SANDBOX_PERSONA_IDS)[number];

export function sandboxToken(persona: SandboxPersonaId): string {
  return `sandbox.${persona}`;
}

const NOW = asUtcInstant('2026-08-21T09:00:00.000Z');

const READ_CAPABILITIES: readonly IdentityCapability[] = [
  'VIEW_ACCOUNT',
  'MANAGE_PROFILE',
  'VIEW_GROWTH_PLAN',
  'VIEW_ECONOMIC_VALUE',
  'VAULT_VIEW_OWN',
  'EXCHANGE_VIEW',
  'PAYMENT_REQUEST',
  'FX_QUOTE_REQUEST',
  'TRANSFER_REQUEST',
  'MANAGE_BENEFICIARY',
  'PAYMENT_APPROVE',
  'POST_WITHDRAWAL_REQUEST',
];

export type SandboxWorld = {
  readonly label: typeof SANDBOX_LABEL;
  readonly production: false;
  readonly runtime: SimulationRuntime;
  readonly bff: ConsumerBff;
  readonly sessions: SessionDirectory;
  readonly personas: Readonly<Record<SandboxPersonaId, BffPrincipal>>;
  readonly payments: PaymentPlatform;
};

export function createSandboxWorld(options: { readonly providerDown?: boolean } = {}): SandboxWorld {
  const runtime = createSimulationRuntime({
    clock: new FrozenClock(NOW),
    provisionSimulatedActor: true,
  });
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
      { id: 'acct_sandbox_fx_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 10_000n },
      { id: 'acct_sandbox_fx_gbp', currency: 'GBP', productId: 'prod_demand_gbp_gb', accountClass: 'DEMAND_DEPOSIT', deposit: 8_000n },
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
    ],
  });
  personas.investment = invest.principal;
  sessions.set(sandboxToken('investment'), invest.principal);

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

  const bff = new ConsumerBff({
    now: () => runtime.clock.now(),
    accounts: createAccountsReadAdapter(runtime),
    preferences: memoryPreferenceStore(),
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
    grow: simulationPort('Grow My Money is a simulation laboratory path', 0),
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
    cards: {
      summarize() {
        return Object.freeze({
          availability: 'EXTERNAL_PROVIDER_REQUIRED',
          state: options.providerDown ? 'PROVIDER_UNAVAILABLE' : 'FEATURE_DISABLED',
          provider: options.providerDown ? 'UNAVAILABLE' : 'NOT_CONNECTED',
          reason: options.providerDown
            ? 'card processor is unavailable'
            : 'live card issuing requires an external processor',
          count: 0,
        });
      },
    },
    vault: simulationPort('Personal Data Vault is subject-bound and simulated', 0),
    providerDown: options.providerDown ? { cards: true, payments: true, fx: true } : { cards: true },
  });

  return Object.freeze({
    label: SANDBOX_LABEL,
    production: false,
    runtime,
    bff,
    sessions,
    personas: Object.freeze(personas),
    payments,
  });
}

function provisionPersona(
  runtime: SimulationRuntime,
  input: {
    readonly persona: SandboxPersonaId;
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
    identityId: `idn_sandbox_${input.persona}`,
    jurisdiction: asJurisdiction('GB'),
    customerId: customer.id,
    capabilities: READ_CAPABILITIES,
    stepUp: input.kyc === 'VERIFIED' && !input.restricted,
  });
  if (!provisioned.ok) {
    throw new Error(`sandbox identity failed: ${provisioned.error.message}`);
  }
  const identity = runtime.identity.service.store.identities.get(`idn_sandbox_${input.persona}`);
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
