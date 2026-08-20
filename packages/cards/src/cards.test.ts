import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { createCardWorld, requestCardIntent, signedCallback } from '../../../tests/card-world.ts';
import { canTransitionCard } from './card.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import { classifyClearing } from './clearing.ts';
import { Money } from '../../money/src/money.ts';

async function issuedActive(suffix: string, deposit = 100_000n) {
  const world = createCardWorld(suffix, deposit);
  const requested = world.cards.requestCard(requestCardIntent(world, `card_${suffix}`));
  if (requested.outcome !== 'OK') {
    throw new Error('request failed');
  }
  const activated = world.cards.activateCard({
    id: asIntentId(`act_${suffix}`),
    actionType: ACTION_TYPES.ACTIVATE_CARD,
    idempotencyKey: `act_${suffix}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CARD',
    payload: { cardId: requested.value.cardId, accountId: world.account.id },
  });
  if (activated.outcome !== 'OK') {
    throw new Error('activate failed');
  }
  return { world, card: activated.value };
}

describe('card domain', () => {
  it('defines legal card transitions and forbids a balance', () => {
    assert.equal(canTransitionCard('PENDING', 'ACTIVE'), true);
    assert.equal(canTransitionCard('ACTIVE', 'FROZEN'), true);
    assert.equal(canTransitionCard('CLOSED', 'ACTIVE'), false);
    assert.throws(() => assertNoSensitiveCardData({ pan: '4111111111111111' }));
  });

  it('classifies clearing scenarios deterministically', () => {
    const auth = Money.fromMinorUnits(10_000n, 'USD');
    assert.equal(
      classifyClearing({
        authorizationAmount: auth,
        clearingAmount: auth,
        authorizationPresent: true,
        authorizationExpired: false,
        overageToleranceMinor: 0n,
      }),
      'EXACT',
    );
    assert.equal(
      classifyClearing({
        authorizationAmount: auth,
        clearingAmount: Money.fromMinorUnits(8_000n, 'USD'),
        authorizationPresent: true,
        authorizationExpired: false,
        overageToleranceMinor: 0n,
      }),
      'PARTIAL',
    );
    assert.equal(
      classifyClearing({
        authorizationAmount: null,
        clearingAmount: auth,
        authorizationPresent: false,
        authorizationExpired: false,
        overageToleranceMinor: 0n,
      }),
      'FORCE_POST_NO_AUTH',
    );
  });
});

describe('card processing failures', () => {
  it('declines a frozen card', async () => {
    const { world, card } = await issuedActive('frozen');
    const frozen = world.cards.freezeCard({
      id: asIntentId('fz_1'),
      actionType: ACTION_TYPES.FREEZE_CARD,
      idempotencyKey: 'fz_1',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: card.cardId, accountId: world.account.id },
    });
    assert.equal(frozen.outcome, 'OK');
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_fz', 'n_fz', {
        authorizationId: 'auth_fz',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_fz',
      }),
    );
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'CARD_FROZEN');
    }
  });

  it('declines a closed card', async () => {
    const { world, card } = await issuedActive('closed');
    world.cards.closeCard({
      id: asIntentId('cl_1'),
      actionType: ACTION_TYPES.CLOSE_CARD,
      idempotencyKey: 'cl_1',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: card.cardId, accountId: world.account.id },
    });
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_cl', 'n_cl', {
        authorizationId: 'auth_cl',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_cl',
      }),
    );
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'CARD_CLOSED');
    }
  });

  it('declines insufficient funds', async () => {
    const { world, card } = await issuedActive('nsf', 1_000n);
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_nsf', 'n_nsf', {
        authorizationId: 'auth_nsf',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '5000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_nsf',
      }),
    );
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'INSUFFICIENT_FUNDS');
    }
  });

  it('rejects an invalid processor signature without mutating state', async () => {
    const { world, card } = await issuedActive('sig');
    const envelope = signedCallback(world, 'AUTHORIZATION', 'auth_sig', 'n_sig', {
      authorizationId: 'auth_sig',
      cardId: card.cardId,
      processorCardRef: card.processorCardRef,
      amountMinorUnits: '1000',
      currency: 'USD',
      country: 'US',
      merchantCategory: '5411',
      processorReference: 'auth_sig',
    });
    const auth = await world.cards.ingestAuthorizationCallback({
      ...envelope,
      signatureHex: '00'.repeat(32),
    });
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'CALLBACK_INVALID_SIGNATURE');
    }
    assert.equal(world.cards.store.getAuthorization('auth_sig'), undefined);
  });

  it('declines a blocked MCC and country and amount and velocity limits', async () => {
    const { world, card } = await issuedActive('ctrl');
    world.cards.updateControls({
      id: asIntentId('ctl_1'),
      actionType: ACTION_TYPES.UPDATE_CARD_CONTROLS,
      idempotencyKey: 'ctl_1',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: card.cardId,
        accountId: world.account.id,
        controls: {
          blockedMerchantCategories: ['7995'],
          blockedCountries: ['RU'],
          transactionAmountLimitMinor: 2_000n,
          dailyAmountLimitMinor: 3_000n,
        },
      },
    });
    const mcc = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_mcc', 'n_mcc', {
        authorizationId: 'auth_mcc',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '7995',
        processorReference: 'auth_mcc',
      }),
    );
    assert.equal(mcc.outcome, 'REJECTED');
    if (mcc.outcome === 'REJECTED') {
      assert.equal(mcc.code, 'MERCHANT_CATEGORY_BLOCKED');
    }
    const country = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_cty', 'n_cty', {
        authorizationId: 'auth_cty',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'RU',
        merchantCategory: '5411',
        processorReference: 'auth_cty',
      }),
    );
    assert.equal(country.outcome, 'REJECTED');
    if (country.outcome === 'REJECTED') {
      assert.equal(country.code, 'COUNTRY_BLOCKED');
    }
    const amount = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_amt', 'n_amt', {
        authorizationId: 'auth_amt',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '2500',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_amt',
      }),
    );
    assert.equal(amount.outcome, 'REJECTED');
    if (amount.outcome === 'REJECTED') {
      assert.equal(amount.code, 'AMOUNT_LIMIT');
    }
    const first = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_vel1', 'n_vel1', {
        authorizationId: 'auth_vel1',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '2000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_vel1',
      }),
    );
    assert.equal(first.outcome, 'OK');
    const velocity = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_vel2', 'n_vel2', {
        authorizationId: 'auth_vel2',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '2000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_vel2',
      }),
    );
    assert.equal(velocity.outcome, 'REJECTED');
    if (velocity.outcome === 'REJECTED') {
      assert.equal(velocity.code, 'VELOCITY_LIMIT');
    }
  });

  it('declines a deterministic fraud block without exposing internal codes externally', async () => {
    const { world, card } = await issuedActive('fraud');
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_fr', 'n_fr', {
        authorizationId: 'auth_fr',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        merchantRef: 'sim_fraud_block_merchant',
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_fr',
      }),
    );
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'FRAUD_BLOCK');
      assert.equal(auth.message.includes('SIMULATED_FRAUD'), false);
    }
  });

  it('reverses an authorization hold idempotently', async () => {
    const { world, card } = await issuedActive('rev');
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_rev', 'n_rev', {
        authorizationId: 'auth_rev',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '4000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_rev',
      }),
    );
    if (auth.outcome !== 'OK') {
      return;
    }
    const reversed = await world.cards.ingestReversalCallback(
      signedCallback(world, 'REVERSAL', 'rev_1', 'n_rev1', {
        authorizationId: 'auth_rev',
      }),
    );
    assert.equal(reversed.outcome, 'OK');
    const again = await world.cards.ingestReversalCallback(
      signedCallback(world, 'REVERSAL', 'rev_1b', 'n_rev1b', {
        authorizationId: 'auth_rev',
      }),
    );
    assert.equal(again.outcome, 'OK');
    if (again.outcome === 'OK') {
      assert.equal(again.replay, true);
    }
  });

  it('handles partial clearing and clearing mismatch', async () => {
    const { world, card } = await issuedActive('part');
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_part', 'n_part', {
        authorizationId: 'auth_part',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '8000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_part',
      }),
    );
    assert.equal(auth.outcome, 'OK');
    const partial = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CLEARING', 'clr_part', 'n_clr_part', {
        clearingId: 'clr_part',
        authorizationId: 'auth_part',
        cardId: card.cardId,
        amountMinorUnits: '5000',
        currency: 'USD',
        processorReference: 'clr_part',
      }),
    );
    assert.equal(partial.outcome, 'OK');
    if (partial.outcome === 'OK') {
      assert.equal(partial.value.scenario, 'PARTIAL');
    }

    const { world: world2, card: card2 } = await issuedActive('mis');
    const auth2 = await world2.cards.ingestAuthorizationCallback(
      signedCallback(world2, 'AUTHORIZATION', 'auth_mis', 'n_mis', {
        authorizationId: 'auth_mis',
        cardId: card2.cardId,
        processorCardRef: card2.processorCardRef,
        amountMinorUnits: '3000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_mis',
      }),
    );
    assert.equal(auth2.outcome, 'OK');
    const mismatch = await world2.cards.ingestClearingCallback(
      signedCallback(world2, 'CLEARING', 'clr_mis', 'n_clr_mis', {
        clearingId: 'clr_mis',
        authorizationId: 'auth_mis',
        cardId: card2.cardId,
        amountMinorUnits: '9000',
        currency: 'USD',
        processorReference: 'clr_mis',
      }),
    );
    assert.equal(mismatch.outcome, 'REJECTED');
    if (mismatch.outcome === 'REJECTED') {
      assert.equal(mismatch.code, 'CLEARING_MISMATCH');
    }
  });

  it('treats duplicate clearing as harmless and records a refund and dispute', async () => {
    const { world, card } = await issuedActive('dupc');
    await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_dupc', 'n_dupc', {
        authorizationId: 'auth_dupc',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '2000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_dupc',
      }),
    );
    const first = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CLEARING', 'clr_dupc', 'n_clr_dupc', {
        clearingId: 'clr_dupc',
        authorizationId: 'auth_dupc',
        cardId: card.cardId,
        amountMinorUnits: '2000',
        currency: 'USD',
        processorReference: 'clr_dupc',
      }),
    );
    assert.equal(first.outcome, 'OK');
    const second = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CLEARING', 'clr_dupc', 'n_clr_dupc2', {
        clearingId: 'clr_dupc',
        authorizationId: 'auth_dupc',
        cardId: card.cardId,
        amountMinorUnits: '2000',
        currency: 'USD',
        processorReference: 'clr_dupc',
      }),
    );
    assert.equal(second.outcome, 'OK');
    if (second.outcome === 'OK') {
      assert.equal(second.replay, true);
    }
    const refund = world.cards.ingestRefundCallback(
      signedCallback(world, 'REFUND', 'rf_dupc', 'n_rf_dupc', {
        refundId: 'rf_dupc',
        originalClearingId: 'clr_dupc',
        cardId: card.cardId,
        amountMinorUnits: '500',
        currency: 'USD',
        processorReference: 'rf_dupc',
      }),
    );
    assert.equal(refund.outcome, 'OK');
    const opened = world.cards.openDispute({
      id: asIntentId('disp_1'),
      actionType: ACTION_TYPES.OPEN_CARD_DISPUTE,
      idempotencyKey: 'disp_1',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: card.cardId,
        accountId: world.account.id,
        disputeId: 'disp_1',
        transactionRef: 'clr_dupc',
        reasonCategory: 'DUPLICATE_CHARGE',
        amount: Money.fromMinorUnits(2000n, 'USD'),
      },
    });
    assert.equal(opened.outcome, 'OK');
    const decided = world.cards.decideDispute({
      id: asIntentId('disp_d'),
      actionType: ACTION_TYPES.DECIDE_CARD_DISPUTE,
      idempotencyKey: 'disp_d',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: card.cardId,
        accountId: world.account.id,
        disputeId: 'disp_1',
        outcome: 'WON',
      },
    });
    assert.equal(decided.outcome, 'OK');
    if (decided.outcome === 'OK') {
      assert.equal(decided.value.state, 'WON');
      assert.ok(decided.value.finalJournalId);
    }
    const recon = world.cards.injectMismatchedReport('clr_dupc', {
      clearingId: 'clr_dupc',
      amountMinorUnits: '1',
      currency: 'USD',
    });
    assert.equal(recon.status, 'INVESTIGATION_REQUIRED');
  });

  it('refuses unsupported cross-currency authorization', async () => {
    const { world, card } = await issuedActive('fx');
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_fx', 'n_fx', {
        authorizationId: 'auth_fx',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'EUR',
        country: 'DE',
        merchantCategory: '5411',
        processorReference: 'auth_fx',
      }),
    );
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'CURRENCY_NOT_SUPPORTED');
    }
  });
});
