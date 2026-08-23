import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../packages/domain/src/account.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { asPaymentId } from '../packages/payments/src/ids.ts';
import { acceptIntent, beneficiaryIntent, payIntent, quoteIntent, readyQuoteAndBeneficiary } from './payment-world.ts';
import { createPhaseCWorld, ledgerBalance } from './phase-c-world.ts';

describe('Phase I concurrency matrix', () => {
  it('posts simultaneous transfers without duplicating money', async () => {
    const world = createPhaseCWorld('i_conc', 400_000n);
    const opened = world.runtime.accountsService.open({
      id: asIntentId('open_i_conc'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'open_i_conc',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_ONBOARDING',
      payload: {
        accountId: asAccountId('acct_i_conc_b'),
        ownerId: world.customer.id,
        productId: asProductId('prod_demand_usd_us'),
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: asLegalEntityId('le_solstice_us_inc'),
        jurisdiction: asJurisdiction('US'),
        currency: asCurrencyCode('USD'),
      },
    });
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      throw new Error('open');
    }
    const results = await Promise.all(
      [1, 2].map((n) =>
        Promise.resolve(
          world.runtime.money.transfer({
            id: asIntentId(`xfer_i_conc_${n}`),
            actionType: ACTION_TYPES.INTERNAL_TRANSFER,
            idempotencyKey: `xfer_i_conc_${n}`,
            actorId: world.actorId,
            requestedAt: world.clock.now(),
            purpose: 'CUSTOMER_TRANSFER',
            payload: {
              sourceAccountId: world.account.id,
              destinationAccountId: opened.account.id,
              amount: Money.fromMinorUnits(10_000n, 'USD'),
            },
          }),
        ),
      ),
    );
    assert.ok(results.every((row) => row.outcome === 'POSTED'));
    assert.equal(ledgerBalance(world, world.account), 380_000n);
    assert.equal(ledgerBalance(world, opened.account), 20_000n);
  });

  it('replays a duplicate settlement without a second journal', () => {
    const world = createPhaseCWorld('i_dup', 400_000n);
    const prepared = readyQuoteAndBeneficiary(world, 'i_dup');
    world.payments.rail.setMode?.('pay_i_dup', 'PENDING');
    const pending = world.payments.initiatePayment(payIntent(world, 'i_dup', 'ben_i_dup', prepared.quote.quoteId));
    assert.equal(pending.outcome, 'OK');
    const first = world.payments.completeSettlement(asPaymentId('pay_i_dup'));
    assert.equal(first.outcome, 'OK');
    const journals = world.runtime.ledger.listJournals().length;
    const second = world.payments.completeSettlement(asPaymentId('pay_i_dup'));
    assert.equal(second.outcome, 'OK');
    assert.equal(world.runtime.ledger.listJournals().length, journals);
  });

  it('keeps the same FX conversion idempotency key from creating a second debit', () => {
    const world = createPhaseCWorld('i_fx', 400_000n);
    const created = world.payments.createQuote(quoteIntent(world, 'i_fx'));
    assert.equal(created.outcome, 'OK');
    if (created.outcome !== 'OK') {
      throw new Error('quote');
    }
    assert.equal(world.payments.acceptQuote(acceptIntent(world, 'i_fx', created.value.quoteId)).outcome, 'OK');
    const first = world.payments.executeInternalConversion(
      { ...acceptIntent(world, 'i_fx_exec', created.value.quoteId), idempotencyKey: 'i_fx', id: asIntentId('i_fx_1') },
      world.sarAccount.id,
    );
    assert.equal(first.outcome, 'OK');
    const usd = ledgerBalance(world, world.account);
    const second = world.payments.executeInternalConversion(
      { ...acceptIntent(world, 'i_fx_exec2', created.value.quoteId), idempotencyKey: 'i_fx', id: asIntentId('i_fx_2') },
      world.sarAccount.id,
    );
    assert.equal(second.outcome, 'OK');
    assert.equal(ledgerBalance(world, world.account), usd);
  });

  it('does not create two beneficiaries from a racing create with one key', () => {
    const world = createPhaseCWorld('i_ben', 100_000n);
    const first = world.payments.createBeneficiary(beneficiaryIntent(world, 'i_ben'));
    const second = world.payments.createBeneficiary(beneficiaryIntent(world, 'i_ben'));
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    if (first.outcome === 'OK' && second.outcome === 'OK') {
      assert.equal(first.value.beneficiaryId, second.value.beneficiaryId);
    }
  });
});
