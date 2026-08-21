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
import { SIMULATION_US_VIRTUAL_PROGRAM } from '../packages/cards/src/program.ts';
import { ledgerScaledUnits } from '../packages/money/src/ledger-amount.ts';
import { asPaymentId } from '../packages/payments/src/ids.ts';
import {
  acceptIntent,
  beneficiaryIntent,
  payIntent,
  quoteIntent,
} from './payment-world.ts';
import { createPhaseCWorld, ledgerBalance, signedCallback } from './phase-c-world.ts';

describe('Phase C money and banking acceptance', () => {
  it('runs the 30-step sandbox money scenario and keeps accounting invariants', async () => {
    const world = createPhaseCWorld('e2e', 500_000n);
    assert.equal(world.customer.verification.kycState, 'VERIFIED');
    assert.equal(world.account.currency, 'USD');
    assert.equal(world.sarAccount.currency, 'SAR');
    const fundedUsd = ledgerBalance(world, world.account);
    assert.equal(fundedUsd, 500_000n);
    assert.equal(ledgerBalance(world, world.sarAccount), 0n);

    const secondUsd = world.runtime.accountsService.open({
      id: asIntentId('open_usd2_e2e'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'open_usd2_e2e',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_ONBOARDING',
      payload: {
        accountId: asAccountId('acct_usd2_e2e'),
        ownerId: world.customer.id,
        productId: asProductId('prod_demand_usd_us'),
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: asLegalEntityId('le_solstice_us_inc'),
        jurisdiction: asJurisdiction('US'),
        currency: asCurrencyCode('USD'),
      },
    });
    assert.equal(secondUsd.outcome, 'OPENED');
    if (secondUsd.outcome !== 'OPENED') {
      throw new Error('second usd');
    }
    const transferred = world.runtime.money.transfer({
      id: asIntentId('xfer_e2e'),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: 'xfer_e2e',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: world.account.id,
        destinationAccountId: secondUsd.account.id,
        amount: Money.fromMinorUnits(25_000n, 'USD'),
      },
    });
    assert.equal(transferred.outcome, 'POSTED');
    assert.equal(ledgerBalance(world, world.account), 475_000n);
    assert.equal(ledgerBalance(world, secondUsd.account), 25_000n);

    const quote = world.payments.createQuote(quoteIntent(world, 'e2e'));
    assert.equal(quote.outcome, 'OK');
    if (quote.outcome !== 'OK') {
      throw new Error('quote');
    }
    const accepted = world.payments.acceptQuote(acceptIntent(world, 'e2e', quote.value.quoteId));
    assert.equal(accepted.outcome, 'OK');
    const converted = world.payments.executeInternalConversion(
      {
        ...acceptIntent(world, 'e2e_fx', quote.value.quoteId),
        idempotencyKey: 'fx_exec_e2e',
        id: asIntentId('fx_exec_e2e'),
      },
      world.sarAccount.id,
    );
    assert.equal(converted.outcome, 'OK');
    const usdAfterFx = ledgerBalance(world, world.account);
    const sarAfterFx = ledgerBalance(world, world.sarAccount);
    assert.ok(usdAfterFx < 475_000n);
    assert.ok(sarAfterFx > 0n);

    const beneficiary = world.payments.createBeneficiary(beneficiaryIntent(world, 'e2e'));
    assert.equal(beneficiary.outcome, 'OK');
    const payQuote = world.payments.createQuote(quoteIntent(world, 'e2e_pay'));
    assert.equal(payQuote.outcome, 'OK');
    if (payQuote.outcome !== 'OK') {
      throw new Error('pay quote');
    }
    assert.equal(world.payments.acceptQuote(acceptIntent(world, 'e2e_pay', payQuote.value.quoteId)).outcome, 'OK');
    world.payments.rail.setMode?.('pay_e2e_pay', 'PENDING');
    const pending = world.payments.initiatePayment(
      payIntent(world, 'e2e_pay', 'ben_e2e', payQuote.value.quoteId),
    );
    if (pending.outcome !== 'OK') {
      throw new Error(`pay ${pending.outcome}`);
    }
    assert.equal(pending.value.status, 'PROCESSING');
    const settled = world.payments.completeSettlement(asPaymentId(pending.value.paymentId));
    assert.equal(settled.outcome, 'OK');
    if (settled.outcome === 'OK') {
      assert.equal(settled.value.status, 'SETTLED');
    }

    const requested = world.cards.requestCard({
      id: asIntentId('card_e2e'),
      actionType: ACTION_TYPES.REQUEST_CARD,
      idempotencyKey: 'card_e2e',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: 'card_e2e',
        accountId: world.account.id,
        ownerId: world.customer.id,
        programId: SIMULATION_US_VIRTUAL_PROGRAM.programId,
        formFactor: 'VIRTUAL',
      },
    });
    assert.equal(requested.outcome, 'OK');
    if (requested.outcome !== 'OK') {
      throw new Error('card request');
    }
    const activated = world.cards.activateCard({
      id: asIntentId('card_act_e2e'),
      actionType: ACTION_TYPES.ACTIVATE_CARD,
      idempotencyKey: 'card_act_e2e',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: requested.value.cardId, accountId: world.account.id },
    });
    assert.equal(activated.outcome, 'OK');
    if (activated.outcome !== 'OK') {
      throw new Error('card activate');
    }
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_e2e', 'n_e2e', {
        authorizationId: 'auth_e2e',
        cardId: activated.value.cardId,
        processorCardRef: activated.value.processorCardRef,
        amountMinorUnits: '4000',
        currency: 'USD',
        country: 'US',
        merchantCategory: '5411',
        processorReference: 'auth_e2e',
      }),
    );
    assert.equal(auth.outcome, 'OK');
    const available = world.cards.available(world.account.id);
    assert.ok(available.held.minorUnits >= 4000n);
    const capture = await world.cards.ingestClearingCallback(
      signedCallback(world, 'CLEARING', 'clr_e2e', 'n_clr_e2e', {
        clearingId: 'clr_e2e',
        authorizationId: 'auth_e2e',
        cardId: activated.value.cardId,
        amountMinorUnits: '4000',
        currency: 'USD',
        processorReference: 'clr_e2e',
      }),
    );
    assert.equal(capture.outcome, 'OK');
    const refund = world.cards.ingestRefundCallback(
      signedCallback(world, 'REFUND', 'rf_e2e', 'n_rf_e2e', {
        refundId: 'rf_e2e',
        originalClearingId: 'clr_e2e',
        cardId: activated.value.cardId,
        amountMinorUnits: '4000',
        currency: 'USD',
        processorReference: 'rf_e2e',
      }),
    );
    assert.equal(refund.outcome, 'OK');

    world.control.recordSettlement({
      settlementId: 'set_e2e_pay' as never,
      domain: 'PAYMENTS',
      provider: 'SIMULATED_PROVIDER_GCC',
      currency: 'USD',
      grossMinor: 101_500n,
      feesMinor: 1_500n,
      netMinor: 100_000n,
      expectedDate: world.clock.now(),
      actualDate: world.clock.now(),
      status: 'SETTLED',
      providerReferences: [settled.outcome === 'OK' ? settled.value.settlementRef ?? 'sim' : 'sim'],
      ledgerReferences: settled.outcome === 'OK' ? [...settled.value.journalIds] : [],
    });

    const expectedRef = settled.outcome === 'OK' ? settled.value.paymentId : 'pay_e2e_pay';
    const matched = world.control.runReconciliation({
      runId: 'run_e2e_match',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: world.clock.now(),
        periodEnd: world.clock.now(),
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [
        {
          recordId: expectedRef,
          domain: 'PAYMENTS',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 100_000n,
          externalRef: 'ext_e2e_pay',
          occurredAt: world.clock.now(),
        },
      ],
      reported: [
        {
          recordId: 'rep_e2e_pay',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 100_000n,
          externalRef: 'ext_e2e_pay',
          statementRef: 'stmt_e2e',
          occurredAt: world.clock.now(),
        },
      ],
    });
    assert.equal(matched.run.matchedCount, 1);
    assert.equal(matched.breaks.length, 0);

    const mismatch = world.control.runReconciliation({
      runId: 'run_e2e_break',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: world.clock.now(),
        periodEnd: world.clock.now(),
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [
        {
          recordId: 'ctrl_mismatch',
          domain: 'PAYMENTS',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 99_000n,
          externalRef: 'ext_ctrl_mismatch',
          occurredAt: world.clock.now(),
        },
      ],
      reported: [
        {
          recordId: 'rep_ctrl_mismatch',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 1n,
          externalRef: 'ext_ctrl_mismatch',
          statementRef: 'stmt_break',
          occurredAt: world.clock.now(),
        },
      ],
    });
    assert.equal(mismatch.breaks.length, 1);
    const resolved = world.control.resolveBreak(
      mismatch.breaks[0]!.breakId,
      'RESOLVED',
      'controlled_phase_c_fixture',
    );
    assert.equal(resolved.status, 'RESOLVED');

    const close = world.control.dailyClose({
      closeId: 'close_e2e',
      periodStart: world.clock.now(),
      periodEnd: world.clock.now(),
      ports: {
        customerLiabilityByCurrency: {
          USD: ledgerBalance(world, world.account) + ledgerBalance(world, secondUsd.account),
          SAR: ledgerBalance(world, world.sarAccount),
        },
        ledgerControlByCurrency: {
          USD: ledgerBalance(world, world.account) + ledgerBalance(world, secondUsd.account),
          SAR: ledgerBalance(world, world.sarAccount),
        },
        pendingHoldCount: world.runtime.holds.list().length,
      },
    });
    assert.equal(close.legalSufficiency, 'NOT_A_REGULATORY_REPORT');

    for (const journal of world.runtime.ledger.listJournals()) {
      let debit = 0n;
      let credit = 0n;
      for (const posting of journal.postings) {
        const minor = ledgerScaledUnits(posting.amount);
        if (posting.direction === 'DEBIT') {
          debit += minor;
        } else {
          credit += minor;
        }
      }
      assert.equal(debit, credit, journal.id);
    }
    assert.equal(world.runtime.capabilities.ENVIRONMENT, 'simulation');
    assert.equal(world.runtime.capabilities.LIVE_MONEY_ENABLED, false);
  });
});
