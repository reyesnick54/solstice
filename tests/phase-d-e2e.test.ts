import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { asPaymentId } from '../packages/payments/src/ids.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { SIMULATION_US_VIRTUAL_PROGRAM } from '../packages/cards/src/program.ts';
import { createCustodyProviderA } from '../packages/custody/src/provider-candidate/sandbox.ts';
import { runDepositWorkflow, runWithdrawalWorkflow, creditDepositAfterConfirmation } from '../packages/custody/src/provider-candidate/workflows.ts';
import { createBlockchainAnalyticsA } from '../packages/kernel/src/compliance/provider-candidate/blockchain-analytics.ts';
import { createMarketQuoteSourceA } from '../packages/sunrey-exchange/src/market-data/sandbox.ts';
import { createOracleProviderA } from '../packages/sunrey-chain/src/oracle/production/productization.ts';
import { acceptIntent, beneficiaryIntent, payIntent, quoteIntent } from './payment-world.ts';
import { createPhaseCWorld, ledgerBalance, signedCallback } from './phase-c-world.ts';

describe('Phase D sandbox provider journey', () => {
  it('runs the complete non-live provider journey and keeps evidence', async () => {
    const world = createPhaseCWorld('d_e2e', 500_000n);
    assert.equal(world.customer.verification.kycState, 'VERIFIED');
    assert.equal(world.account.currency, 'USD');
    assert.equal(ledgerBalance(world, world.account), 500_000n);

    const quote = world.payments.createQuote(quoteIntent(world, 'd_e2e'));
    assert.equal(quote.outcome, 'OK');
    if (quote.outcome !== 'OK') throw new Error('quote');
    assert.equal(world.payments.acceptQuote(acceptIntent(world, 'd_e2e', quote.value.quoteId)).outcome, 'OK');
    const converted = world.payments.executeInternalConversion(
      {
        ...acceptIntent(world, 'd_e2e_fx', quote.value.quoteId),
        idempotencyKey: 'd_e2e_fx',
        id: asIntentId('d_e2e_fx'),
      },
      world.sarAccount.id,
    );
    assert.equal(converted.outcome, 'OK');

    const beneficiary = world.payments.createBeneficiary(beneficiaryIntent(world, 'd_e2e'));
    assert.equal(beneficiary.outcome, 'OK');
    const payQuote = world.payments.createQuote(quoteIntent(world, 'd_e2e_pay'));
    assert.equal(payQuote.outcome, 'OK');
    if (payQuote.outcome !== 'OK') throw new Error('pay quote');
    assert.equal(world.payments.acceptQuote(acceptIntent(world, 'd_e2e_pay', payQuote.value.quoteId)).outcome, 'OK');
    world.payments.rail.setMode?.('pay_d_e2e_pay', 'PENDING');
    const pending = world.payments.initiatePayment(payIntent(world, 'd_e2e_pay', 'ben_d_e2e', payQuote.value.quoteId));
    assert.equal(pending.outcome, 'OK');
    if (pending.outcome !== 'OK') throw new Error('pay');
    const settled = world.payments.completeSettlement(asPaymentId(pending.value.paymentId));
    assert.equal(settled.outcome, 'OK');

    const requested = world.cards.requestCard({
      id: asIntentId('card_d_e2e'),
      actionType: ACTION_TYPES.REQUEST_CARD,
      idempotencyKey: 'card_d_e2e',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: 'card_d_e2e',
        accountId: world.account.id,
        ownerId: world.customer.id,
        programId: SIMULATION_US_VIRTUAL_PROGRAM.programId,
        formFactor: 'VIRTUAL',
      },
    });
    assert.equal(requested.outcome, 'OK');
    if (requested.outcome !== 'OK') throw new Error('card');
    const activated = world.cards.activateCard({
      id: asIntentId('card_act_d_e2e'),
      actionType: ACTION_TYPES.ACTIVATE_CARD,
      idempotencyKey: 'card_act_d_e2e',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: requested.value.cardId, accountId: world.account.id },
    });
    assert.equal(activated.outcome, 'OK');
    if (activated.outcome !== 'OK') throw new Error('activate');
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_d', 'n_d', {
        authorizationId: 'auth_d',
        cardId: activated.value.cardId,
        processorCardRef: activated.value.processorCardRef,
        amountMinorUnits: '2000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_d',
      }),
    );
    assert.equal(auth.outcome, 'OK');
    const capture = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CLEARING', 'clr_d', 'n_clr_d', {
        clearingId: 'clr_d',
        authorizationId: 'auth_d',
        cardId: activated.value.cardId,
        amountMinorUnits: '2000',
        currency: 'USD',
        processorReference: 'clr_d',
      }),
    );
    assert.equal(capture.outcome, 'OK');

    const custody = createCustodyProviderA();
    assert.equal(custody.createVault({ vaultId: 'vault_d', label: 'sandbox' }).ok, true);
    const wallet = custody.createWallet({
      vaultId: 'vault_d',
      walletId: 'wal_d',
      assetId: 'SUNREY_COIN',
      network: 'sunrey-sim',
    });
    assert.equal(wallet.ok, true);
    const deposit = custody.simulateDeposit('wal_d', 50n, 'dep_d');
    assert.equal(deposit.ok, true);
    const depositFlow = runDepositWorkflow({
      depositRef: 'dep_d',
      signatureVerified: true,
      networkFinalized: true,
      reorgSuspected: false,
      mappingKnown: true,
    });
    assert.equal(depositFlow.ok, true);
    if (!depositFlow.ok) throw new Error('deposit flow');
    assert.equal(creditDepositAfterConfirmation(depositFlow.value).ok, true);

    const analytics = createBlockchainAnalyticsA();
    const screen = analytics.screenAddress('wal_d_dest', asUtcInstant('2026-08-21T16:00:00.000Z'));
    assert.equal(screen.authorizesWithdrawal, false);
    const withdrawal = runWithdrawalWorkflow({
      withdrawalId: 'wd_d',
      authenticated: true,
      authorized: true,
      walletOwned: true,
      travelRuleSatisfied: true,
      riskCleared: screen.outcome === 'CLEAR',
      stepUpApproved: true,
      executionAuthorityPresent: true,
      actorKind: 'HUMAN',
      adapter: custody,
      walletId: 'wal_d',
      destination: 'dest_d',
      assetId: 'SUNREY_COIN',
      quantity: 10n,
    });
    assert.equal(withdrawal.ok, true);
    if (!withdrawal.ok) throw new Error('wd');
    assert.equal(withdrawal.value.adapterInvoked, true);
    assert.equal(custody.approveWithdrawal('wd_d').ok, true);

    const market = createMarketQuoteSourceA().getSpotPrice('SUNREY_COIN/USD', '2026-08-21T16:00:00.000Z');
    assert.equal(market.ok, true);
    const oracle = createOracleProviderA().observe('energy', '2026-08-21T16:00:00.000Z');
    assert.equal(oracle.ok, true);
    if (!oracle.ok) throw new Error('oracle');
    assert.equal(oracle.value.mintsMoonRey, false);

    const evidence = world.runtime.evidence;
    assert.ok(typeof evidence === 'object');
    assert.equal(world.customer.verification.kycState, 'VERIFIED');
  });
});
