import { FrozenClock } from '../packages/config/src/clock.ts';
import { asAccountId, transitionAccountStatus, type Account } from '../packages/domain/src/account.ts';
import { asCustomerId, createProspect, notStartedVerification, transitionCustomerStatus, type Customer } from '../packages/domain/src/customer.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asJurisdiction, asResidency } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { isOk } from '../packages/domain/src/result.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import {
  ACTION_TYPES,
  type AcceptFxQuoteIntent,
  type CancelPaymentIntent,
  type CreateBeneficiaryIntent,
  type CreateFxQuoteIntent,
  type InitiatePaymentIntent,
} from '../packages/permissions/src/action-types.ts';
import { PaymentsService } from '../packages/payments/src/service.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createSimulationRuntime, type SimulationRuntime } from '../services/accounts/src/runtime.ts';

export const PAY_NOW = asUtcInstant('2026-08-14T12:00:00.000Z');
export const US_ACTOR = 'actor_us_pay';
export const SA_IBAN = 'SA0380000000608010167519';
export const SOURCE_MINOR = 100_000n;
export const FEE_MINOR = 1_500n;
export const DEST_MINOR = 374_500n;
export const DEBIT_MINOR = 101_500n;

export type PaymentWorld = {
  readonly runtime: SimulationRuntime;
  readonly clock: FrozenClock;
  readonly payments: PaymentsService;
  readonly customer: Customer;
  readonly account: Account;
  readonly actorId: string;
};

export function activateUsCustomer(runtime: SimulationRuntime, id: string): Customer {
  let customer = createProspect({
    id: asCustomerId(id),
    legalEntityId: asLegalEntityId('le_solstice_us_inc'),
    jurisdiction: asJurisdiction('US'),
    residency: asResidency('US'),
    verification: notStartedVerification(asUtcInstant('2027-08-14T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', PAY_NOW);
  if (!isOk(pending)) {
    throw new Error('expected pending');
  }
  customer = pending.value.customer;
  const verified = {
    ...customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-14T00:00:00.000Z'),
    }),
  };
  const active = transitionCustomerStatus(verified, 'ACTIVE', PAY_NOW);
  if (!isOk(active)) {
    throw new Error('expected active');
  }
  runtime.customers.put(active.value.customer.id, active.value.customer);
  return active.value.customer;
}

export function createPaymentWorld(
  suffix: string,
  depositMinor = 200_000n,
): PaymentWorld {
  const clock = new FrozenClock(PAY_NOW);
  const runtime = createSimulationRuntime({ clock });
  const customer = activateUsCustomer(runtime, `cust_us_${suffix}`);
  const actorId = `${US_ACTOR}_${suffix}`;
  const provisioned = runtime.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: asJurisdiction('US'),
    customerId: customer.id,
    capabilities: [
      'ACCOUNT_OPEN_REQUEST',
      'POST_DEPOSIT_REQUEST',
      'MANAGE_BENEFICIARY',
      'PAYMENT_REQUEST',
      'TRANSFER_REQUEST',
      'FX_QUOTE_REQUEST',
      'VIEW_ACCOUNT',
      'MANAGE_PROFILE',
      'TREASURY_OPERATE_REQUEST',
    ],
  });
  if (!provisioned.ok) {
    throw new Error(provisioned.error.message);
  }
  const opened = runtime.accountsService.open({
    id: asIntentId(`open_${suffix}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `open_${suffix}`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(`acct_us_${suffix}`),
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
      id: asIntentId(`dep_${suffix}`),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: `dep_${suffix}`,
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
  const seeded = seedSimulationCatalog();
  const payments = new PaymentsService(
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
  );
  return { runtime, clock, payments, customer, account: opened.account, actorId };
}

export function freezeSourceAccount(world: PaymentWorld): void {
  const frozen = transitionAccountStatus(world.account, 'FROZEN', world.clock.now());
  if (!isOk(frozen)) {
    throw new Error(frozen.error.code);
  }
  world.runtime.accounts.put(frozen.value.account.id, frozen.value.account);
}

export function beneficiaryIntent(
  world: PaymentWorld,
  id: string,
  legalName = 'Ahmed Ali',
): CreateBeneficiaryIntent {
  return {
    id: asIntentId(`ben_int_${id}`),
    actionType: ACTION_TYPES.CREATE_BENEFICIARY,
    idempotencyKey: `ben_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
    payload: {
      beneficiaryId: `ben_${id}`,
      ownerId: world.customer.id,
      accountId: world.account.id,
      kind: 'PERSON',
      destinationCountry: 'SA',
      currency: asCurrencyCode('SAR'),
      legalName,
      accountCoordinate: { scheme: 'SA_IBAN', value: SA_IBAN },
    },
  };
}

export function quoteIntent(
  world: PaymentWorld,
  id: string,
  overrides: Partial<CreateFxQuoteIntent['payload']> = {},
): CreateFxQuoteIntent {
  return {
    id: asIntentId(`q_int_${id}`),
    actionType: ACTION_TYPES.CREATE_FX_QUOTE,
    idempotencyKey: `q_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_FX',
    payload: {
      quoteId: `quote_${id}`,
      accountId: world.account.id,
      baseCurrency: asCurrencyCode('USD'),
      quoteCurrency: asCurrencyCode('SAR'),
      sourceAmount: Money.fromMinorUnits(SOURCE_MINOR, 'USD'),
      corridorId: 'US-SA-USD-SAR',
      ...overrides,
    },
  };
}

export function acceptIntent(world: PaymentWorld, id: string, quoteId: string): AcceptFxQuoteIntent {
  return {
    id: asIntentId(`acc_int_${id}`),
    actionType: ACTION_TYPES.ACCEPT_FX_QUOTE,
    idempotencyKey: `acc_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_FX',
    payload: { quoteId, accountId: world.account.id },
  };
}

export function payIntent(
  world: PaymentWorld,
  id: string,
  beneficiaryId: string,
  quoteId: string,
): InitiatePaymentIntent {
  return {
    id: asIntentId(`pay_int_${id}`),
    actionType: ACTION_TYPES.INITIATE_PAYMENT,
    idempotencyKey: `pay_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
    payload: {
      paymentId: `pay_${id}`,
      accountId: world.account.id,
      sourceAccountId: world.account.id,
      beneficiaryId,
      quoteId,
      sourceAmount: Money.fromMinorUnits(SOURCE_MINOR, 'USD'),
      purposeReference: 'family support simulation',
    },
  };
}

export function cancelIntent(world: PaymentWorld, id: string, paymentId: string): CancelPaymentIntent {
  return {
    id: asIntentId(`can_int_${id}`),
    actionType: ACTION_TYPES.CANCEL_PAYMENT,
    idempotencyKey: `can_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
    payload: { paymentId, accountId: world.account.id },
  };
}

export function readyQuoteAndBeneficiary(world: PaymentWorld, id: string, legalName = 'Ahmed Ali') {
  const createdBen = world.payments.createBeneficiary(beneficiaryIntent(world, id, legalName));
  const createdQuote = world.payments.createQuote(quoteIntent(world, id));
  if (createdQuote.outcome !== 'OK') {
    throw new Error(`quote failed: ${createdQuote.outcome}`);
  }
  const accepted = world.payments.acceptQuote(acceptIntent(world, id, createdQuote.value.quoteId));
  if (accepted.outcome !== 'OK') {
    throw new Error(`accept failed: ${accepted.outcome}`);
  }
  return { beneficiary: createdBen, quote: accepted.value };
}
