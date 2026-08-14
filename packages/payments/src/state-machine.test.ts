import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../domain/src/account.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { isErr, isOk } from '../../domain/src/result.ts';
import { Money } from '../../money/src/money.ts';
import { asBeneficiaryId, asCorridorId, asPaymentId, asQuoteId } from './ids.ts';
import { ALLOWED_TRANSITIONS, freezePayment, transitionPayment, type PaymentStatus } from './payment.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function payment(status: PaymentStatus) {
  return freezePayment({
    paymentId: asPaymentId('pay_sm'),
    customerId: asCustomerId('cust'),
    sourceAccountId: asAccountId('acct'),
    beneficiaryId: asBeneficiaryId('ben'),
    sourceCurrency: asCurrencyCode('USD'),
    destinationCurrency: asCurrencyCode('SAR'),
    sourceAmount: Money.fromMinorUnits(100_000n, 'USD'),
    quotedDestinationAmount: Money.fromMinorUnits(374_500n, 'SAR'),
    fee: Money.fromMinorUnits(1_500n, 'USD'),
    amountDebited: Money.fromMinorUnits(101_500n, 'USD'),
    quoteId: asQuoteId('q'),
    purposeReference: 'test',
    corridorId: asCorridorId('US-SA-USD-SAR'),
    routeId: null,
    holdId: null,
    settlementRef: null,
    status,
    idempotencyKey: 'k',
    createdAt: NOW,
    updatedAt: NOW,
    journalIds: [],
    evidenceIds: [],
  });
}

describe('payment state machine', () => {
  it('allows READY -> FUNDS_RESERVED -> SUBMITTED -> SETTLED', () => {
    const reserved = transitionPayment(payment('READY'), 'FUNDS_RESERVED', NOW);
    assert.equal(isOk(reserved), true);
    if (!isOk(reserved)) {
      return;
    }
    const submitted = transitionPayment(reserved.value, 'SUBMITTED', NOW);
    assert.equal(isOk(submitted), true);
    if (!isOk(submitted)) {
      return;
    }
    const settled = transitionPayment(submitted.value, 'SETTLED', NOW);
    assert.equal(isOk(settled), true);
  });

  it('rejects SETTLED -> CANCELLED with a typed error', () => {
    const result = transitionPayment(payment('SETTLED'), 'CANCELLED', NOW);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'ILLEGAL_PAYMENT_TRANSITION');
      assert.equal(result.error.from, 'SETTLED');
      assert.equal(result.error.to, 'CANCELLED');
    }
  });

  it('does not allow transitions out of FAILED or RETURNED', () => {
    assert.deepEqual(ALLOWED_TRANSITIONS.FAILED, []);
    assert.deepEqual(ALLOWED_TRANSITIONS.RETURNED, []);
    assert.equal(isErr(transitionPayment(payment('FAILED'), 'SETTLED', NOW)), true);
    assert.equal(isErr(transitionPayment(payment('RETURNED'), 'SETTLED', NOW)), true);
  });
});
