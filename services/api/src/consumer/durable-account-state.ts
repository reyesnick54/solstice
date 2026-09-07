import {
  asAccountId,
  type AccountClass,
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
  asCurrencyCode,
  asJurisdiction,
  asResidency,
  asLegalEntityId,
  asProductId,
  isOk,
  asUtcInstant,
} from '@solstice/domain';
import { Money } from '@solstice/money';
import {
  ACTION_TYPES,
  asIntentId,
  type OpenAccountIntent,
  type PostDepositIntent,
} from '@solstice/permissions';
import type { IdentityCapability } from '@solstice/identity';
import type { DurableSimulationRuntime } from '../../../accounts/src/product-durable-adapters.ts';
import type { SandboxPersonaId } from './sandbox-personas.ts';

const SANDBOX_SEED_VERSION = 'durable-sandbox-core-v1' as const;
const CREATED_AT = asUtcInstant('2026-01-15T09:00:00.000Z');
const REFRESH_BY = asUtcInstant('2027-08-21T00:00:00.000Z');

const DURABLE_PERSONA_CAPABILITIES: readonly IdentityCapability[] = [
  'VIEW_ACCOUNT',
  'MANAGE_PROFILE',
];

type DurableAccountSeed = {
  readonly id: string;
  readonly currency: string;
  readonly productId: string;
  readonly accountClass: AccountClass;
  readonly depositMinorUnits: bigint;
};

type DurablePersonaSeed = {
  readonly persona: SandboxPersonaId;
  readonly customerId: string;
  readonly identityId?: string;
  readonly verified: boolean;
  readonly active: boolean;
  readonly restricted?: boolean;
  readonly accounts: readonly DurableAccountSeed[];
};

const DURABLE_PERSONA_SEEDS: readonly DurablePersonaSeed[] = [
  {
    persona: 'basic_verified',
    customerId: 'cust_sandbox_basic',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_basic_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 25_000n },
    ],
  },
  {
    persona: 'kyc_pending',
    customerId: 'cust_sandbox_kyc',
    verified: false,
    active: false,
    accounts: [],
  },
  {
    persona: 'multi_currency',
    customerId: 'cust_sandbox_fx',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_fx_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 200_000n },
      { id: 'acct_sandbox_fx_gbp', currency: 'GBP', productId: 'prod_demand_gbp_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 8_000n },
      { id: 'acct_sandbox_fx_sar', currency: 'SAR', productId: 'prod_demand_sar_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 8_000n },
    ],
  },
  {
    persona: 'investment',
    customerId: 'cust_sandbox_invest',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_invest_cash', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 40_000n },
      { id: 'acct_sandbox_invest_sec', currency: 'USD', productId: 'prod_securities_usd_gb', accountClass: 'SECURITIES', depositMinorUnits: 0n },
      { id: 'acct_sandbox_invest_brokerage', currency: 'USD', productId: 'prod_brokerage_cash_usd_gb', accountClass: 'BROKERAGE_CASH', depositMinorUnits: 0n },
      { id: 'acct_sandbox_invest_pending', currency: 'USD', productId: 'prod_pending_usd_gb', accountClass: 'PENDING_SETTLEMENT', depositMinorUnits: 0n },
    ],
  },
  {
    persona: 'agent_enabled',
    customerId: 'cust_sandbox_agent',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_agent_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 12_000n },
    ],
  },
  {
    persona: 'exchange',
    customerId: 'cust_sandbox_exchange',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_exchange_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 9_000n },
    ],
  },
  {
    persona: 'restricted',
    customerId: 'cust_sandbox_restricted',
    verified: true,
    active: true,
    restricted: true,
    accounts: [
      { id: 'acct_sandbox_restricted_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 5_000n },
    ],
  },
  {
    persona: 'pending_activity',
    customerId: 'cust_sandbox_pending',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_pending_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 15_000n },
    ],
  },
  {
    persona: 'zero_balance',
    customerId: 'cust_sandbox_zero',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_zero_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 0n },
    ],
  },
  {
    persona: 'provider_down',
    customerId: 'cust_sandbox_provider_down',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_provider_down_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 7_500n },
    ],
  },
  {
    persona: 'grow',
    customerId: 'cust_sandbox_grow',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_grow_checking', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 200_000n },
      { id: 'acct_sandbox_grow_savings', currency: 'USD', productId: 'prod_savings_usd_gb', accountClass: 'SAVINGS_DEPOSIT', depositMinorUnits: 0n },
    ],
  },
  {
    persona: 'personal_economy',
    customerId: 'cust_sandbox_personal_economy',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_sandbox_pe_cash', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 25_000n },
    ],
  },
  {
    persona: 'hin_ready',
    customerId: 'cust_hin_alice',
    identityId: 'idn_hin_alice',
    verified: true,
    active: true,
    accounts: [
      { id: 'acct_hin_alice_usd', currency: 'USD', productId: 'prod_demand_usd_gb', accountClass: 'DEMAND_DEPOSIT', depositMinorUnits: 50_000n },
    ],
  },
  {
    persona: 'vault_ready',
    customerId: 'cust_vault_bob',
    identityId: 'idn_vault_bob',
    verified: true,
    active: true,
    accounts: [],
  },
  {
    persona: 'data_licensee',
    customerId: 'cust_data_licensee',
    identityId: 'idn_data_licensee',
    verified: true,
    active: true,
    accounts: [],
  },
];

export type DurableSandboxSeedReport = {
  readonly schema: 'sunrey.durable-sandbox-seed.v1';
  readonly seedVersion: typeof SANDBOX_SEED_VERSION;
  readonly customersCreated: number;
  readonly identitiesCreated: number;
  readonly accountsCreated: number;
  readonly depositsCreated: number;
  readonly existingAccountsPreserved: number;
};

/**
 * Establishes deterministic internal-sandbox customers/accounts through the
 * PostgreSQL durable runtime. Existing accounts are never re-funded: once an
 * account exists it is treated as authoritative persisted state.
 */
export async function ensureDurableSandboxCoreState(
  durable: DurableSimulationRuntime,
): Promise<DurableSandboxSeedReport> {
  const runtime = durable.runtime;
  let customersCreated = 0;
  let identitiesCreated = 0;
  let accountsCreated = 0;
  let depositsCreated = 0;
  let existingAccountsPreserved = 0;
  let identityChanged = false;

  for (const seed of DURABLE_PERSONA_SEEDS) {
    const customerId = asCustomerId(seed.customerId);
    let customer = runtime.customers.get(customerId);
    if (!customer) {
      customer = buildCustomer(seed);
      await durable.saveCustomer(customer);
      customersCreated += 1;
    }

    const actorId = `actor_sandbox_${seed.persona}`;
    const identityId = seed.identityId ?? `idn_sandbox_${seed.persona}`;
    const existingIdentityId = runtime.identity.service.store.identityByCustomer.get(customer.id);
    if (!existingIdentityId) {
      const provisioned = runtime.identity.provisionSimulatedActor({
        actorId,
        identityId,
        jurisdiction: asJurisdiction('GB'),
        customerId: customer.id,
        capabilities: DURABLE_PERSONA_CAPABILITIES,
        stepUp: seed.verified && seed.restricted !== true,
      });
      if (!provisioned.ok) {
        throw new Error(`durable sandbox identity failed for ${seed.persona}: ${provisioned.error.message}`);
      }
      identitiesCreated += 1;
      identityChanged = true;

      if (!seed.verified) {
        runtime.identity.service.recordKyc({
          identityId: identityId as never,
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
      if (seed.restricted) {
        const suspended = runtime.identity.service.suspendIdentity(identityId as never);
        if (!suspended.ok) {
          throw new Error(`durable sandbox identity restriction failed for ${seed.persona}: ${suspended.error.message}`);
        }
      }
    }

    for (const accountSeed of seed.accounts) {
      const accountId = asAccountId(accountSeed.id);
      if (runtime.accounts.has(accountId)) {
        existingAccountsPreserved += 1;
        continue;
      }

      const opened = await durable.open(openIntent(customer.id, accountSeed));
      if (opened.outcome !== 'OPENED') {
        throw new Error(`durable sandbox account open failed for ${accountSeed.id}: ${opened.outcome}`);
      }
      accountsCreated += 1;

      if (accountSeed.depositMinorUnits > 0n) {
        const deposited = await durable.postDeposit(depositIntent(opened.account.id, accountSeed));
        if (deposited.outcome !== 'POSTED') {
          throw new Error(`durable sandbox funding failed for ${accountSeed.id}: ${deposited.outcome}`);
        }
        depositsCreated += 1;
      }
    }
  }

  if (identityChanged) {
    await durable.persistAuthentication();
  }

  const restrictedAccount = runtime.accounts.get(asAccountId('acct_sandbox_restricted_usd'));
  if (restrictedAccount) {
    const current = runtime.accountProduct.restrictions
      .activeFor(restrictedAccount.id)
      .find((row) => row.code === 'COMPLIANCE_REVIEW');
    if (!current) {
      const applied = runtime.accountProduct.applyRestriction({
        accountId: restrictedAccount.id,
        code: 'COMPLIANCE_REVIEW',
        reason: 'sandbox restricted persona',
        actorId: 'operator_1',
      });
      if (!isOk(applied)) {
        throw new Error(`durable sandbox restriction seed failed: ${applied.error.message}`);
      }
      await durable.persistProductState();
    }
  }

  return Object.freeze({
    schema: 'sunrey.durable-sandbox-seed.v1',
    seedVersion: SANDBOX_SEED_VERSION,
    customersCreated,
    identitiesCreated,
    accountsCreated,
    depositsCreated,
    existingAccountsPreserved,
  });
}

function buildCustomer(seed: DurablePersonaSeed): Customer {
  let customer = createProspect({
    id: asCustomerId(seed.customerId),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    residency: asResidency('GB'),
    verification: notStartedVerification(REFRESH_BY),
    createdAt: CREATED_AT,
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', CREATED_AT);
  if (!isOk(pending)) {
    throw new Error(`durable sandbox customer could not enter PENDING_VERIFICATION: ${seed.customerId}`);
  }
  customer = pending.value.customer;
  if (seed.verified) {
    customer = Object.freeze({
      ...customer,
      verification: Object.freeze({
        kycState: 'VERIFIED' as const,
        kycRecordVersion: 1,
        refreshBy: REFRESH_BY,
      }),
    });
  }
  if (seed.active && seed.verified) {
    const active = transitionCustomerStatus(customer, 'ACTIVE', CREATED_AT);
    if (!isOk(active)) {
      throw new Error(`durable sandbox customer could not activate: ${seed.customerId}`);
    }
    customer = active.value.customer;
  }
  return customer;
}

function openIntent(ownerId: Customer['id'], seed: DurableAccountSeed): OpenAccountIntent {
  return Object.freeze({
    id: asIntentId(`durable_open_${seed.id}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `durable_open_${seed.id}`,
    actorId: 'operator_1',
    requestedAt: CREATED_AT,
    purpose: 'CUSTOMER_ONBOARDING',
    payload: Object.freeze({
      accountId: asAccountId(seed.id),
      ownerId,
      productId: asProductId(seed.productId),
      accountClass: seed.accountClass,
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode(seed.currency),
    }),
  });
}

function depositIntent(accountId: ReturnType<typeof asAccountId>, seed: DurableAccountSeed): PostDepositIntent {
  return Object.freeze({
    id: asIntentId(`durable_dep_${seed.id}`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `durable_dep_${seed.id}`,
    actorId: 'operator_1',
    requestedAt: CREATED_AT,
    purpose: 'CUSTOMER_FUNDING',
    payload: Object.freeze({
      accountId,
      amount: Money.fromMinorUnits(seed.depositMinorUnits, seed.currency),
    }),
  });
}
