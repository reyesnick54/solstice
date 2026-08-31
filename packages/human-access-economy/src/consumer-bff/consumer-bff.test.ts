import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxAccessEconomy } from '../service.ts';
import { createAccessConsumerBffSurface } from './surface.ts';
import type { AccessActor } from '../access.ts';
import { mapReconciliationRequiredStatus } from './state-mapping.ts';

const CUSTOMER = 'cust_sandbox_basic';

function actor(verified = true, restricted = false): AccessActor {
  return Object.freeze({
    actorId: 'actor_sandbox',
    customerId: CUSTOMER,
    verified,
    restricted,
  });
}

describe('Access Consumer BFF Prompt 38 surface', () => {
  const product = createSandboxAccessEconomy(CUSTOMER);
  const surface = createAccessConsumerBffSurface(product);

  it('dashboard overview exposes categories and simulation posture', () => {
    const outcome = surface.dashboard(actor());
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.value.schema, 'sunrey.consumer.access.dashboard.v1');
    assert.equal(outcome.value.overallStatus, 'SIMULATED');
    assert.ok(outcome.value.categories.length > 0);
    assert.doesNotMatch(JSON.stringify(outcome.value), /treasury/i);
  });

  it('filters entitlements by category', () => {
    const outcome = surface.listEntitlements(actor(), { category: 'FOOD', status: 'ACTIVE' });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.ok(outcome.value.items.every((row) => row.category === 'FOOD'));
  });

  it('rejects cross-customer entitlement detail', () => {
    const listed = surface.listEntitlements(actor());
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    const entitlementId = listed.value.items[0]!.entitlementId;
    const other = surface.entitlementDetail(
      Object.freeze({ actorId: 'a', customerId: 'other', verified: true, restricted: false }),
      entitlementId,
    );
    assert.equal(other.ok, false);
  });

  it('search returns opportunities without internal provider ids', () => {
    const outcome = surface.search(actor(), { category: 'MOBILITY', query: 'Mustang', location: 'Miami, FL' });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.ok(outcome.value.items.length > 0);
    assert.doesNotMatch(JSON.stringify(outcome.value), /"providerId"/);
  });

  it('quote returns firm price split and deposit warning', () => {
    const search = surface.search(actor(), { category: 'MOBILITY', query: 'Mustang', location: 'Miami, FL' });
    assert.equal(search.ok, true);
    if (!search.ok) return;
    const opportunityId = search.value.items[0]!.opportunityId;
    const quote = surface.createCheckoutQuote(actor(), {
      opportunityId,
      requestedUnits: 1,
      idempotencyKey: 'unit-quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.priceKind, 'FIRM');
    assert.ok(quote.value.depositWarning);
    assert.equal(quote.value.depositWarning!.accessCovered, false);
    assert.ok(BigInt(quote.value.breakdown.accessCoverageAmountMinorUnits) >= 0n);
  });

  it('reserve and confirm are idempotent and produce booking', () => {
    const search = surface.search(actor(), { category: 'MOBILITY', query: 'Mustang', location: 'Miami, FL' });
    assert.equal(search.ok, true);
    if (!search.ok) return;
    const opportunityId = search.value.items[0]!.opportunityId;
    const quote = surface.createCheckoutQuote(actor(), {
      opportunityId,
      requestedUnits: 1,
      idempotencyKey: 'unit-reserve-quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    const reserve = surface.reserve(actor(), {
      checkoutQuoteId: quote.value.checkoutQuoteId,
      paymentMethodId: 'pm_sim',
      idempotencyKey: 'unit-reserve',
    });
    assert.equal(reserve.ok, true);
    if (!reserve.ok) return;
    const txnId = reserve.value.transactionId;
    const confirm1 = surface.confirmTransaction(actor(), txnId, {
      userApproved: true,
      idempotencyKey: 'unit-confirm',
    });
    const confirm2 = surface.confirmTransaction(actor(), txnId, {
      userApproved: true,
      idempotencyKey: 'unit-confirm',
    });
    assert.equal(confirm1.ok, true);
    assert.equal(confirm2.ok, true);
    if (!confirm1.ok || !confirm2.ok) return;
    assert.equal(confirm1.value.transactionId, confirm2.value.transactionId);
    assert.ok(confirm1.value.bookingId);
    const booking = surface.getBooking(actor(), confirm1.value.bookingId!);
    assert.equal(booking.ok, true);
    if (!booking.ok) return;
    assert.doesNotMatch(JSON.stringify(booking.value), /credential/i);
  });

  it('cancel exposes refund pending without inventing timing', () => {
    const search = surface.search(actor(), { category: 'MOBILITY', query: 'Mustang', location: 'Miami, FL' });
    if (!search.ok) return;
    const quote = surface.createCheckoutQuote(actor(), {
      opportunityId: search.value.items[0]!.opportunityId,
      requestedUnits: 1,
      idempotencyKey: 'unit-cancel-quote',
    });
    if (!quote.ok) return;
    const reserve = surface.reserve(actor(), {
      checkoutQuoteId: quote.value.checkoutQuoteId,
      idempotencyKey: 'unit-cancel-reserve',
    });
    if (!reserve.ok) return;
    surface.confirmTransaction(actor(), reserve.value.transactionId, {
      userApproved: true,
      idempotencyKey: 'unit-cancel-confirm',
    });
    const cancelled = surface.cancelTransaction(actor(), reserve.value.transactionId, 'unit-cancel');
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) return;
    assert.equal(cancelled.value.status, 'REFUND_PENDING');
    assert.equal(cancelled.value.refund?.expectedTiming, null);
  });

  it('allocation explanation stays user-safe', () => {
    const outcome = surface.allocationExplanation(actor());
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.match(outcome.value.summary, /SunRey and MoonRey participation/);
    assert.doesNotMatch(JSON.stringify(outcome.value), /network-wide/i);
  });

  it('maps reconciliation-required to processing confirmation', () => {
    assert.equal(mapReconciliationRequiredStatus(), 'PROCESSING_CONFIRMATION');
  });

  it('home summary highlights entitlements', () => {
    const outcome = surface.homeSummary(actor());
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.value.accessEnabled, true);
    assert.ok(outcome.value.categoryHighlights.length >= 1);
  });
});
