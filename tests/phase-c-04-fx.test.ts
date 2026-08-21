import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asJurisdiction, asResidency } from '../packages/domain/src/jurisdiction.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
} from '../packages/domain/src/customer.ts';
import { asMoney } from '../packages/money/src/ledger-amount.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type ExecuteFxQuoteIntent } from '../packages/permissions/src/action-types.ts';
import { PaymentsService } from '../packages/payments/src/service.ts';
import { SimulationFxProvider } from '../packages/payments/src/fx-provider.ts';
import { seedSimulationCatalog } from '../services/accounts/src/catalog.ts';
import { createSimulationRuntime } from '../services/accounts/src/runtime.ts';
import {
  acceptIntent,
  beneficiaryIntent,
  createPaymentWorld,
  DEBIT_MINOR,
  DEST_MINOR,
  FEE_MINOR,
  payIntent,
  quoteIntent,
  SOURCE_MINOR,
} from './payment-world.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function activateGbCustomer(runtime: ReturnType<typeof createSimulationRuntime>, id: string) {
  let customer = createProspect({
    id: asCustomerId(id),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    residency: asResidency('GB'),
    verification: notStartedVerification(asUtcInstant('2027-08-14T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
  assert.equal(pending.ok, true);
  customer = pending.value.customer;
  customer = {
    ...customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-14T00:00:00.000Z'),
    }),
  };
  const active = transitionCustomerStatus(customer, 'ACTIVE', NOW);
  assert.equal(active.ok, true);
  runtime.customers.put(active.value.customer.id, active.value.customer);
  return active.value.customer;
}

function createWalletWorld(suffix: string) {
  const clock = new FrozenClock(NOW);
  const runtime = createSimulationRuntime({ clock });
  const customer = activateGbCustomer(runtime, `cust_gb_${suffix}`);
  const actorId = `actor_gb_fx_${suffix}`;
  const provisioned = runtime.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: asJurisdiction('GB'),
    customerId: customer.id,
    capabilities: [
      'ACCOUNT_OPEN_REQUEST',
      'POST_DEPOSIT_REQUEST',
      'FX_QUOTE_REQUEST',
      'PAYMENT_REQUEST',
      'MANAGE_BENEFICIARY',
      'VIEW_ACCOUNT',
    ],
  });
  assert.equal(provisioned.ok, true);
  const usd = runtime.accountsService.open({
    id: asIntentId(`open_usd_${suffix}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `open_usd_${suffix}`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(`acct_gb_usd_${suffix}`),
      ownerId: customer.id,
      productId: asProductId('prod_demand_usd_gb'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  });
  assert.equal(usd.outcome, 'OPENED');
  const sar = runtime.accountsService.open({
    id: asIntentId(`open_sar_${suffix}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `open_sar_${suffix}`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(`acct_gb_sar_${suffix}`),
      ownerId: customer.id,
      productId: asProductId('prod_demand_sar_gb'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('SAR'),
    },
  });
  assert.equal(sar.outcome, 'OPENED');
  const deposited = runtime.money.deposit({
    id: asIntentId(`dep_${suffix}`),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: `dep_${suffix}`,
    actorId,
    requestedAt: clock.now(),
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: usd.account.id, amount: Money.fromMinorUnits(200_000n, 'USD') },
  });
  assert.equal(deposited.outcome, 'POSTED');
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
  return { runtime, clock, payments, customer, usd: usd.account, sar: sar.account, actorId };
}

function walletQuote(world: ReturnType<typeof createWalletWorld>, id: string, pair: 'USD/SAR' | 'SAR/USD' = 'USD/SAR') {
  const [base, quote] = pair.split('/') as [string, string];
  return world.payments.createQuote({
    id: asIntentId(`q_int_${id}`),
    actionType: ACTION_TYPES.CREATE_FX_QUOTE,
    idempotencyKey: `q_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_FX',
    payload: {
      quoteId: `quote_${id}`,
      accountId: pair === 'USD/SAR' ? world.usd.id : world.sar.id,
      baseCurrency: asCurrencyCode(base),
      quoteCurrency: asCurrencyCode(quote),
      sourceAmount: Money.fromMinorUnits(pair === 'USD/SAR' ? SOURCE_MINOR : 374_500n, base),
      corridorId: pair === 'USD/SAR' ? 'GB-SA-USD-SAR' : 'GB-US-SAR-USD',
    },
  });
}

function walletAccept(world: ReturnType<typeof createWalletWorld>, id: string, quoteId: string, accountId: string) {
  return world.payments.acceptQuote({
    id: asIntentId(`acc_int_${id}`),
    actionType: ACTION_TYPES.ACCEPT_FX_QUOTE,
    idempotencyKey: `acc_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_FX',
    payload: { quoteId, accountId: asAccountId(accountId) },
  });
}

function walletExecute(
  world: ReturnType<typeof createWalletWorld>,
  id: string,
  quoteId: string,
  sourceId: string,
  destId: string,
): ExecuteFxQuoteIntent {
  return {
    id: asIntentId(`ex_int_${id}`),
    actionType: ACTION_TYPES.EXECUTE_FX_QUOTE,
    idempotencyKey: `ex_key_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_FX',
    payload: {
      quoteId,
      accountId: asAccountId(sourceId),
      sourceAccountId: asAccountId(sourceId),
      destinationAccountId: asAccountId(destId),
    },
  };
}

function accountMinor(world: ReturnType<typeof createWalletWorld>, accountId: string, currency: string): bigint {
  let credits = 0n;
  let debits = 0n;
  for (const posting of world.runtime.ledger.listPostingsForAccount(accountId)) {
    if (asMoney(posting.amount).currency !== currency) {
      continue;
    }
    const minor = asMoney(posting.amount).minorUnits;
    if (posting.direction === 'CREDIT') {
      credits += minor;
    } else {
      debits += minor;
    }
  }
  return credits - debits;
}

describe('Phase C Prompt 4 FX acceptance', () => {
  it('completes USD 1,000 → SAR wallet conversion with ledger, fee, and evidence', () => {
    const world = createWalletWorld('usd_sar');
    const created = walletQuote(world, 'usd_sar');
    assert.equal(created.outcome, 'OK');
    assert.equal(created.value.sourceAmount.minorUnits, SOURCE_MINOR);
    assert.equal(created.value.destinationAmount.minorUnits, DEST_MINOR);
    assert.equal(created.value.fee.minorUnits, FEE_MINOR);
    assert.equal(created.value.amountDebited.minorUnits, DEBIT_MINOR);
    const accepted = walletAccept(world, 'usd_sar', created.value.quoteId, world.usd.id);
    assert.equal(accepted.outcome, 'OK');
    const executed = world.payments.executeQuote(
      walletExecute(world, 'usd_sar', created.value.quoteId, world.usd.id, world.sar.id),
    );
    assert.equal(executed.outcome, 'OK');
    assert.equal(executed.value.status, 'SETTLED');
    assert.ok(executed.value.reconciliationRef);
    assert.equal(accountMinor(world, world.usd.id, 'USD'), 200_000n - DEBIT_MINOR);
    assert.equal(accountMinor(world, world.sar.id, 'SAR'), DEST_MINOR);
    for (const journal of world.runtime.ledger.listJournals().filter((row) => executed.value.journalIds.includes(row.id))) {
      const currencies = new Set(journal.postings.map((posting) => asMoney(posting.amount).currency));
      assert.equal(currencies.size, 1);
    }
    assert.ok(world.runtime.evidence.list().some((row) => row.kind === 'FX_QUOTE_EXECUTED'));
  });

  it('converts SAR → USD after funding the SAR book', () => {
    const world = createWalletWorld('sar_usd');
    const sarDeposit = world.runtime.money.deposit({
      id: asIntentId('dep_sar_sar_usd'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_sar_sar_usd',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: world.sar.id, amount: Money.fromMinorUnits(400_000n, 'SAR') },
    });
    assert.equal(sarDeposit.outcome, 'POSTED');
    const created = walletQuote(world, 'sar_usd', 'SAR/USD');
    assert.equal(created.outcome, 'OK');
    const accepted = walletAccept(world, 'sar_usd', created.value.quoteId, world.sar.id);
    assert.equal(accepted.outcome, 'OK');
    const executed = world.payments.executeQuote(
      walletExecute(world, 'sar_usd', created.value.quoteId, world.sar.id, world.usd.id),
    );
    assert.equal(executed.outcome, 'OK');
    assert.equal(executed.value.status, 'SETTLED');
  });

  it('refuses expired and unapproved quotes', () => {
    const expiredWorld = createWalletWorld('exp');
    const created = walletQuote(expiredWorld, 'exp');
    assert.equal(created.outcome, 'OK');
    expiredWorld.clock.set(asUtcInstant('2026-08-14T12:01:00.000Z'));
    const accepted = walletAccept(expiredWorld, 'exp', created.value.quoteId, expiredWorld.usd.id);
    assert.equal(accepted.outcome, 'REJECTED');
    const openWorld = createWalletWorld('unapp');
    const open = walletQuote(openWorld, 'unapp');
    assert.equal(open.outcome, 'OK');
    const executed = openWorld.payments.executeQuote(
      walletExecute(openWorld, 'unapp', open.value.quoteId, openWorld.usd.id, openWorld.sar.id),
    );
    assert.equal(executed.outcome, 'REJECTED');
    if (executed.outcome === 'REJECTED') {
      assert.equal(executed.code, 'QUOTE_NOT_APPROVED');
    }
  });

  it('does not move funds when the simulated provider fails or the rate moves', () => {
    const world = createWalletWorld('prov');
    const fx = world.payments.fx as SimulationFxProvider;
    fx.setMode('PROVIDER_UNAVAILABLE');
    const unavailable = walletQuote(world, 'unavail');
    assert.equal(unavailable.outcome, 'REJECTED');
    fx.setMode('NORMAL');
    const created = walletQuote(world, 'fail');
    assert.equal(created.outcome, 'OK');
    assert.equal(walletAccept(world, 'fail', created.value.quoteId, world.usd.id).outcome, 'OK');
    fx.setMode('EXECUTION_FAILED');
    const failed = world.payments.executeQuote(
      walletExecute(world, 'fail', created.value.quoteId, world.usd.id, world.sar.id),
    );
    assert.equal(failed.outcome, 'REJECTED');
    assert.equal(accountMinor(world, world.usd.id, 'USD'), 200_000n);
    assert.equal(accountMinor(world, world.sar.id, 'SAR'), 0n);

    const movedWorld = createWalletWorld('moved');
    const quote = walletQuote(movedWorld, 'moved');
    assert.equal(quote.outcome, 'OK');
    walletAccept(movedWorld, 'moved', quote.value.quoteId, movedWorld.usd.id);
    (movedWorld.payments.fx as SimulationFxProvider).setMode('RATE_MOVED');
    const moved = movedWorld.payments.executeQuote(
      walletExecute(movedWorld, 'moved', quote.value.quoteId, movedWorld.usd.id, movedWorld.sar.id),
    );
    assert.equal(moved.outcome, 'REJECTED');
    if (moved.outcome === 'REJECTED') {
      assert.equal(moved.code, 'RATE_MOVED');
    }
  });

  it('replays executeQuote idempotently', () => {
    const world = createWalletWorld('idemp');
    const created = walletQuote(world, 'idemp');
    assert.equal(created.outcome, 'OK');
    walletAccept(world, 'idemp', created.value.quoteId, world.usd.id);
    const first = world.payments.executeQuote(
      walletExecute(world, 'idemp', created.value.quoteId, world.usd.id, world.sar.id),
    );
    const second = world.payments.executeQuote(
      walletExecute(world, 'idemp', created.value.quoteId, world.usd.id, world.sar.id),
    );
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    assert.equal(second.replay, true);
    assert.equal(accountMinor(world, world.usd.id, 'USD'), 200_000n - DEBIT_MINOR);
  });

  it('composes payment+FX without a loosely coupled conversion', () => {
    const world = createPaymentWorld('payfx');
    const beneficiary = world.payments.createBeneficiary(beneficiaryIntent(world, 'payfx'));
    assert.equal(beneficiary.outcome, 'OK');
    const quote = world.payments.createQuote(quoteIntent(world, 'payfx'));
    assert.equal(quote.outcome, 'OK');
    const composed = world.payments.composePaymentFx({
      compositionId: 'cmp_payfx',
      quoteId: quote.value.quoteId,
      sourceAccountId: world.account.id,
      beneficiaryId: beneficiary.value.beneficiaryId,
      purposeReference: 'FAMILY_SUPPORT',
      idempotencyKey: 'cmp_payfx',
    });
    assert.equal(composed.outcome, 'OK');
    assert.equal(composed.value.composition.recovery.stranded, false);
    const executed = world.payments.executePaymentFx(
      'cmp_payfx',
      acceptIntent(world, 'payfx', quote.value.quoteId),
      payIntent(world, 'payfx', beneficiary.value.beneficiaryId, quote.value.quoteId),
    );
    assert.equal(executed.outcome, 'OK');
    assert.equal(executed.value.payment?.status, 'SETTLED');
    assert.equal(executed.value.composition.status, 'SETTLED');
  });

  it('returns Kernel denial unchanged', () => {
    const world = createPaymentWorld('deny');
    const denied = world.payments.createQuote({
      ...quoteIntent(world, 'deny'),
      actorId: 'actor_unknown_deny',
    });
    assert.equal(denied.outcome, 'KERNEL_REFUSED');
  });
});
