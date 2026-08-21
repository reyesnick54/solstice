import { FrozenClock } from '../packages/config/src/clock.ts';
import { asAccountId, type Account } from '../packages/domain/src/account.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { InMemorySecretProvider } from '../packages/security/src/secrets.ts';
import { CardsService } from '../packages/cards/src/index.ts';
import { PaymentsService } from '../packages/payments/src/service.ts';
import { TreasuryService } from '../packages/treasury/src/service.ts';
import { FinancialControlService, seedTreasuryStore } from '../packages/treasury/src/index.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createCardHoldGateway } from '../services/cards/src/hold-gateway.ts';
import { balanceOfAccount } from '../services/accounts/src/balances.ts';
import {
  CARD_PROCESSOR_SECRET,
  createCardWorld,
  signedCallback,
  type CardWorld,
} from './card-world.ts';
import {
  activateUsCustomer,
  createPaymentWorld,
  PAY_NOW,
  US_ACTOR,
  type PaymentWorld,
} from './payment-world.ts';

export type PhaseCWorld = PaymentWorld & {
  readonly cards: CardsService;
  readonly treasury: TreasuryService;
  readonly control: FinancialControlService;
  readonly sarAccount: Account;
  readonly secrets: InMemorySecretProvider;
  readonly processorActorId: string;
  readonly operationsActorId: string;
};

export function ledgerBalance(world: { readonly runtime: PaymentWorld['runtime'] }, account: Account): bigint {
  const balance = balanceOfAccount(world.runtime.ledger, account);
  if (!balance.ok) {
    throw new Error(balance.error.message);
  }
  return balance.value.minorUnits;
}

export function createPhaseCWorld(suffix: string, depositMinor = 500_000n): PhaseCWorld {
  const payment = createPaymentWorld(suffix, depositMinor);
  const seeded = seedSimulationCatalog();
  const treasury = new TreasuryService(
    payment.runtime.kernel,
    payment.runtime.issuer,
    payment.runtime.evidence,
    payment.runtime.events,
    payment.clock,
    {
      customers: payment.runtime.customers,
      accounts: payment.runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    payment.runtime.identity.service,
    { ledger: payment.runtime.ledger, seed: true },
  );
  const payments = new PaymentsService(
    payment.runtime.kernel,
    payment.runtime.issuer,
    payment.runtime.ledger,
    payment.runtime.evidence,
    payment.runtime.events,
    payment.clock,
    {
      customers: payment.runtime.customers,
      accounts: payment.runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    payment.runtime.identity.service,
    { treasury },
  );
  const processorActorId = `actor_card_proc_${suffix}`;
  const operationsActorId = `actor_card_ops_${suffix}`;
  for (const [actorId, capabilities] of [
    [processorActorId, ['CARD_AUTHORIZE_REQUEST', 'CARD_CLEAR_REQUEST']],
    [operationsActorId, ['HOLD_REQUEST', 'CARD_MANAGE_REQUEST']],
  ] as const) {
    const provisioned = payment.runtime.identity.provisionSimulatedActor({
      actorId,
      jurisdiction: asJurisdiction('US'),
      capabilities,
    });
    if (!provisioned.ok) {
      throw new Error(provisioned.error.message);
    }
  }
  const secrets = new InMemorySecretProvider('simulation', {
    'card-processor-callback': CARD_PROCESSOR_SECRET,
    'wallet-provider-callback': CARD_PROCESSOR_SECRET,
    'acceptance-provider-callback': CARD_PROCESSOR_SECRET,
  });
  const cards = new CardsService(
    payment.runtime.kernel,
    payment.runtime.issuer,
    payment.runtime.ledger,
    payment.runtime.evidence,
    payment.runtime.events,
    payment.clock,
    {
      customers: payment.runtime.customers,
      accounts: payment.runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    payment.runtime.identity.service,
    createCardHoldGateway(payment.runtime.banking, payment.runtime.ledger, payment.clock),
    secrets,
    { processorActorId, operationsActorId },
  );
  const openedSar = payment.runtime.accountsService.open({
    id: asIntentId(`open_sar_${suffix}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `open_sar_${suffix}`,
    actorId: payment.actorId,
    requestedAt: payment.clock.now(),
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(`acct_sar_${suffix}`),
      ownerId: payment.customer.id,
      productId: asProductId('prod_demand_sar_sa'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_sa_entity'),
      jurisdiction: asJurisdiction('SA'),
      currency: asCurrencyCode('SAR'),
    },
  });
  if (openedSar.outcome !== 'OPENED') {
    throw new Error(`expected SAR OPENED, got ${openedSar.outcome}`);
  }
  const control = new FinancialControlService(
    payment.clock,
    payment.runtime.evidence,
    payment.runtime.events,
    treasury.store,
    { ledger: payment.runtime.ledger },
  );
  seedTreasuryStore(treasury.store);
  return {
    ...payment,
    payments,
    cards,
    treasury,
    control,
    sarAccount: openedSar.account,
    secrets,
    processorActorId,
    operationsActorId,
  };
}

export { activateUsCustomer, signedCallback, createCardWorld, PAY_NOW, US_ACTOR };
export type { CardWorld };
