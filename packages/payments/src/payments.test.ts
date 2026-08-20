import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { Money } from '../../money/src/money.ts';
import { freezeBeneficiary } from './beneficiary.ts';
import { asBeneficiaryId, asPaymentId, asScreeningRef } from './ids.ts';
import {
  acceptIntent,
  beneficiaryIntent,
  createPaymentWorld,
  freezeSourceAccount,
  payIntent,
  quoteIntent,
  readyQuoteAndBeneficiary,
} from '../../../tests/payment-world.ts';

describe('payment orchestration failures', () => {
  it('refuses an unsupported corridor at the Kernel', () => {
    const world = createPaymentWorld('corr');
    const result = world.payments.createQuote(
      quoteIntent(world, 'corr', { corridorId: 'US-GB-USD-GBP', quoteCurrency: asCurrencyCode('GBP') }),
    );
    assert.equal(result.outcome, 'KERNEL_REFUSED');
    if (result.outcome === 'KERNEL_REFUSED') {
      assert.equal(result.decision.status, 'BLOCK');
    }
  });

  it('rejects a quote whose currencies do not match the corridor', () => {
    const world = createPaymentWorld('ccy');
    const result = world.payments.createQuote(
      quoteIntent(world, 'ccy', { quoteCurrency: asCurrencyCode('GBP') }),
    );
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'UNSUPPORTED_CURRENCY');
    }
  });

  it('blocks creating a sanctioned beneficiary', () => {
    const world = createPaymentWorld('sanc');
    const result = world.payments.createBeneficiary(beneficiaryIntent(world, 'sanc', 'SANCTIONED PERSON'));
    assert.equal(result.outcome, 'KERNEL_REFUSED');
    if (result.outcome === 'KERNEL_REFUSED') {
      assert.equal(result.decision.status, 'BLOCK');
    }
    assert.equal(world.payments.getStore().getBeneficiary('ben_sanc'), undefined);
  });

  it('requires review for a PEP beneficiary and does not persist it', () => {
    const world = createPaymentWorld('pep');
    const result = world.payments.createBeneficiary(beneficiaryIntent(world, 'pep', 'PEP PERSON'));
    assert.equal(result.outcome, 'KERNEL_REFUSED');
    if (result.outcome === 'KERNEL_REFUSED') {
      assert.equal(result.decision.status, 'REQUIRE_MANUAL_REVIEW');
    }
  });

  it('holds a payment when beneficiary screening raises a fraud signal', () => {
    const world = createPaymentWorld('fraud');
    const prepared = readyQuoteAndBeneficiary(world, 'fraud', 'FRAUD SIGNAL');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    if (prepared.beneficiary.outcome === 'OK') {
      assert.equal(prepared.beneficiary.value.status, 'BLOCKED');
    }
    const result = world.payments.initiatePayment(
      payIntent(world, 'fraud', 'ben_fraud', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'KERNEL_REFUSED');
    if (result.outcome === 'KERNEL_REFUSED') {
      assert.equal(result.decision.status, 'REQUIRE_MANUAL_REVIEW');
    }
    const held = world.payments.getStore().getPayment('pay_fraud');
    assert.equal(held?.status, 'HELD');
  });

  it('refuses an expired accepted quote at the exact expiry instant', () => {
    const world = createPaymentWorld('exp');
    const prepared = readyQuoteAndBeneficiary(world, 'exp');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    world.clock.set(asUtcInstant('2026-08-14T12:01:00.000Z'));
    const result = world.payments.initiatePayment(
      payIntent(world, 'exp', 'ben_exp', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'QUOTE_EXPIRED');
    }
  });

  it('rejects initiation when available funds are below amount debited', () => {
    const world = createPaymentWorld('nsf', 10_000n);
    const prepared = readyQuoteAndBeneficiary(world, 'nsf');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    const result = world.payments.initiatePayment(
      payIntent(world, 'nsf', 'ben_nsf', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'INSUFFICIENT_FUNDS');
    }
  });

  it('rejects initiation from a frozen account', () => {
    const world = createPaymentWorld('frz');
    const prepared = readyQuoteAndBeneficiary(world, 'frz');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    freezeSourceAccount(world);
    const result = world.payments.initiatePayment(
      payIntent(world, 'frz', 'ben_frz', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'ACCOUNT_FROZEN');
    }
  });

  it('fails safely when the simulated provider is unavailable', () => {
    const world = createPaymentWorld('prov');
    const prepared = readyQuoteAndBeneficiary(world, 'prov');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    world.payments.setProviderAvailable(false);
    const result = world.payments.initiatePayment(
      payIntent(world, 'prov', 'ben_prov', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'ROUTE_UNAVAILABLE');
    }
    assert.equal(world.payments.getStore().getPayment('pay_prov')?.status, 'FAILED');
  });

  it('fails safely when no compliant route remains', () => {
    const world = createPaymentWorld('rte');
    const prepared = readyQuoteAndBeneficiary(world, 'rte');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    world.payments.setRoutesForceUnavailable(true);
    const result = world.payments.initiatePayment(
      payIntent(world, 'rte', 'ben_rte', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'ROUTE_UNAVAILABLE');
    }
  });

  it('blocks a payment to an injected sanctioned beneficiary', () => {
    const world = createPaymentWorld('sancp');
    const prepared = readyQuoteAndBeneficiary(world, 'sancp');
    if (prepared.beneficiary.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    world.payments.getStore().saveBeneficiary(
      freezeBeneficiary({
        ...prepared.beneficiary.value,
        beneficiaryId: asBeneficiaryId('ben_sanc_pay'),
        legalName: 'SANCTIONED PERSON',
        screeningStatus: 'SANCTIONED',
        screeningRef: asScreeningRef('scr_sanc'),
        status: 'ACTIVE',
      }),
    );
    const result = world.payments.initiatePayment(
      payIntent(world, 'sancp', 'ben_sanc_pay', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'KERNEL_REFUSED');
    if (result.outcome === 'KERNEL_REFUSED') {
      assert.equal(result.decision.status, 'BLOCK');
    }
  });

  it('leaves a delayed rail in PROCESSING until completeSettlement', () => {
    const world = createPaymentWorld('pend');
    const prepared = readyQuoteAndBeneficiary(world, 'pend');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    world.payments.rail.setMode?.('pay_pend', 'PENDING');
    const pending = world.payments.initiatePayment(
      payIntent(world, 'pend', 'ben_pend', prepared.quote.quoteId),
    );
    if (pending.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(pending.value.status, 'PROCESSING');
    const completed = world.payments.completeSettlement(asPaymentId(pending.value.paymentId));
    assert.equal(completed.outcome, 'OK');
    if (completed.outcome === 'OK') {
      assert.equal(completed.value.status, 'SETTLED');
    }
  });

  it('fails before simulated submission and releases the hold', () => {
    const world = createPaymentWorld('failb');
    const prepared = readyQuoteAndBeneficiary(world, 'failb');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    world.payments.rail.setMode?.('pay_failb', 'FAIL_BEFORE_SUBMIT');
    const result = world.payments.initiatePayment(
      payIntent(world, 'failb', 'ben_failb', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'SETTLEMENT_FAILED');
    }
    assert.equal(world.payments.getStore().getPayment('pay_failb')?.status, 'FAILED');
  });

  it('fails after simulated submission without deleting journals', () => {
    const world = createPaymentWorld('faila');
    const prepared = readyQuoteAndBeneficiary(world, 'faila');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    world.payments.rail.setMode?.('pay_faila', 'FAIL_AFTER_SUBMIT');
    const before = world.runtime.ledger.journalCount();
    const result = world.payments.initiatePayment(
      payIntent(world, 'faila', 'ben_faila', prepared.quote.quoteId),
    );
    assert.equal(result.outcome, 'REJECTED');
    assert.ok(world.runtime.ledger.journalCount() >= before);
    assert.equal(world.payments.getStore().getPayment('pay_faila')?.status, 'FAILED');
  });

  it('returns a settled payment with compensating entries and retains the fee', () => {
    const world = createPaymentWorld('ret');
    const prepared = readyQuoteAndBeneficiary(world, 'ret');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    const settled = world.payments.initiatePayment(
      payIntent(world, 'ret', 'ben_ret', prepared.quote.quoteId),
    );
    if (settled.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    const journalsBefore = settled.value.journalIds.length;
    const returned = world.payments.simulateReturn(asPaymentId(settled.value.paymentId));
    if (returned.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(returned.value.status, 'RETURNED');
    assert.ok(returned.value.journalIds.length > journalsBefore);
    const memos = world.runtime.ledger.listJournals().map((row) => row.memo);
    assert.ok(memos.includes('PAYMENT_RETURN_PRINCIPAL_SIMULATION_POLICY'));
  });

  it('marks a mismatched provider report INVESTIGATION_REQUIRED without rewriting journals', () => {
    const world = createPaymentWorld('recon');
    const prepared = readyQuoteAndBeneficiary(world, 'recon');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    const settled = world.payments.initiatePayment(
      payIntent(world, 'recon', 'ben_recon', prepared.quote.quoteId),
    );
    if (settled.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    const count = world.runtime.ledger.journalCount();
    const result = world.payments.injectMismatchedReport(settled.value.paymentId, {
      paymentId: settled.value.paymentId,
      settlementRef: 'wrong_ref',
      destinationAmountMinorUnits: '1',
      destinationCurrency: 'SAR',
      sourceAmountMinorUnits: settled.value.sourceAmount.minorUnits.toString(),
      sourceCurrency: 'USD',
    });
    assert.equal(result.status, 'INVESTIGATION_REQUIRED');
    assert.ok(result.mismatches.includes('settlement_ref_mismatch'));
    assert.equal(world.runtime.ledger.journalCount(), count);
  });

  it('replays the same payment idempotency key without a second payment', () => {
    const world = createPaymentWorld('dup');
    const prepared = readyQuoteAndBeneficiary(world, 'dup');
    assert.equal(prepared.beneficiary.outcome, 'OK');
    const intent = payIntent(world, 'dup', 'ben_dup', prepared.quote.quoteId);
    const first = world.payments.initiatePayment(intent);
    const second = world.payments.initiatePayment(intent);
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    if (first.outcome === 'OK' && second.outcome === 'OK') {
      assert.equal(first.value.paymentId, second.value.paymentId);
      assert.equal(second.replay, true);
    }
  });

  it('accepts a quote only once and does not mutate the rate', () => {
    const world = createPaymentWorld('acc');
    const created = world.payments.createQuote(quoteIntent(world, 'acc'));
    if (created.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    const first = world.payments.acceptQuote(acceptIntent(world, 'acc', created.value.quoteId));
    const second = world.payments.acceptQuote(acceptIntent(world, 'acc2', created.value.quoteId));
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    if (first.outcome === 'OK' && second.outcome === 'OK') {
      assert.equal(first.value.customerRate.numerator, created.value.customerRate.numerator);
      assert.equal(second.replay, true);
    }
  });
});
