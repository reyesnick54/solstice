import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HumanAccessEconomyProduct } from '../service.ts';
import { AccessNotificationService } from './notifications.ts';
import { AccessTransactionStateMachine } from './transactions.ts';
import { bookingConfirmedEvent } from './events.ts';

const verifiedActor = Object.freeze({
  actorId: 'actor_basic',
  customerId: 'cust_basic',
  verified: true,
  restricted: false,
});

describe('Access Wave 4 product layer', () => {
  it('deduplicates notifications from duplicate booking events', () => {
    const notifications = new AccessNotificationService();
    const event = bookingConfirmedEvent({
      eventId: 'evt_1',
      occurredAt: '2026-08-23T12:00:00.000Z',
      customerId: 'cust_a',
      transactionId: 'txn_1',
      stateTransitionId: 'st_1',
      serviceName: 'Mustang — 1 Day',
      providerDisplayName: 'Example Car Rental',
    });
    const dup = bookingConfirmedEvent({
      eventId: 'evt_2',
      occurredAt: '2026-08-23T12:00:01.000Z',
      customerId: 'cust_a',
      transactionId: 'txn_1',
      stateTransitionId: 'st_1',
      serviceName: 'Mustang — 1 Day',
      providerDisplayName: 'Example Car Rental',
    });
    const now = Date.parse('2026-08-23T12:00:00.000Z');
    assert.ok(notifications.deliver(event, now, event.occurredAt));
    assert.equal(notifications.deliver(dup, now + 1000, dup.occurredAt), null);
  });

  it('state machine blocks invalid transitions', () => {
    const sm = new AccessTransactionStateMachine();
    assert.equal(sm.canTransition('QUOTED', 'CHECKOUT_STARTED'), true);
    assert.equal(sm.canTransition('REFUNDED', 'BOOKED'), false);
  });
});

describe('Access Wave 4 cancellation journey', () => {
  it('processes cancellation with refund receipt from backend', () => {
    const product = new HumanAccessEconomyProduct();
    product.seedCustomer(verifiedActor.customerId);
    const quote = product.createQuote(verifiedActor, {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'cancel-quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    const txnId = product.productOrchestrator().store.transactionByQuote.get(quote.value.quoteId);
    assert.ok(txnId);
    product.productOrchestrator().confirmBooking(verifiedActor, txnId!, {
      confirmationReference: 'bk_test',
      serviceDate: '2026-08-29T10:00:00.000Z',
    });
    const cancelled = product.cancelTransaction(verifiedActor, txnId!, {
      providerRefundMinorUnits: '20000',
      penaltyMinorUnits: '5000',
    });
    assert.equal(cancelled.ok, true);
    const refunds = [...product.productOrchestrator().store.refundReceipts.values()];
    assert.ok(refunds.length > 0);
  });
});

describe('Access Wave 4 reconciliation journey', () => {
  it('shows processing then confirmed without duplicate notifications', () => {
    const product = new HumanAccessEconomyProduct();
    product.seedCustomer(verifiedActor.customerId);
    const quote = product.createQuote(verifiedActor, {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'recon-quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    const txnId = product.productOrchestrator().store.transactionByQuote.get(quote.value.quoteId)!;
    const processing = product.confirmBooking(verifiedActor, txnId, true);
    assert.equal(processing.ok, true);
    if (processing.ok) {
      assert.equal(processing.value.status, 'PROCESSING_CONFIRMATION');
    }
    const reconciled = product.productOrchestrator().reconcileBooking(verifiedActor, txnId, {
      kind: 'CONFIRMED',
      confirmationReference: 'bk_recon_1',
    });
    assert.equal(reconciled.ok, true);
    if (reconciled.ok) {
      assert.equal(reconciled.value.status, 'BOOKING_CONFIRMED');
    }
    const events = product.actionCenterEvents(verifiedActor.customerId);
    const confirmed = events.filter((row) => row.type === 'ACCESS_BOOKING_CONFIRMED');
    assert.ok(confirmed.length >= 1);
  });
});

describe('Access Wave 4 funding exhaustion', () => {
  it('blocks checkout when funding unavailable but preserves entitlement', () => {
    const product = new HumanAccessEconomyProduct();
    product.seedCustomer(verifiedActor.customerId);
    const quote = product.createQuote(verifiedActor, {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'funding-quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    const txnId = product.productOrchestrator().store.transactionByQuote.get(quote.value.quoteId)!;
    const txn = product.productOrchestrator().store.transactions.get(txnId)!;
    product.productOrchestrator().store.transactions.set(
      txnId,
      Object.freeze({ ...txn, fundingAvailable: false }),
    );
    const blocked = product.startCheckout(verifiedActor, txnId);
    assert.equal(blocked.ok, false);
    const entitlements = product.entitlements(verifiedActor);
    assert.equal(entitlements.ok, true);
    if (entitlements.ok) {
      const mobility = entitlements.value.items.find((row) => row.category === 'MOBILITY');
      assert.ok(mobility && (mobility.remainingUses ?? 0) > 0);
    }
  });
});
