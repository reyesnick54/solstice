import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HumanAccessEconomyProduct } from './service.ts';
import { FIXTURE_JAPAN_EXPERIENCE_USD, FIXTURE_MUSTANG_DAILY_USD } from './fixtures.ts';

const verifiedActor = Object.freeze({
  actorId: 'actor_basic',
  customerId: 'cust_basic',
  verified: true,
  restricted: false,
});

const pendingActor = Object.freeze({
  actorId: 'actor_pending',
  customerId: 'cust_pending',
  verified: false,
  restricted: false,
});

describe('Human Access Economy product', () => {
  it('seeds a food entitlement and blocks unverified customers', () => {
    const product = new HumanAccessEconomyProduct();
    product.seedCustomer(verifiedActor.customerId);
    const entitlements = product.entitlements(verifiedActor);
    assert.equal(entitlements.ok, true);
    if (!entitlements.ok) {
      return;
    }
    const food = entitlements.value.items.find((row) => row.category === 'FOOD');
    assert.ok(food);
    assert.equal(food.status, 'ACTIVE');
    assert.equal(food.simulationFixture, true);

    const denied = product.overview(pendingActor);
    assert.equal(denied.ok, true);
    if (denied.ok) {
      assert.equal(denied.value.capability.enabled, false);
    }
  });

  it('supports Mustang in Miami reservation flow with fixture pricing only', () => {
    const product = new HumanAccessEconomyProduct();
    product.seedCustomer(verifiedActor.customerId);
    const intent = product.createIntent(verifiedActor, {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'mustang-intent',
    });
    assert.equal(intent.ok, true);
    const availability = product.checkAvailability(verifiedActor, {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      intentId: intent.ok ? intent.value.intentId : undefined,
    });
    assert.equal(availability.ok, true);
    if (availability.ok) {
      assert.equal(availability.value.state, 'AVAILABLE_SIMULATION');
      assert.equal(availability.value.capacityKnown, false);
    }
    const quote = product.createQuote(verifiedActor, {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      intentId: intent.ok ? intent.value.intentId : undefined,
      idempotencyKey: 'mustang-quote',
    });
    assert.equal(quote.ok, true);
    if (quote.ok) {
      assert.deepEqual(quote.value.pricing, FIXTURE_MUSTANG_DAILY_USD);
    }
    const reservation = product.createReservation(verifiedActor, {
      quoteId: quote.ok ? quote.value.quoteId : '',
      idempotencyKey: 'mustang-reservation',
    });
    assert.equal(reservation.ok, true);
    const confirmed = product.confirmReservation(
      verifiedActor,
      reservation.ok ? reservation.value.reservationId : '',
    );
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) {
      assert.equal(confirmed.value.status, 'CONFIRMED');
    }
  });

  it('quotes and confirms a Japan 14-day experience fixture', () => {
    const product = new HumanAccessEconomyProduct();
    product.seedCustomer(verifiedActor.customerId);
    const quoted = product.quoteExperience(verifiedActor, {
      destination: 'Japan',
      durationDays: 14,
      idempotencyKey: 'japan-exp',
    });
    assert.equal(quoted.ok, true);
    if (quoted.ok) {
      assert.equal(quoted.value.durationDays, 14);
      assert.deepEqual(quoted.value.pricing, FIXTURE_JAPAN_EXPERIENCE_USD);
    }
    const confirmed = product.confirmExperience(
      verifiedActor,
      quoted.ok ? quoted.value.experienceId : '',
    );
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) {
      assert.equal(confirmed.value.status, 'CONFIRMED');
      assert.equal(confirmed.value.startsAt, '2026-09-01T00:00:00.000Z');
    }
  });

  it('preserves preview posture flags on overview', () => {
    const product = new HumanAccessEconomyProduct();
    product.seedCustomer(verifiedActor.customerId);
    const overview = product.overview(verifiedActor);
    assert.equal(overview.ok, true);
    if (overview.ok) {
      assert.equal(overview.value.productionReady, false);
      assert.equal(overview.value.productionActive, false);
      assert.equal(overview.value.liveConnectivityEnabled, false);
    }
  });
});
