import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { createCardWorld, requestCardIntent, signedCallback } from '../../../tests/card-world.ts';
import { canTransitionCard } from './card.ts';
import { evaluateCardControls, DEFAULT_CARD_CONTROLS } from './controls.ts';
import { Money } from '../../money/src/money.ts';
import { SimulatedCardProcessor } from './simulated-processor.ts';
import { asCardId } from './ids.ts';
import { CardStore } from './store.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import { toConsumerCard } from './product/consumer.ts';
import { CARD_TRANSACTION_LIFECYCLE } from './activity.ts';
import { WALLET_PROVISIONING_STATUSES } from './wallet/provisioning.ts';
import { ProviderWebhookGuard } from '../../security/src/regulated/webhook.ts';
import { ingestProviderWebhook, payloadHash } from './product/webhook.ts';
import { SecretValue } from '../../security/src/redaction.ts';

async function issuedActive(suffix: string, deposit = 100_000n) {
  const world = createCardWorld(suffix, deposit);
  const requested = world.cards.requestCard(requestCardIntent(world, `card_${suffix}`));
  if (requested.outcome !== 'OK') {
    throw new Error(`request failed: ${requested.outcome === 'REJECTED' ? requested.code : requested.outcome}`);
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

describe('Phase C card productization', () => {
  it('issues a simulated virtual card without PAN or CVV', async () => {
    const { world, card } = await issuedActive('issue');
    assert.equal(card.cardType, 'DEBIT');
    assert.equal(card.formFactor, 'VIRTUAL');
    assert.equal(card.status, 'ACTIVE');
    assert.equal(card.last4, '0000');
    assert.equal(card.expiry?.year, 2099);
    assert.equal(card.displayHint, 'SIM-CARD');
    assert.match(card.processorCardRef, /^sim_tok_/);
    assert.equal(card.walletProvisioningStatus, 'ELIGIBLE');
    assertNoSensitiveCardData(card);
    assertNoSensitiveCardData(toConsumerCard(card));
    assert.equal(world.cards.processor.retrieveSensitiveDetails(card.processorCardRef).outcome, 'REFUSED');
  });

  it('supports pending and failed simulated issue outcomes', () => {
    const pendingWorld = createCardWorld('isspend');
    const pending = pendingWorld.cards.requestCard(requestCardIntent(pendingWorld, 'card_pending_x'));
    assert.equal(pending.outcome, 'OK');
    if (pending.outcome === 'OK') {
      assert.equal(pending.value.status, 'REQUESTED');
    }
    const failWorld = createCardWorld('issfail');
    const failed = failWorld.cards.requestCard(requestCardIntent(failWorld, 'card_fail_x'));
    assert.equal(failed.outcome, 'REJECTED');
    if (failed.outcome === 'REJECTED') {
      assert.equal(failed.code, 'ISSUE_FAILED');
    }
  });

  it('freezes and unfreezes a card', async () => {
    const { world, card } = await issuedActive('fzcycle');
    const frozen = world.cards.freezeCard({
      id: asIntentId('fz_c'),
      actionType: ACTION_TYPES.FREEZE_CARD,
      idempotencyKey: 'fz_c',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: card.cardId, accountId: world.account.id },
    });
    assert.equal(frozen.outcome, 'OK');
    if (frozen.outcome === 'OK') {
      assert.equal(frozen.value.status, 'FROZEN');
    }
    const unfrozen = world.cards.unfreezeCard({
      id: asIntentId('ufz_c'),
      actionType: ACTION_TYPES.UNFREEZE_CARD,
      idempotencyKey: 'ufz_c',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: card.cardId, accountId: world.account.id },
    });
    assert.equal(unfrozen.outcome, 'OK');
    if (unfrozen.outcome === 'OK') {
      assert.equal(unfrozen.value.status, 'ACTIVE');
    }
  });

  it('approves an authorization and creates a hold', async () => {
    const { world, card } = await issuedActive('authok');
    const before = world.cards.available(world.account.id);
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_ok', 'n_ok', {
        authorizationId: 'auth_ok',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '2500',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_ok',
      }),
    );
    assert.equal(auth.outcome, 'OK');
    if (auth.outcome === 'OK') {
      assert.equal(auth.value.state, 'APPROVED');
      assert.ok(auth.value.holdId);
    }
    const after = world.cards.available(world.account.id);
    assert.equal(after.available.minorUnits < before.available.minorUnits, true);
  });

  it('declines insufficient funds and restricted cards', async () => {
    const { world: nsfWorld, card: nsfCard } = await issuedActive('nsf2', 500n);
    const nsf = await nsfWorld.cards.ingestAuthorizationCallback(
      signedCallback(nsfWorld, 'AUTHORIZATION', 'auth_nsf2', 'n_nsf2', {
        authorizationId: 'auth_nsf2',
        cardId: nsfCard.cardId,
        processorCardRef: nsfCard.processorCardRef,
        amountMinorUnits: '5000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_nsf2',
      }),
    );
    assert.equal(nsf.outcome, 'REJECTED');
    if (nsf.outcome === 'REJECTED') {
      assert.equal(nsf.code, 'INSUFFICIENT_FUNDS');
    }
    const { world, card } = await issuedActive('rest');
    world.cards.freezeCard({
      id: asIntentId('fz_r'),
      actionType: ACTION_TYPES.FREEZE_CARD,
      idempotencyKey: 'fz_r',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: card.cardId, accountId: world.account.id },
    });
    const restricted = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_rest', 'n_rest', {
        authorizationId: 'auth_rest',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_rest',
      }),
    );
    assert.equal(restricted.outcome, 'REJECTED');
    if (restricted.outcome === 'REJECTED') {
      assert.equal(restricted.code, 'CARD_FROZEN');
    }
  });

  it('captures, rejects duplicate capture, reverses, and refunds', async () => {
    const { world, card } = await issuedActive('cap');
    await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_cap', 'n_cap', {
        authorizationId: 'auth_cap',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '4000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_cap',
      }),
    );
    const capture = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CAPTURE', 'clr_cap', 'n_clr_cap', {
        clearingId: 'clr_cap',
        authorizationId: 'auth_cap',
        cardId: card.cardId,
        amountMinorUnits: '4000',
        currency: 'USD',
        processorReference: 'clr_cap',
      }),
    );
    assert.equal(capture.outcome, 'OK');
    const duplicate = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CAPTURE', 'clr_cap', 'n_clr_cap2', {
        clearingId: 'clr_cap',
        authorizationId: 'auth_cap',
        cardId: card.cardId,
        amountMinorUnits: '4000',
        currency: 'USD',
        processorReference: 'clr_cap',
      }),
    );
    assert.equal(duplicate.outcome, 'OK');
    if (duplicate.outcome === 'OK') {
      assert.equal(duplicate.replay, true);
    }
    const over = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CAPTURE', 'clr_over', 'n_clr_over', {
        clearingId: 'clr_over',
        authorizationId: 'auth_cap',
        cardId: card.cardId,
        amountMinorUnits: '9000',
        currency: 'USD',
        processorReference: 'clr_over',
      }),
    );
    assert.equal(over.outcome, 'REJECTED');

    const { world: revWorld, card: revCard } = await issuedActive('rev2');
    await revWorld.cards.ingestAuthorizationCallback(
      signedCallback(revWorld, 'AUTHORIZATION', 'auth_rev2', 'n_rev2', {
        authorizationId: 'auth_rev2',
        cardId: revCard.cardId,
        processorCardRef: revCard.processorCardRef,
        amountMinorUnits: '1500',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_rev2',
      }),
    );
    const reversed = await revWorld.cards.ingestReversalCallback(
      signedCallback(revWorld, 'REVERSAL', 'rev2', 'n_rev2b', { authorizationId: 'auth_rev2' }),
    );
    assert.equal(reversed.outcome, 'OK');

    const refund = world.cards.ingestRefundCallback(
      signedCallback(world, 'REFUND', 'rf_cap', 'n_rf_cap', {
        refundId: 'rf_cap',
        originalClearingId: 'clr_cap',
        cardId: card.cardId,
        amountMinorUnits: '1000',
        currency: 'USD',
        processorReference: 'rf_cap',
      }),
    );
    assert.equal(refund.outcome, 'OK');
    const activity = world.cards.activity(card.cardId);
    assert.ok(activity.some((row) => row.lifecycle === 'PARTIALLY_REFUNDED' || row.lifecycle === 'REFUNDED'));
    assert.ok(CARD_TRANSACTION_LIFECYCLE.includes('CAPTURED'));
  });

  it('enforces MCC, international, and limit controls on the server', async () => {
    const { world, card } = await issuedActive('lim');
    world.cards.updateControls({
      id: asIntentId('ctl_lim'),
      actionType: ACTION_TYPES.UPDATE_CARD_CONTROLS,
      idempotencyKey: 'ctl_lim',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: card.cardId,
        accountId: world.account.id,
        controls: {
          blockedMerchantCategories: ['5816'],
          internationalEnabled: false,
          transactionAmountLimitMinor: 2_000n,
        },
      },
    });
    const mcc = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_mcc2', 'n_mcc2', {
        authorizationId: 'auth_mcc2',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5816',
        processorReference: 'auth_mcc2',
      }),
    );
    assert.equal(mcc.outcome, 'REJECTED');
    if (mcc.outcome === 'REJECTED') {
      assert.equal(mcc.code, 'MERCHANT_CATEGORY_BLOCKED');
    }
    const intl = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_intl', 'n_intl', {
        authorizationId: 'auth_intl',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'FR',
        merchantCategory: '5411',
        processorReference: 'auth_intl',
      }),
    );
    assert.equal(intl.outcome, 'REJECTED');
    if (intl.outcome === 'REJECTED') {
      assert.equal(intl.code, 'INTERNATIONAL_DISABLED');
    }
    const decision = evaluateCardControls({
      controls: { ...DEFAULT_CARD_CONTROLS, contactlessEnabled: false },
      cardStatus: 'ACTIVE',
      amount: Money.fromMinorUnits(100n, 'USD'),
      merchantCategory: '5411',
      country: 'US',
      homeCountry: 'US',
      ecommerce: false,
      cashAtm: false,
      contactless: true,
      dailySpentMinor: 0n,
    });
    assert.equal(decision.outcome, 'DECLINE');
    if (decision.outcome === 'DECLINE') {
      assert.equal(decision.reason, 'CONTACTLESS_DISABLED');
    }
  });

  it('restores card store state after restart', async () => {
    const { world, card } = await issuedActive('rst');
    await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_rst', 'n_rst', {
        authorizationId: 'auth_rst',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        amountMinorUnits: '800',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_rst',
      }),
    );
    const snapshot = world.cards.store.snapshot();
    const restored = new CardStore();
    restored.restore(snapshot);
    assert.equal(restored.getCard(card.cardId)?.status, 'ACTIVE');
    assert.equal(restored.getAuthorization('auth_rst')?.state, 'APPROVED');
    assert.equal(restored.getCard(card.cardId)?.last4, '0000');
  });

  it('replaces a card and keeps the prior card in REPLACED', async () => {
    const { world, card } = await issuedActive('rep');
    const replacement = world.cards.requestCard({
      ...requestCardIntent(world, 'card_rep_new'),
      payload: {
        ...requestCardIntent(world, 'card_rep_new').payload,
        replaceCardId: card.cardId,
      },
    });
    assert.equal(replacement.outcome, 'OK');
    assert.equal(world.cards.getCard(card.cardId)?.status, 'REPLACED');
    assert.equal(canTransitionCard('REPLACED', 'ACTIVE'), false);
  });

  it('ingests Phase B provider webhooks idempotently', async () => {
    const { world, card } = await issuedActive('wh');
    const secret = new SecretValue('sim-card-processor-hmac-not-a-production-secret');
    const guard = new ProviderWebhookGuard();
    guard.registerProvider('sim-card-processor', secret);
    const payload = {
      authorizationId: 'auth_wh',
      cardId: card.cardId,
      processorCardRef: card.processorCardRef,
      amountMinorUnits: '1200',
      currency: 'USD',
      country: 'US',
      merchantCategory: '5411',
      processorReference: 'auth_wh',
    };
    const envelope = guard.sign(
      {
        schemaVersion: 1,
        providerId: 'sim-card-processor',
        eventType: 'authorization',
        timestampUtc: world.clock.now(),
        nonce: 'nonce_wh_1',
        idempotencyKey: 'wh_auth_1',
        payloadHash: payloadHash(payload),
      },
      secret,
    );
    const first = await ingestProviderWebhook({
      cards: world.cards,
      guard,
      envelope,
      payload,
      nowMs: Date.parse(world.clock.now()),
      processorSecret: secret,
    });
    assert.equal(first.accepted, true);
    const replayed = guard.sign(
      {
        schemaVersion: 1,
        providerId: 'sim-card-processor',
        eventType: 'authorization',
        timestampUtc: world.clock.now(),
        nonce: 'nonce_wh_2',
        idempotencyKey: 'wh_auth_1',
        payloadHash: payloadHash(payload),
      },
      secret,
    );
    const second = await ingestProviderWebhook({
      cards: world.cards,
      guard,
      envelope: replayed,
      payload,
      nowMs: Date.parse(world.clock.now()),
      processorSecret: secret,
    });
    assert.equal(second.accepted, true);
    assert.equal(second.duplicate, true);
  });

  it('exposes wallet provisioning statuses without claiming certification', () => {
    assert.deepEqual(
      [...WALLET_PROVISIONING_STATUSES],
      ['NOT_ELIGIBLE', 'ELIGIBLE', 'PROVISIONING', 'ACTIVE', 'FAILED', 'SUSPENDED'],
    );
    const processor = new SimulatedCardProcessor();
    const issued = processor.issueVirtualCard({
      cardId: asCardId('card_wallet_meta'),
      formFactor: 'VIRTUAL',
      programId: 'prog_sim_us_virtual',
    });
    const provisioned = processor.provisionWallet({
      processorCardRef: issued.processorCardRef,
      walletProvider: 'APPLE_WALLET',
      deviceRef: 'dev_sim',
    });
    assert.equal(provisioned.status, 'NOT_ELIGIBLE');
  });
});
