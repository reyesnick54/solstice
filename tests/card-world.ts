import { FrozenClock } from '../packages/config/src/clock.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { asCustomerId, createProspect, notStartedVerification, transitionCustomerStatus, type Customer } from '../packages/domain/src/customer.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asJurisdiction, asResidency } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { isOk } from '../packages/domain/src/result.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type RequestCardIntent } from '../packages/permissions/src/action-types.ts';
import { InMemorySecretProvider } from '../packages/security/src/secrets.ts';
import { CardsService, signProcessorCallback, type ProcessorCallbackEnvelope } from '../packages/cards/src/index.ts';
import { SIMULATION_US_VIRTUAL_PROGRAM } from '../packages/cards/src/program.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createSimulationRuntime, type SimulationRuntime } from '../services/accounts/src/runtime.ts';
import { createCardHoldGateway } from '../services/cards/src/hold-gateway.ts';
import type { Account } from '../packages/domain/src/account.ts';

export const CARD_NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
export const CARD_PROCESSOR_SECRET = 'sim-card-processor-hmac-not-a-production-secret';

export type CardWorld = {
  readonly runtime: SimulationRuntime;
  readonly clock: FrozenClock;
  readonly cards: CardsService;
  readonly secrets: InMemorySecretProvider;
  readonly customer: Customer;
  readonly account: Account;
  readonly actorId: string;
  readonly processorActorId: string;
  readonly operationsActorId: string;
};

export function createCardWorld(suffix: string, depositMinor = 100_000n): CardWorld {
  const clock = new FrozenClock(CARD_NOW);
  const runtime = createSimulationRuntime({ clock });
  let customer = createProspect({
    id: asCustomerId(`cust_card_${suffix}`),
    legalEntityId: asLegalEntityId('le_solstice_us_inc'),
    jurisdiction: asJurisdiction('US'),
    residency: asResidency('US'),
    verification: notStartedVerification(asUtcInstant('2027-08-15T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', CARD_NOW);
  if (!isOk(pending)) {
    throw new Error('expected pending');
  }
  customer = {
    ...pending.value.customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-15T00:00:00.000Z'),
    }),
  };
  const active = transitionCustomerStatus(customer, 'ACTIVE', CARD_NOW);
  if (!isOk(active)) {
    throw new Error('expected active');
  }
  runtime.customers.put(active.value.customer.id, active.value.customer);
  customer = active.value.customer;

  const actorId = `actor_card_${suffix}`;
  const processorActorId = `actor_card_proc_${suffix}`;
  const operationsActorId = `actor_card_ops_${suffix}`;
  const customerActor = runtime.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: asJurisdiction('US'),
    customerId: customer.id,
    capabilities: [
      'ACCOUNT_OPEN_REQUEST',
      'POST_DEPOSIT_REQUEST',
      'HOLD_REQUEST',
      'CARD_MANAGE_REQUEST',
      'WALLET_PROVISION_REQUEST',
      'ACCEPTANCE_MANAGE_REQUEST',
      'VIEW_ACCOUNT',
      'MANAGE_PROFILE',
    ],
  });
  if (!customerActor.ok) {
    throw new Error(customerActor.error.message);
  }
  const processorActor = runtime.identity.provisionSimulatedActor({
    actorId: processorActorId,
    jurisdiction: asJurisdiction('US'),
    capabilities: ['CARD_AUTHORIZE_REQUEST', 'CARD_CLEAR_REQUEST'],
  });
  if (!processorActor.ok) {
    throw new Error(processorActor.error.message);
  }
  const operationsActor = runtime.identity.provisionSimulatedActor({
    actorId: operationsActorId,
    jurisdiction: asJurisdiction('US'),
    capabilities: ['HOLD_REQUEST', 'WALLET_PROVISION_REQUEST', 'ACCEPTANCE_MANAGE_REQUEST', 'CARD_MANAGE_REQUEST'],
  });
  if (!operationsActor.ok) {
    throw new Error(operationsActor.error.message);
  }

  const opened = runtime.accountsService.open({
    id: asIntentId(`open_card_${suffix}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `open_card_${suffix}`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(`acct_card_${suffix}`),
      ownerId: customer.id,
      productId: asProductId('prod_demand_usd_us'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_us_inc'),
      jurisdiction: asJurisdiction('US'),
      currency: asCurrencyCode('USD'),
    },
  });
  if (opened.outcome !== 'OPENED') {
    throw new Error(`expected OPENED, got ${opened.outcome}`);
  }
  if (depositMinor > 0n) {
    const deposited = runtime.money.deposit({
      id: asIntentId(`dep_card_${suffix}`),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: `dep_card_${suffix}`,
      actorId,
      requestedAt: clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: {
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(depositMinor, 'USD'),
      },
    });
    if (deposited.outcome !== 'POSTED') {
      throw new Error(`expected POSTED deposit, got ${deposited.outcome}`);
    }
  }

  const secrets = new InMemorySecretProvider('simulation', {
    'card-processor-callback': CARD_PROCESSOR_SECRET,
    'wallet-provider-callback': CARD_PROCESSOR_SECRET,
    'acceptance-provider-callback': CARD_PROCESSOR_SECRET,
  });
  const seeded = seedSimulationCatalog();
  const cards = new CardsService(
    runtime.kernel,
    runtime.issuer,
    runtime.ledger,
    runtime.evidence,
    runtime.events,
    clock,
    {
      customers: runtime.customers,
      accounts: runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    runtime.identity.service,
    createCardHoldGateway(runtime.banking, runtime.ledger, clock),
    secrets,
    { processorActorId, operationsActorId },
  );
  return {
    runtime,
    clock,
    cards,
    secrets,
    customer,
    account: opened.account,
    actorId,
    processorActorId,
    operationsActorId,
  };
}

export function requestCardIntent(world: CardWorld, cardId: string): RequestCardIntent {
  return {
    id: asIntentId(`req_${cardId}`),
    actionType: ACTION_TYPES.REQUEST_CARD,
    idempotencyKey: `req_key_${cardId}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CARD',
    payload: {
      cardId,
      accountId: world.account.id,
      ownerId: world.customer.id,
      programId: SIMULATION_US_VIRTUAL_PROGRAM.programId,
      formFactor: 'VIRTUAL',
    },
  };
}

export function signedCallback(
  world: CardWorld,
  eventType: ProcessorCallbackEnvelope['eventType'],
  idempotencyKey: string,
  nonce: string,
  payload: Readonly<Record<string, unknown>>,
): ProcessorCallbackEnvelope {
  const secret = world.secrets.resolve({
    scheme: 'secret',
    provider: 'simulation',
    path: 'card-processor-callback',
    href: 'secret://simulation/card-processor-callback',
  });
  if (!secret.ok) {
    throw new Error(secret.error.message);
  }
  return signProcessorCallback(secret.value, {
    providerId: 'sim-card-processor',
    eventType,
    idempotencyKey,
    nonce,
    timestampMs: BigInt(Date.parse(world.clock.now())),
    schemaVersion: 1,
    payload,
  });
}
