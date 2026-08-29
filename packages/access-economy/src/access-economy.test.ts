import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fixtureAccessIntent,
  fixtureAccessRight,
  fixtureCapacityReservation,
  fixtureCapacityWindow,
  fixtureConcertBasis,
  fixtureDeliveryClaim,
  fixtureEnergyBasis,
  fixtureFactoryBasis,
  fixtureFoodBasis,
  fixtureGpuBasis,
  fixtureHotelBasis,
  fixtureMustangAccessBasis,
  fixtureRobotBasis,
  fixtureUsageEvent,
} from './fixtures.ts';
import {
  assertNoForbiddenFields,
  buildAccessBasis,
  transitionAccessIntent,
  transitionCapacityReservation,
  validateAccessBasis,
  validateAccessIntent,
  validateAccessRight,
  validateCapacityReservation,
  validateCapacityWindow,
  validateDeliveryClaim,
  validateUsageEvent,
} from './invariants.ts';
import {
  canTransitionAccessIntent,
  canTransitionCapacityReservation,
  isTerminalAccessIntentState,
  isTerminalCapacityReservationState,
} from './lifecycle.ts';

describe('access economy domain validation', () => {
  it('validates representative access rights and intents without pricing fields', () => {
    assert.equal(validateAccessRight(fixtureAccessRight()), null);
    assert.equal(validateAccessIntent(fixtureAccessIntent()), null);
    assert.equal(validateCapacityReservation(fixtureCapacityReservation()), null);
    assert.equal(validateCapacityWindow(fixtureCapacityWindow()), null);
    assert.equal(validateUsageEvent(fixtureUsageEvent()), null);
    assert.equal(validateDeliveryClaim(fixtureDeliveryClaim()), null);
  });

  it('rejects empty access basis', () => {
    const failure = validateAccessBasis(buildAccessBasis([]));
    assert.equal(failure?.code, 'ACCESS_BASIS_REQUIRED');
  });

  it('rejects forbidden personal data and pricing fields', () => {
    const failure = assertNoForbiddenFields({
      email: 'person@example.com',
      price: 100,
    });
    assert.equal(failure?.code, 'RAW_PERSONAL_DATA_FORBIDDEN');
  });

  it('rejects political benefit policy fields', () => {
    const failure = assertNoForbiddenFields({
      politicalBenefitPolicy: { tier: 'ESSENTIAL' },
    });
    assert.equal(failure?.code, 'POLITICAL_BENEFIT_POLICY_FORBIDDEN');
  });

  it('models example domains through composable basis terms', () => {
    const examples = [
      ['mustang-14-days', fixtureMustangAccessBasis()],
      ['hotel-7-nights', fixtureHotelBasis()],
      ['weekly-food-allocation', fixtureFoodBasis()],
      ['energy-250-kwh', fixtureEnergyBasis()],
      ['gpu-100-hours', fixtureGpuBasis()],
      ['robot-8-hours', fixtureRobotBasis()],
      ['factory-capacity', fixtureFactoryBasis()],
      ['concert-admission', fixtureConcertBasis()],
    ] as const;

    for (const [label, basis] of examples) {
      assert.equal(validateAccessBasis(basis), null, label);
      assert.ok(basis.terms.length > 0, label);
    }
  });
});

describe('access intent lifecycle', () => {
  it('supports DRAFT -> PROPOSED -> AUTHORIZED -> FULFILLED', () => {
    let intent = fixtureAccessIntent({ state: 'DRAFT' });
    intent = transitionAccessIntent(intent, 'PROPOSED') as typeof intent;
    intent = transitionAccessIntent(intent, 'AUTHORIZED') as typeof intent;
    intent = transitionAccessIntent(intent, 'FULFILLED') as typeof intent;
    assert.equal(intent.state, 'FULFILLED');
    assert.equal(isTerminalAccessIntentState(intent.state), true);
  });

  it('supports rejection, cancellation, and expiry', () => {
    assert.equal(canTransitionAccessIntent('PROPOSED', 'REJECTED'), true);
    assert.equal(canTransitionAccessIntent('DRAFT', 'CANCELLED'), true);
    assert.equal(canTransitionAccessIntent('PROPOSED', 'EXPIRED'), true);
    assert.equal(canTransitionAccessIntent('FULFILLED', 'AUTHORIZED'), false);
  });

  it('blocks transitions from terminal states', () => {
    const terminal = fixtureAccessIntent({ state: 'REJECTED' });
    const failure = transitionAccessIntent(terminal, 'AUTHORIZED');
    assert.equal('code' in failure && failure.code, 'ALREADY_TERMINAL');
  });
});

describe('capacity reservation lifecycle', () => {
  it('supports REQUESTED -> HELD -> CONFIRMED -> ACTIVE -> COMPLETED', () => {
    let reservation = fixtureCapacityReservation({ state: 'REQUESTED' });
    reservation = transitionCapacityReservation(reservation, 'HELD') as typeof reservation;
    reservation = transitionCapacityReservation(reservation, 'CONFIRMED') as typeof reservation;
    reservation = transitionCapacityReservation(reservation, 'ACTIVE') as typeof reservation;
    reservation = transitionCapacityReservation(reservation, 'COMPLETED') as typeof reservation;
    assert.equal(reservation.state, 'COMPLETED');
    assert.equal(isTerminalCapacityReservationState(reservation.state), true);
  });

  it('supports cancelled, expired, failed, and disputed paths', () => {
    assert.equal(canTransitionCapacityReservation('REQUESTED', 'CANCELLED'), true);
    assert.equal(canTransitionCapacityReservation('HELD', 'EXPIRED'), true);
    assert.equal(canTransitionCapacityReservation('CONFIRMED', 'FAILED'), true);
    assert.equal(canTransitionCapacityReservation('ACTIVE', 'DISPUTED'), true);
    assert.equal(canTransitionCapacityReservation('DISPUTED', 'COMPLETED'), true);
    assert.equal(canTransitionCapacityReservation('COMPLETED', 'ACTIVE'), false);
  });

  it('blocks transitions from terminal states', () => {
    const terminal = fixtureCapacityReservation({ state: 'FAILED' });
    const failure = transitionCapacityReservation(terminal, 'ACTIVE');
    assert.equal('code' in failure && failure.code, 'ALREADY_TERMINAL');
  });
});
