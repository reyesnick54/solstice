import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { createCardWorld, requestCardIntent, signedCallback } from './card-world.ts';

describe('Chunk 11 exit criterion', () => {
  it('walks simulated card issue → auth hold → clear → refund → reconcile → evidence', async () => {
    const world = createCardWorld('exit', 100_000n);
    const requested = world.cards.requestCard(requestCardIntent(world, 'card_exit'));
    assert.equal(requested.outcome, 'OK');
    if (requested.outcome !== 'OK') {
      return;
    }
    const activated = world.cards.activateCard({
      id: asIntentId('act_exit'),
      actionType: ACTION_TYPES.ACTIVATE_CARD,
      idempotencyKey: 'act_exit',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: requested.value.cardId, accountId: world.account.id },
    });
    assert.equal(activated.outcome, 'OK');
    if (activated.outcome !== 'OK') {
      return;
    }
    assert.equal(activated.value.status, 'ACTIVE');
    assert.equal(activated.value.displayHint, 'SIM-CARD');
    assert.equal('balance' in activated.value, false);
    assert.equal(world.cards.available(world.account.id).available.minorUnits, 100_000n);

    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_exit_1', 'nonce_exit_1', {
        authorizationId: 'auth_exit_1',
        cardId: activated.value.cardId,
        processorCardRef: activated.value.processorCardRef,
        merchantRef: 'sim_merchant_coffee',
        merchantCategory: '5812',
        amountMinorUnits: '10000',
        currency: 'USD',
        country: 'US',
        ecommerce: true,
        processorReference: 'auth_exit_1',
      }),
    );
    assert.equal(auth.outcome, 'OK');
    if (auth.outcome !== 'OK') {
      return;
    }
    assert.equal(auth.value.decision, 'APPROVE');
    assert.ok(auth.value.holdId);
    assert.equal(world.cards.available(world.account.id).available.minorUnits, 90_000n);

    const afterHold = world.runtime.banking.holds.get(auth.value.holdId);
    assert.equal(afterHold?.state, 'ACTIVE');
    assert.equal(afterHold?.amountMinorUnits, 10_000n);

    const clearing = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CLEARING', 'clr_exit_1', 'nonce_clr_1', {
        clearingId: 'clr_exit_1',
        authorizationId: 'auth_exit_1',
        cardId: activated.value.cardId,
        amountMinorUnits: '10000',
        currency: 'USD',
        processorReference: 'clr_exit_1',
      }),
    );
    assert.equal(clearing.outcome, 'OK');
    if (clearing.outcome !== 'OK') {
      return;
    }
    assert.equal(clearing.value.state, 'SETTLED');
    assert.ok(clearing.value.journalId);

    const refund = world.cards.ingestRefundCallback(
      signedCallback(world, 'REFUND', 'rf_exit_1', 'nonce_rf_1', {
        refundId: 'rf_exit_1',
        originalClearingId: 'clr_exit_1',
        cardId: activated.value.cardId,
        amountMinorUnits: '2500',
        currency: 'USD',
        processorReference: 'rf_exit_1',
      }),
    );
    assert.equal(refund.outcome, 'OK');
    if (refund.outcome !== 'OK') {
      return;
    }
    assert.equal(refund.value.state, 'POSTED');

    const history = world.cards.history(activated.value.cardId);
    assert.ok(history.some((row) => row.kind === 'PURCHASE' && row.amountMinorUnits === '10000'));
    assert.ok(history.some((row) => row.kind === 'REFUND' && row.amountMinorUnits === '2500'));

    const recon = world.cards.store.getReconciliation('clr_exit_1');
    assert.equal(recon?.status, 'MATCHED');

    const duplicate = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_exit_1', 'nonce_exit_dup', {
        authorizationId: 'auth_exit_1',
        cardId: activated.value.cardId,
        processorCardRef: activated.value.processorCardRef,
        merchantRef: 'sim_merchant_coffee',
        merchantCategory: '5812',
        amountMinorUnits: '10000',
        currency: 'USD',
        country: 'US',
        processorReference: 'auth_exit_1',
      }),
    );
    assert.equal(duplicate.outcome, 'OK');
    if (duplicate.outcome === 'OK') {
      assert.equal(duplicate.replay, true);
    }

    const chain = world.runtime.evidence.verifyChain();
    assert.equal(chain.ok, true);
    const events = world.runtime.events.list().map((event) => event.eventType);
    assert.ok(events.includes('CardCreated'));
    assert.ok(events.includes('CardActivated'));
    assert.ok(events.includes('CardAuthorizationApproved'));
    assert.ok(events.includes('CardTransactionSettled'));
    assert.ok(events.includes('CardRefundReceived'));
    for (const event of world.runtime.events.list()) {
      const payload = JSON.stringify(event.payload);
      assert.equal(/"pan"|"cvv"|"cvc"/i.test(payload), false);
    }
  });
});
