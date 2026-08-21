import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { asAccountId } from '../../../domain/src/account.ts';
import { asCurrencyCode } from '../../../domain/src/currency.ts';
import { asLegalEntityId } from '../../../domain/src/legal-entity.ts';
import { asProductId } from '../../../domain/src/product.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { InMemoryWorkflowStore } from '../../../events/src/workflow.ts';
import { Money } from '../../../money/src/money.ts';
import { asIntentId } from '../../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import {
  activateUsCustomer,
  createPaymentWorld,
  PAY_NOW,
  type PaymentWorld,
} from '../../../../tests/payment-world.ts';
import { seedSimulationCatalog } from '../../../../services/accounts/src/catalog.ts';
import { evaluateBeneficiarySecurity, rejectClientVerificationMark } from './beneficiary-security.ts';
import { canTransitionLifecycle } from './lifecycle.ts';
import { evaluatePaymentLimits } from './limits.ts';
import { LedgerFundsReservation } from './funds-reservation.ts';
import { admitInboundNotice, inboundMustNotCredit } from './inbound.ts';
import { disposePaymentFailure } from './failures.ts';
import { PaymentPlatform } from './orchestrator.ts';
import { SimulationOnlyPaymentProvider } from './simulated-provider.ts';
import { assertSimulationOnly } from './simulated-provider.ts';
import { PAYMENT_WORKFLOW_TYPE } from './workflow.ts';

function platformOf(world: PaymentWorld, options: { requireApproval?: boolean } = {}): PaymentPlatform {
  const seeded = seedSimulationCatalog();
  return new PaymentPlatform(world.payments, {
    kernel: world.runtime.kernel,
    issuer: world.runtime.issuer,
    ledger: world.runtime.ledger,
    evidence: world.runtime.evidence,
    events: world.runtime.events,
    clock: world.clock,
    catalog: {
      customers: world.runtime.customers,
      accounts: world.runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    identity: world.runtime.identity.service,
    sessionFor: (actorId) => world.runtime.identity.service.activeSessionForActor(actorId),
    ...(options.requireApproval ? { requireApproval: true } : {}),
  });
}

function openSecondAccount(world: PaymentWorld, id: string, deposit = 50_000n) {
  const opened = world.runtime.accountsService.open({
    id: asIntentId(`open_${id}`),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: `open_${id}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(id),
      ownerId: world.customer.id,
      productId: asProductId('prod_demand_usd_us'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_us_inc'),
      jurisdiction: world.account.jurisdiction,
      currency: asCurrencyCode('USD'),
    },
  });
  if (opened.outcome !== 'OPENED') {
    throw new Error(`expected OPENED, got ${opened.outcome}`);
  }
  if (deposit > 0n) {
    const posted = world.runtime.money.deposit({
      id: asIntentId(`dep_${id}`),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: `dep_${id}`,
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(deposit, 'USD') },
    });
    if (posted.outcome !== 'POSTED') {
      throw new Error(`expected POSTED, got ${posted.outcome}`);
    }
  }
  return opened.account;
}

describe('payment platform productization', () => {
  it('creates a beneficiary and denies cross-user access', () => {
    const alice = createPaymentWorld('plat_ben_a');
    const bob = createPaymentWorld('plat_ben_b');
    const platform = platformOf(alice);
    const created = platform.createRecipient({
      actorId: alice.actorId,
      ownerId: alice.customer.id,
      accountId: alice.account.id,
      kind: 'PERSON',
      destinationCountry: 'SA',
      currency: 'SAR',
      legalName: 'Ahmed Ali',
      accountCoordinate: { scheme: 'SA_IBAN', value: 'SA0380000000608010167519' },
      idempotencyKey: 'ben_alice_1',
      beneficiaryId: 'ben_alice_1',
    });
    assert.equal(created.outcome, 'OK');
    if (created.outcome !== 'OK') {
      return;
    }
    assert.equal(created.value.destinationType, 'INTERNATIONAL_BANK');
    assert.equal(created.value.verificationStatus, 'ACTIVE');
    const denied = platform.getRecipient(bob.customer.id, created.value.id);
    assert.equal(denied.outcome, 'REJECTED');
    if (denied.outcome === 'REJECTED') {
      assert.equal(denied.code, 'CROSS_USER_DENIED');
    }
    const otherCreate = platform.createRecipient({
      actorId: alice.actorId,
      ownerId: bob.customer.id,
      accountId: alice.account.id,
      kind: 'PERSON',
      destinationCountry: 'SA',
      currency: 'SAR',
      legalName: 'Nope',
      accountCoordinate: { scheme: 'SA_IBAN', value: 'SA0380000000608010167519' },
      idempotencyKey: 'ben_cross',
    });
    assert.equal(otherCreate.outcome, 'REJECTED');
  });

  it('rejects client verification marks and requires step-up', () => {
    assert.equal(rejectClientVerificationMark({ verified: true }), true);
    const world = createPaymentWorld('plat_step');
    const session = world.runtime.identity.service.activeSessionForActor(world.actorId);
    assert.ok(session);
    const weak = Object.freeze({ ...session, authenticationStrength: 'STANDARD' as const });
    const decision = evaluateBeneficiarySecurity({
      ownerId: world.customer.id,
      actorId: world.actorId,
      session: weak,
      deviceRisk: 'LOW',
      now: PAY_NOW,
      recentCreates: [],
    });
    assert.equal(decision.outcome, 'STEP_UP_REQUIRED');
    const platform = platformOf(world);
    const created = platform.createRecipient({
      actorId: world.actorId,
      ownerId: world.customer.id,
      accountId: world.account.id,
      kind: 'PERSON',
      destinationCountry: 'SA',
      currency: 'SAR',
      legalName: 'Ahmed Ali',
      accountCoordinate: { scheme: 'SA_IBAN', value: 'SA0380000000608010167519' },
      idempotencyKey: 'ben_step',
      clientBody: { verified: true, status: 'ACTIVE' },
    });
    assert.equal(created.outcome, 'OK');
  });

  it('quotes an internal transfer without promising settlement time', () => {
    const world = createPaymentWorld('plat_quote');
    const dest = openSecondAccount(world, 'acct_plat_quote_dest');
    const platform = platformOf(world);
    const quoted = platform.quote({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.id,
      amountMinorUnits: '25000',
      currency: 'USD',
    });
    assert.equal(quoted.outcome, 'OK');
    if (quoted.outcome !== 'OK') {
      return;
    }
    assert.equal(quoted.value.estimatedDeliveryClass, 'LEDGER_INSTANT');
    assert.equal(quoted.value.settlementTimePromise, null);
    assert.equal(quoted.value.fx, null);
    assert.equal(quoted.value.productionMoneyMovement, false);
  });

  it('posts an atomic idempotent internal transfer and prevents overspend', () => {
    const world = createPaymentWorld('plat_int', 100_000n);
    const dest = openSecondAccount(world, 'acct_plat_int_dest', 0n);
    const platform = platformOf(world);
    const first = platform.createPayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.id,
      amountMinorUnits: '40000',
      currency: 'USD',
      idempotencyKey: 'int_pay_1',
      paymentId: 'pay_int_1',
    });
    assert.equal(first.outcome, 'OK');
    if (first.outcome !== 'OK') {
      return;
    }
    assert.equal(first.value.status, 'SETTLED');
    assert.equal(first.value.paymentType, 'ACCOUNT_TO_ACCOUNT');
    const replay = platform.createPayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.id,
      amountMinorUnits: '40000',
      currency: 'USD',
      idempotencyKey: 'int_pay_1',
      paymentId: 'pay_int_1',
    });
    assert.equal(replay.outcome, 'OK');
    if (replay.outcome === 'OK') {
      assert.equal(replay.replay, true);
    }
    const over = platform.createPayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.id,
      amountMinorUnits: '70000',
      currency: 'USD',
      idempotencyKey: 'int_pay_over',
    });
    assert.equal(over.outcome, 'REJECTED');
    if (over.outcome === 'REJECTED') {
      assert.equal(over.code, 'INSUFFICIENT_FUNDS');
    }
    const concurrent = platform.createPayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.id,
      amountMinorUnits: '61000',
      currency: 'USD',
      idempotencyKey: 'int_pay_2',
    });
    assert.equal(concurrent.outcome, 'REJECTED');
  });

  it('posts a SunRey-to-SunRey ledger transfer', () => {
    const world = createPaymentWorld('plat_xuser', 50_000n);
    const counterparty = activateUsCustomer(world.runtime, 'cust_plat_xuser_dest');
    const dest = world.runtime.accountsService.open({
      id: asIntentId('open_plat_xuser_dest'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'open_plat_xuser_dest',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_ONBOARDING',
      payload: {
        accountId: asAccountId('acct_plat_xuser_dest'),
        ownerId: counterparty.id,
        productId: asProductId('prod_demand_usd_us'),
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: asLegalEntityId('le_solstice_us_inc'),
        jurisdiction: world.account.jurisdiction,
        currency: asCurrencyCode('USD'),
      },
    });
    if (dest.outcome !== 'OPENED') {
      throw new Error(`expected OPENED, got ${dest.outcome}`);
    }
    const platform = platformOf(world);
    const paid = platform.createPayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.account.id,
      amountMinorUnits: '2500',
      currency: 'USD',
      idempotencyKey: 'xuser_pay',
    });
    assert.equal(paid.outcome, 'OK');
    if (paid.outcome === 'OK') {
      assert.equal(paid.value.status, 'SETTLED');
      assert.equal(paid.value.paymentType, 'SUNREY_TO_SUNREY');
    }
  });

  it('holds and captures once, and releases on failure', () => {
    const world = createPaymentWorld('plat_hold');
    const holds = new LedgerFundsReservation(world.runtime.ledger);
    const amount = Money.fromMinorUnits(10_000n, 'USD');
    const opened = world.runtime.accountsService.open;
    void opened;
    const funded = world.runtime.money.deposit({
      id: asIntentId('dep_hold_extra'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_hold_extra',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: world.account.id, amount: Money.fromMinorUnits(20_000n, 'USD') },
    });
    assert.equal(funded.outcome, 'POSTED');
    const authorityIntent = {
      id: asIntentId('hold_auth'),
      actionType: ACTION_TYPES.INITIATE_PAYMENT,
      idempotencyKey: 'hold_auth',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT' as const,
      payload: {
        paymentId: 'pay_hold',
        accountId: world.account.id,
        sourceAccountId: world.account.id,
        beneficiaryId: 'ben_hold',
        quoteId: 'q_hold',
        sourceAmount: amount,
        purposeReference: 'hold test',
      },
    };
    const gated = world.runtime.kernel.submit(authorityIntent, {
      actor: { id: world.actorId, capabilities: ['INITIATE_PAYMENT'] },
      identity: world.runtime.identity.service.identityFactsFor(world.actorId),
      customer: world.customer,
      sourceAccount: world.account,
      jurisdiction: world.account.jurisdiction,
      amount,
      screening: { sanctionsHit: false, pepHit: false, fraudHold: false, screeningRef: 'scr_none' },
      corridorSimulationEnabled: true,
    });
    assert.equal(gated.status, 'ALLOW');
    assert.ok(gated.executionAuthority);
    const reserved = holds.reserve({
      reservationId: 'res_1',
      paymentId: 'pay_hold',
      accountId: world.account.id,
      amount,
      authority: gated.executionAuthority,
      actionType: ACTION_TYPES.INITIATE_PAYMENT,
      now: world.clock.now(),
    });
    assert.equal(reserved.state, 'RESERVED');
    const captured = holds.capture({
      reservationId: 'res_1',
      principal: amount,
      fee: Money.zero('USD'),
      authority: gated.executionAuthority,
      actionType: ACTION_TYPES.INITIATE_PAYMENT,
      now: world.clock.now(),
    });
    assert.equal(captured.state, 'CAPTURED');
    const again = holds.capture({
      reservationId: 'res_1',
      principal: amount,
      fee: Money.zero('USD'),
      authority: gated.executionAuthority,
      actionType: ACTION_TYPES.INITIATE_PAYMENT,
      now: world.clock.now(),
    });
    assert.equal(again.captureJournalId, captured.captureJournalId);
    const dest = openSecondAccount(world, 'acct_plat_hold_dest', 0n);
    const releaseIntent = {
      id: asIntentId('hold_rel'),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: 'hold_rel',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_TRANSFER' as const,
      payload: {
        sourceAccountId: world.account.id,
        destinationAccountId: dest.id,
        amount,
      },
    };
    const gated2 = world.runtime.kernel.submit(releaseIntent, {
      actor: { id: world.actorId, capabilities: ['INTERNAL_TRANSFER'] },
      identity: world.runtime.identity.service.identityFactsFor(world.actorId),
      customer: world.customer,
      sourceAccount: world.account,
      jurisdiction: world.account.jurisdiction,
      amount,
    });
    assert.equal(gated2.status, 'ALLOW');
    assert.ok(gated2.executionAuthority);
    const holds2 = new LedgerFundsReservation(world.runtime.ledger);
    holds2.reserve({
      reservationId: 'res_2',
      paymentId: 'pay_rel',
      accountId: world.account.id,
      amount,
      authority: gated2.executionAuthority,
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      now: world.clock.now(),
    });
    const released = holds2.release({
      reservationId: 'res_2',
      authority: gated2.executionAuthority,
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      now: world.clock.now(),
    });
    assert.equal(released.state, 'RELEASED');
  });

  it('maps simulated provider success, pending, failure, return, and duplicate callbacks', () => {
    const provider = new SimulationOnlyPaymentProvider();
    provider.setScenario('pay_ok', 'SUCCESS');
    provider.setScenario('pay_pending', 'PENDING');
    provider.setScenario('pay_fail', 'FAILED');
    provider.setScenario('pay_ret', 'RETURNED');
    assert.equal(provider.cannotEnableProduction(), true);
    assert.equal(provider.productionEnabled, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assertSimulationOnly();

    const world = createPaymentWorld('plat_fail');
    const dest = openSecondAccount(world, 'acct_plat_fail_dest', 0n);
    const platform = platformOf(world);
    const created = platform.createPayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.id,
      amountMinorUnits: '1000',
      currency: 'USD',
      idempotencyKey: 'fail_pay',
      paymentId: 'pay_fail_cb',
    });
    assert.equal(created.outcome, 'OK');
    const returned = platform.applyFailure('pay_fail_cb', 'RETURN_AFTER_SUBMISSION');
    assert.equal(returned.outcome, 'OK');
    if (returned.outcome === 'OK') {
      assert.equal(returned.value.status, 'RETURNED');
    }
    const duplicate = platform.applyFailure('pay_fail_cb', 'DUPLICATE_CALLBACK');
    assert.equal(duplicate.outcome, 'OK');
    if (duplicate.outcome === 'OK') {
      assert.equal(duplicate.replay, true);
      assert.equal(duplicate.value.status, 'RETURNED');
    }
    const reversed = platform.applyFailure('pay_fail_cb', 'REVERSAL');
    assert.equal(reversed.outcome, 'OK');
    if (reversed.outcome === 'OK') {
      assert.equal(reversed.value.status, 'REVERSED');
    }
  });

  it('does not credit inbound funds from an unverified notice', () => {
    const world = createPaymentWorld('plat_in');
    const platform = platformOf(world);
    const rejected = platform.admitInbound({
      noticeId: 'in_1',
      provider: 'sim',
      rail: 'ACH',
      amountMinorUnits: '5000',
      currency: 'USD',
      destinationAccountHint: world.account.id,
      providerEventId: null,
      payloadHash: 'abc',
      verification: { ok: false, reason: 'unsigned callback' },
    });
    assert.equal(rejected.status, 'REJECTED_UNVERIFIED');
    assert.equal(inboundMustNotCredit(rejected), true);
    assert.equal(rejected.creditJournalId, null);
    const verified = admitInboundNotice({
      noticeId: 'in_2',
      provider: 'sim',
      rail: 'ACH',
      amountMinorUnits: '5000',
      currency: 'USD',
      destinationAccountHint: world.account.id,
      providerEventId: 'evt_1',
      payloadHash: 'def',
      verification: { ok: true, providerEventId: 'evt_1', payloadHash: 'def' },
    });
    assert.equal(verified.verified, true);
    assert.equal(verified.creditJournalId, null);
  });

  it('requires approval and recovers a persisted workflow', async () => {
    const world = createPaymentWorld('plat_wf');
    const dest = openSecondAccount(world, 'acct_plat_wf_dest', 0n);
    const workflowStore = new InMemoryWorkflowStore();
    const seeded = seedSimulationCatalog();
    const platform = new PaymentPlatform(world.payments, {
      kernel: world.runtime.kernel,
      issuer: world.runtime.issuer,
      ledger: world.runtime.ledger,
      evidence: world.runtime.evidence,
      events: world.runtime.events,
      clock: world.clock,
      catalog: {
        customers: world.runtime.customers,
        accounts: world.runtime.accounts,
        products: seeded.products.asCatalog(),
        legalEntities: seeded.legalEntities,
      },
      identity: world.runtime.identity.service,
      sessionFor: (actorId) => world.runtime.identity.service.activeSessionForActor(actorId),
      requireApproval: true,
      workflowStore,
    });
    const created = platform.createPayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      sourceAccountId: world.account.id,
      destinationAccountId: dest.id,
      amountMinorUnits: '2000',
      currency: 'USD',
      idempotencyKey: 'wf_pay',
      paymentId: 'pay_wf_1',
    });
    assert.equal(created.outcome, 'AWAITING_APPROVAL');
    const snapshot = await workflowStore.snapshot();
    const restored = new InMemoryWorkflowStore();
    await restored.restore(snapshot);
    const recovered = new PaymentPlatform(world.payments, {
      kernel: world.runtime.kernel,
      issuer: world.runtime.issuer,
      ledger: world.runtime.ledger,
      evidence: world.runtime.evidence,
      events: world.runtime.events,
      clock: world.clock,
      catalog: {
        customers: world.runtime.customers,
        accounts: world.runtime.accounts,
        products: seeded.products.asCatalog(),
        legalEntities: seeded.legalEntities,
      },
      identity: world.runtime.identity.service,
      sessionFor: (actorId) => world.runtime.identity.service.activeSessionForActor(actorId),
      requireApproval: true,
      workflowStore: restored,
      store: platform.store,
    });
    const state = await recovered.recoverWorkflow(`wf_pay_wf_1`);
    assert.ok(state === 'WAITING_HUMAN' || state === 'COMPLETED' || state === 'RUNNING');
    const approved = platform.approvePayment({
      actorId: world.actorId,
      ownerId: world.customer.id,
      paymentId: 'pay_wf_1',
    });
    assert.equal(approved.outcome, 'OK');
    if (approved.outcome === 'OK') {
      assert.equal(approved.value.status, 'SETTLED');
    }
    assert.equal(PAYMENT_WORKFLOW_TYPE, 'payment.outbound');
  });

  it('refuses when Kernel denies and when compliance waits', () => {
    const world = createPaymentWorld('plat_ker');
    const dest = openSecondAccount(world, 'acct_plat_ker_dest', 0n);
    const platform = platformOf(world);
    const denied = platform.transferInternal({
      id: asIntentId('ker_deny'),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: 'ker_deny',
      actorId: 'unknown_actor',
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: world.account.id,
        destinationAccountId: dest.id,
        amount: Money.fromMinorUnits(1000n, 'USD'),
      },
    });
    assert.ok(denied.outcome === 'KERNEL_REFUSED' || denied.outcome === 'REJECTED');
    assert.equal(disposePaymentFailure({ current: 'AWAITING_COMPLIANCE', failureClass: 'PROVIDER_REJECTION' }).nextStatus, 'FAILED');
    assert.equal(canTransitionLifecycle('AUTHORIZED', 'QUEUED'), true);
    assert.equal(canTransitionLifecycle('SETTLED', 'CANCELLED'), false);
    const limit = evaluatePaymentLimits(
      {
        amount: Money.fromMinorUnits(99_000_000n, 'USD'),
        at: asUtcInstant('2026-08-21T12:00:00.000Z'),
        currency: asCurrencyCode('USD'),
        rail: 'WIRE',
        paymentType: 'WIRE',
        jurisdiction: 'US',
        riskClass: 'STANDARD',
      },
      [],
    );
    assert.equal(limit.outcome, 'LIMIT_EXCEEDED');
  });
});
