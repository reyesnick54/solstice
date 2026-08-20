import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEBIT_MINOR,
  DEST_MINOR,
  FEE_MINOR,
  SOURCE_MINOR,
  acceptIntent,
  beneficiaryIntent,
  createPaymentWorld,
  payIntent,
  quoteIntent,
} from './payment-world.ts';
import { ledgerAssetKey, ledgerScaledUnits } from '../packages/money/src/ledger-amount.ts';
import { TREASURY_ACCOUNT_IDS } from '../packages/payments/src/treasury.ts';

describe('Chunk 9 exit criterion', () => {
  it('sends 1000 USD from a US customer to a Saudi beneficiary as 374500 SAR', () => {
    const world = createPaymentWorld('e2e');
    const { runtime, payments } = world;

    const beneficiary = payments.createBeneficiary(beneficiaryIntent(world, 'e2e'));
    if (beneficiary.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(beneficiary.value.status, 'ACTIVE');
    assert.equal(beneficiary.value.screeningStatus, 'CLEAR');
    assert.equal(beneficiary.value.accountCoordinate.displayHint, '7519');

    const quote = payments.createQuote(quoteIntent(world, 'e2e'));
    if (quote.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(quote.value.sourceAmount.minorUnits, SOURCE_MINOR);
    assert.equal(quote.value.destinationAmount.minorUnits, DEST_MINOR);
    assert.equal(quote.value.fee.minorUnits, FEE_MINOR);
    assert.equal(quote.value.amountDebited.minorUnits, DEBIT_MINOR);
    assert.equal(quote.value.customerRate.numerator, 3745n);
    assert.equal(quote.value.customerRate.denominator, 1000n);
    assert.equal(quote.value.rateSource, 'SIMULATION_REF_NOT_LIVE_MARKET');

    const disclosure = payments.disclosure(quote.value.quoteId);
    assert.ok(disclosure);
    assert.equal(disclosure?.sendAmountMinorUnits, SOURCE_MINOR.toString());
    assert.equal(disclosure?.feeMinorUnits, FEE_MINOR.toString());
    assert.equal(disclosure?.recipientAmountMinorUnits, DEST_MINOR.toString());
    assert.equal(disclosure?.recipientCurrency, 'SAR');
    assert.equal(disclosure?.customerRate, '3745/1000');

    const accepted = payments.acceptQuote(acceptIntent(world, 'e2e', quote.value.quoteId));
    assert.equal(accepted.outcome, 'OK');

    const payment = payments.initiatePayment(
      payIntent(world, 'e2e', beneficiary.value.beneficiaryId, quote.value.quoteId),
    );
    if (payment.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(payment.value.status, 'SETTLED');
    assert.equal(payment.value.routeId, 'sim-gcc-usd-sar');
    assert.equal(payment.value.quotedDestinationAmount.minorUnits, DEST_MINOR);
    assert.equal(payment.value.fee.minorUnits, FEE_MINOR);
    assert.ok(payment.value.holdId);
    assert.ok(payment.value.settlementRef);

    const recon = payments.getStore().getReconciliation(payment.value.paymentId);
    assert.equal(recon?.status, 'MATCHED');

    const payable = runtime.ledger.listPostingsForAccount(TREASURY_ACCOUNT_IDS.beneficiaryPayableSar);
    const payableCredits = payable
      .filter((row) => row.direction === 'CREDIT')
      .reduce((sum, row) => sum + ledgerScaledUnits(row.amount), 0n);
    assert.equal(payableCredits, DEST_MINOR);

    for (const journal of runtime.ledger.listJournals()) {
      const currencies = new Set(journal.postings.map((row) => ledgerAssetKey(row.amount)));
      assert.equal(currencies.size, 1, `mixed-currency journal ${journal.memo ?? journal.id}`);
      let debits = 0n;
      let credits = 0n;
      for (const posting of journal.postings) {
        if (posting.direction === 'DEBIT') {
          debits += ledgerScaledUnits(posting.amount);
        } else {
          credits += ledgerScaledUnits(posting.amount);
        }
      }
      assert.equal(debits, credits, `unbalanced ${journal.memo ?? journal.id}`);
    }

    const usd = runtime.ledger.totalsByAsset().get('USD');
    const sar = runtime.ledger.totalsByAsset().get('SAR');
    assert.ok(usd);
    assert.ok(sar);
    assert.equal(usd.debits, usd.credits);
    assert.equal(sar.debits, sar.credits);

    const chain = runtime.evidence.verifyChain();
    assert.equal(chain.ok, true);
    assert.ok(chain.length > 0);

    const types = runtime.events.list().map((event) => event.eventType);
    assert.ok(types.includes('BeneficiaryCreated'));
    assert.ok(types.includes('FxQuoteCreated'));
    assert.ok(types.includes('FxQuoteAccepted'));
    assert.ok(types.includes('PaymentInitiated'));
    assert.ok(types.includes('PaymentHeld'));
    assert.ok(types.includes('PaymentSubmitted'));
    assert.ok(types.includes('PaymentSettled'));
    assert.equal(types.some((type) => type === 'BeneficiaryCreated' && runtime.events.list().some((event) => {
      return event.eventType === 'BeneficiaryCreated' && 'coordinateRef' in event.payload === false;
    })), true);

    const replay = payments.initiatePayment(
      payIntent(world, 'e2e', beneficiary.value.beneficiaryId, quote.value.quoteId),
    );
    assert.equal(replay.outcome, 'OK');
    if (replay.outcome === 'OK') {
      assert.equal(replay.replay, true);
      assert.equal(replay.value.paymentId, payment.value.paymentId);
    }
    assert.equal(
      runtime.events.list().filter((event) => event.eventType === 'PaymentSettled').length,
      1,
    );
  });
});
