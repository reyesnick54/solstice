import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { Money } from '../packages/money/src/money.ts';
import { asPaymentId } from '../packages/payments/src/ids.ts';
import { CALLBACK_SCHEMA_VERSION, hashCallbackBody } from '../packages/payments/src/rail-webhook.ts';
import {
  acceptIntent,
  beneficiaryIntent,
  createPaymentWorld,
  payIntent,
  quoteIntent,
} from './payment-world.ts';

describe('Chunk 10 exit criterion', () => {
  it('sends a US→SA payment through the canonical rail adapter to MATCHED settlement', () => {
    const world = createPaymentWorld('rail_e2e');
    const { runtime, payments } = world;

    const beneficiary = payments.createBeneficiary(beneficiaryIntent(world, 'rail_e2e'));
    assert.equal(beneficiary.outcome, 'OK');
    if (beneficiary.outcome !== 'OK') {
      return;
    }
    const quote = payments.createQuote(quoteIntent(world, 'rail_e2e'));
    assert.equal(quote.outcome, 'OK');
    if (quote.outcome !== 'OK') {
      return;
    }
    const accepted = payments.acceptQuote(acceptIntent(world, 'rail_e2e', quote.value.quoteId));
    assert.equal(accepted.outcome, 'OK');

    const payment = payments.initiatePayment(
      payIntent(world, 'rail_e2e', beneficiary.value.beneficiaryId, quote.value.quoteId),
    );
    assert.equal(payment.outcome, 'OK');
    if (payment.outcome !== 'OK') {
      return;
    }
    assert.equal(payment.value.status, 'SETTLED');
    assert.equal(payment.value.routeId, 'sim-gcc-usd-sar');

    const submission = payments.railNetwork.store.getByPayment(payment.value.paymentId);
    assert.ok(submission);
    assert.equal(submission?.rail, 'INTERNATIONAL_CORRESPONDENT');
    assert.equal(submission?.provider, 'SIMULATED_PROVIDER_GCC');

    const recon = payments.getStore().getReconciliation(payment.value.paymentId);
    assert.equal(recon?.status, 'MATCHED');
    const railRecon = payments.reconcileAgainstRail(payment.value.paymentId, {
      paymentId: payment.value.paymentId,
      settlementRef: payment.value.settlementRef ?? '',
      destinationAmountMinorUnits: payment.value.quotedDestinationAmount.minorUnits.toString(),
      destinationCurrency: payment.value.destinationCurrency,
      sourceAmountMinorUnits: payment.value.sourceAmount.minorUnits.toString(),
      sourceCurrency: payment.value.sourceCurrency,
    });
    assert.equal(railRecon.status, 'MATCHED');

    const reports = payments.railNetwork.store.listReports();
    assert.ok(reports.some((row) => row.payments.some((line) => line.paymentId === payment.value.paymentId)));

    const chain = runtime.evidence.verifyChain();
    assert.equal(chain.ok, true);
    const types = runtime.events.list().map((event) => event.eventType);
    assert.ok(types.includes('RailSubmissionCreated'));
    assert.ok(types.includes('RailPaymentSettled'));
    assert.ok(types.includes('PaymentSettled'));

    const callback = payments.signProviderCallback({
      provider: 'SIMULATED_PROVIDER_GCC',
      timestamp: world.clock.now(),
      schemaVersion: CALLBACK_SCHEMA_VERSION,
      providerEventId: 'evt_dup_settle',
      paymentId: payment.value.paymentId,
      railSubmissionId: submission!.railSubmissionId,
      providerStatus: 'SETTLED',
      payloadHash: hashCallbackBody('settled'),
    });
    const first = payments.applyProviderCallback(callback);
    const second = payments.applyProviderCallback(callback);
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    if (second.outcome === 'OK') {
      assert.equal(second.replay, true);
    }
    assert.equal(
      runtime.events.list().filter((event) => event.eventType === 'PaymentSettled').length,
      1,
    );

    for (const journal of runtime.ledger.listJournals()) {
      const currencies = new Set(journal.postings.map((row) => row.amount.currency));
      assert.equal(currencies.size, 1);
      let debits = 0n;
      let credits = 0n;
      for (const posting of journal.postings) {
        if (posting.direction === 'DEBIT') {
          debits += posting.amount.minorUnits;
        } else {
          credits += posting.amount.minorUnits;
        }
      }
      assert.equal(debits, credits);
    }
  });

  it('covers provider failure, unknown submission, webhook, return, and inbound paths', () => {
    function prepare(suffix: string, deposit = 200_000n) {
      const world = createPaymentWorld(suffix, deposit);
      const beneficiary = world.payments.createBeneficiary(beneficiaryIntent(world, suffix));
      const quote = world.payments.createQuote(quoteIntent(world, suffix));
      assert.equal(quote.outcome, 'OK');
      assert.equal(beneficiary.outcome, 'OK');
      if (quote.outcome !== 'OK' || beneficiary.outcome !== 'OK') {
        return null;
      }
      world.payments.acceptQuote(acceptIntent(world, suffix, quote.value.quoteId));
      return { world, beneficiary: beneficiary.value, quote: quote.value };
    }

    const unavail = prepare('unavail');
    assert.ok(unavail);
    if (!unavail) {
      return;
    }
    unavail.world.payments.railNetwork.setMode('pay_unavail', 'UNAVAILABLE');
    unavail.world.payments.railNetwork.setProviderHealth('SIMULATED_PROVIDER_GCC', 'UNAVAILABLE');
    unavail.world.payments.railNetwork.setProviderHealth('SIMULATED_PROVIDER_CORRESPONDENT', 'UNAVAILABLE');
    const unavailable = unavail.world.payments.initiatePayment(
      payIntent(unavail.world, 'unavail', unavail.beneficiary.beneficiaryId, unavail.quote.quoteId),
    );
    assert.equal(unavailable.outcome, 'REJECTED');

    const timeoutPrep = prepare('timeout');
    assert.ok(timeoutPrep);
    if (!timeoutPrep) {
      return;
    }
    timeoutPrep.world.payments.railNetwork.setMode('pay_timeout', 'TIMEOUT_BEFORE');
    const timeout = timeoutPrep.world.payments.initiatePayment(
      payIntent(timeoutPrep.world, 'timeout', timeoutPrep.beneficiary.beneficiaryId, timeoutPrep.quote.quoteId),
    );
    assert.equal(timeout.outcome, 'REJECTED');
    if (timeout.outcome === 'REJECTED') {
      assert.equal(timeout.code, 'SETTLEMENT_FAILED');
    }

    const unknownPrep = prepare('unknown');
    assert.ok(unknownPrep);
    if (!unknownPrep) {
      return;
    }
    unknownPrep.world.payments.railNetwork.setMode('pay_unknown', 'TIMEOUT_AFTER_UNKNOWN');
    const unknown = unknownPrep.world.payments.initiatePayment(
      payIntent(unknownPrep.world, 'unknown', unknownPrep.beneficiary.beneficiaryId, unknownPrep.quote.quoteId),
    );
    assert.equal(unknown.outcome, 'OK');
    if (unknown.outcome === 'OK') {
      assert.equal(unknown.value.status, 'SUBMISSION_UNKNOWN');
      const retry = unknownPrep.world.payments.retryUnknownSubmission(asPaymentId(unknown.value.paymentId));
      assert.equal(retry.outcome, 'REJECTED');
      if (retry.outcome === 'REJECTED') {
        assert.equal(retry.code, 'DO_NOT_RETRY_WITHOUT_QUERY');
      }
    }

    const rejPrep = prepare('rej');
    assert.ok(rejPrep);
    if (!rejPrep) {
      return;
    }
    rejPrep.world.payments.railNetwork.setMode('pay_rej', 'REJECT');
    const rejected = rejPrep.world.payments.initiatePayment(
      payIntent(rejPrep.world, 'rej', rejPrep.beneficiary.beneficiaryId, rejPrep.quote.quoteId),
    );
    assert.equal(rejected.outcome, 'REJECTED');

    const world = createPaymentWorld('rail_inb');

    const cancelWorld = createPaymentWorld('rail_can');
    const cancelBen = cancelWorld.payments.createBeneficiary(beneficiaryIntent(cancelWorld, 'rail_can'));
    const cancelQuote = cancelWorld.payments.createQuote(quoteIntent(cancelWorld, 'rail_can'));
    if (cancelQuote.outcome === 'OK' && cancelBen.outcome === 'OK') {
      cancelWorld.payments.acceptQuote(acceptIntent(cancelWorld, 'rail_can', cancelQuote.value.quoteId));
      cancelWorld.payments.rail.setMode?.('pay_rail_can', 'PENDING');
      const pending = cancelWorld.payments.initiatePayment(
        payIntent(cancelWorld, 'rail_can', cancelBen.value.beneficiaryId, cancelQuote.value.quoteId),
      );
      assert.equal(pending.outcome, 'OK');
      if (pending.outcome === 'OK') {
        const cancelled = cancelWorld.payments.cancelPayment({
          id: asIntentId('can_rail'),
          actionType: ACTION_TYPES.CANCEL_PAYMENT,
          idempotencyKey: 'can_rail',
          actorId: cancelWorld.actorId,
          requestedAt: cancelWorld.clock.now(),
          purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
          payload: { paymentId: pending.value.paymentId, accountId: cancelWorld.account.id },
        });
        assert.equal(cancelled.outcome, 'REJECTED');
        if (cancelled.outcome === 'REJECTED') {
          assert.equal(cancelled.code, 'CANCELLATION_NOT_SUPPORTED');
        }
      }
    }

    const settledWorld = createPaymentWorld('rail_ret');
    const settledBen = settledWorld.payments.createBeneficiary(beneficiaryIntent(settledWorld, 'rail_ret'));
    const settledQuote = settledWorld.payments.createQuote(quoteIntent(settledWorld, 'rail_ret'));
    if (settledQuote.outcome === 'OK' && settledBen.outcome === 'OK') {
      settledWorld.payments.acceptQuote(acceptIntent(settledWorld, 'rail_ret', settledQuote.value.quoteId));
      const settled = settledWorld.payments.initiatePayment(
        payIntent(settledWorld, 'rail_ret', settledBen.value.beneficiaryId, settledQuote.value.quoteId),
      );
      assert.equal(settled.outcome, 'OK');
      if (settled.outcome === 'OK') {
        const journalsBefore = settled.value.journalIds.length;
        const returned = settledWorld.payments.simulateReturn(asPaymentId(settled.value.paymentId));
        assert.equal(returned.outcome, 'OK');
        if (returned.outcome === 'OK') {
          assert.equal(returned.value.status, 'RETURNED');
          assert.ok(returned.value.journalIds.length > journalsBefore);
        }
      }
    }

    const inbound = world.payments.acceptInboundPayment({
      id: asIntentId('inb_rail'),
      actionType: ACTION_TYPES.ACCEPT_INBOUND_PAYMENT,
      idempotencyKey: 'inb_rail',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: {
        inboundId: 'inb_rail',
        accountId: world.account.id,
        amount: Money.fromMinorUnits(5_000n, 'USD'),
        provider: 'SIMULATED_PROVIDER_US_BATCH',
        rail: 'US_BATCH',
        sourceReference: 'src_in_opaque',
        destinationReference: world.account.id,
        sourceDisplayName: 'Inbound Payer',
        purposeReference: 'simulated inbound',
      },
    });
    assert.equal(inbound.outcome, 'OK');
    if (inbound.outcome === 'OK') {
      assert.equal(inbound.value.status, 'SETTLED');
      assert.ok(inbound.value.journalIds.length >= 2);
    }

    const badSig = world.payments.applyProviderCallback({
      provider: 'SIMULATED_PROVIDER_GCC',
      timestamp: world.clock.now(),
      signature: '00',
      schemaVersion: CALLBACK_SCHEMA_VERSION,
      providerEventId: 'evt_bad',
      paymentId: 'pay_missing',
      railSubmissionId: 'rsub_missing',
      providerStatus: 'SETTLED',
      payloadHash: hashCallbackBody('bad'),
    });
    assert.equal(badSig.outcome, 'REJECTED');
    if (badSig.outcome === 'REJECTED') {
      assert.equal(badSig.code, 'INVALID_SIGNATURE');
    }

    const mismatchWorld = createPaymentWorld('rail_mm');
    const mismatchBen = mismatchWorld.payments.createBeneficiary(beneficiaryIntent(mismatchWorld, 'rail_mm'));
    const mismatchQuote = mismatchWorld.payments.createQuote(quoteIntent(mismatchWorld, 'rail_mm'));
    if (mismatchQuote.outcome === 'OK' && mismatchBen.outcome === 'OK') {
      mismatchWorld.payments.acceptQuote(acceptIntent(mismatchWorld, 'rail_mm', mismatchQuote.value.quoteId));
      const settled = mismatchWorld.payments.initiatePayment(
        payIntent(mismatchWorld, 'rail_mm', mismatchBen.value.beneficiaryId, mismatchQuote.value.quoteId),
      );
      assert.equal(settled.outcome, 'OK');
      if (settled.outcome === 'OK') {
        const mismatch = mismatchWorld.payments.reconcileAgainstRail(settled.value.paymentId, {
          paymentId: settled.value.paymentId,
          settlementRef: settled.value.settlementRef ?? '',
          destinationAmountMinorUnits: '1',
          destinationCurrency: settled.value.destinationCurrency,
          sourceAmountMinorUnits: settled.value.sourceAmount.minorUnits.toString(),
          sourceCurrency: settled.value.sourceCurrency,
        });
        assert.equal(mismatch.status, 'MISMATCH');
        const missingExternal = mismatchWorld.payments.reconcileAgainstRail(settled.value.paymentId, null);
        assert.ok(missingExternal.status === 'MISSING_EXTERNAL' || missingExternal.status === 'PENDING');
        const missingInternal = mismatchWorld.payments.reconcileAgainstRail('pay_absent', {
          paymentId: 'pay_absent',
          settlementRef: 'sref_absent',
          destinationAmountMinorUnits: '1',
          destinationCurrency: 'SAR',
          sourceAmountMinorUnits: '1',
          sourceCurrency: 'USD',
        });
        assert.equal(missingInternal.status, 'MISSING_INTERNAL');
      }
    }
  });
});
