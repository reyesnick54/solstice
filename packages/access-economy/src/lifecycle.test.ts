import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCESS_ENTITLEMENT_TRANSITIONS,
  ACCESS_INTENT_TRANSITIONS,
  ACCESS_QUOTE_TRANSITIONS,
  ACCESS_RIGHT_TRANSITIONS,
  ALLOCATION_DECISION_TRANSITIONS,
  ALLOCATION_POLICY_TRANSITIONS,
  CAPACITY_OFFER_TRANSITIONS,
  CAPACITY_RESERVATION_TRANSITIONS,
  DELIVERY_CLAIM_TRANSITIONS,
  EXPERIENCE_BUNDLE_TRANSITIONS,
  PERSONAL_ACCESS_ENVELOPE_TRANSITIONS,
  USAGE_EVENT_TRANSITIONS,
  USAGE_PROOF_TRANSITIONS,
  canTransitionAccessEntitlement,
  canTransitionAccessQuote,
  canTransitionAccessRight,
  canTransitionAllocationDecision,
  canTransitionAllocationPolicy,
  canTransitionCapacityOffer,
  canTransitionDeliveryClaim,
  canTransitionExperienceBundle,
  canTransitionPersonalAccessEnvelope,
  canTransitionUsageEvent,
  canTransitionUsageProof,
} from './lifecycle.ts';
import {
  ACCESS_ENTITLEMENT_STATES,
  ACCESS_INTENT_STATES,
  ACCESS_QUOTE_STATES,
  ACCESS_RIGHT_STATES,
  ALLOCATION_DECISION_STATES,
  ALLOCATION_POLICY_STATES,
  CAPACITY_OFFER_STATES,
  CAPACITY_RESERVATION_STATES,
  DELIVERY_CLAIM_STATES,
  EXPERIENCE_BUNDLE_STATES,
  PERSONAL_ACCESS_ENVELOPE_STATES,
  USAGE_EVENT_STATES,
  USAGE_PROOF_STATES,
} from './taxonomy.ts';

function assertTransitionMapCoversStates<T extends string>(
  states: readonly T[],
  transitions: Readonly<Record<T, readonly T[]>>,
): void {
  for (const state of states) {
    assert.ok(Object.hasOwn(transitions, state), `missing transition map for ${state}`);
    for (const target of transitions[state]) {
      assert.ok(states.includes(target), `${state} -> ${target} references unknown state`);
    }
  }
}

describe('access economy lifecycle maps', () => {
  it('defines transition maps for every lifecycle state', () => {
    assertTransitionMapCoversStates(ACCESS_INTENT_STATES, ACCESS_INTENT_TRANSITIONS);
    assertTransitionMapCoversStates(ACCESS_RIGHT_STATES, ACCESS_RIGHT_TRANSITIONS);
    assertTransitionMapCoversStates(ACCESS_ENTITLEMENT_STATES, ACCESS_ENTITLEMENT_TRANSITIONS);
    assertTransitionMapCoversStates(PERSONAL_ACCESS_ENVELOPE_STATES, PERSONAL_ACCESS_ENVELOPE_TRANSITIONS);
    assertTransitionMapCoversStates(CAPACITY_OFFER_STATES, CAPACITY_OFFER_TRANSITIONS);
    assertTransitionMapCoversStates(CAPACITY_RESERVATION_STATES, CAPACITY_RESERVATION_TRANSITIONS);
    assertTransitionMapCoversStates(ACCESS_QUOTE_STATES, ACCESS_QUOTE_TRANSITIONS);
    assertTransitionMapCoversStates(ALLOCATION_POLICY_STATES, ALLOCATION_POLICY_TRANSITIONS);
    assertTransitionMapCoversStates(ALLOCATION_DECISION_STATES, ALLOCATION_DECISION_TRANSITIONS);
    assertTransitionMapCoversStates(EXPERIENCE_BUNDLE_STATES, EXPERIENCE_BUNDLE_TRANSITIONS);
    assertTransitionMapCoversStates(USAGE_EVENT_STATES, USAGE_EVENT_TRANSITIONS);
    assertTransitionMapCoversStates(USAGE_PROOF_STATES, USAGE_PROOF_TRANSITIONS);
    assertTransitionMapCoversStates(DELIVERY_CLAIM_STATES, DELIVERY_CLAIM_TRANSITIONS);
  });

  it('keeps non-terminal states reachable and terminal states closed', () => {
    assert.equal(canTransitionAccessRight('PROPOSED', 'ACTIVE'), true);
    assert.equal(canTransitionAccessEntitlement('PENDING', 'ACTIVE'), true);
    assert.equal(canTransitionPersonalAccessEnvelope('OPEN', 'SEALED'), true);
    assert.equal(canTransitionCapacityOffer('DRAFT', 'PUBLISHED'), true);
    assert.equal(canTransitionAccessQuote('DRAFT', 'ISSUED'), true);
    assert.equal(canTransitionAllocationPolicy('DRAFT', 'ACTIVE'), true);
    assert.equal(canTransitionAllocationDecision('PENDING', 'GRANTED'), true);
    assert.equal(canTransitionExperienceBundle('DRAFT', 'ACTIVE'), true);
    assert.equal(canTransitionUsageEvent('RECORDED', 'ATTESTED'), true);
    assert.equal(canTransitionUsageProof('PROPOSED', 'VERIFIED'), true);
    assert.equal(canTransitionDeliveryClaim('SUBMITTED', 'ACKNOWLEDGED'), true);

    assert.equal(canTransitionAccessRight('REVOKED', 'ACTIVE'), false);
    assert.equal(canTransitionAccessQuote('EXPIRED', 'ACCEPTED'), false);
    assert.equal(canTransitionUsageProof('VERIFIED', 'PROPOSED'), false);
    assert.equal(canTransitionDeliveryClaim('FULFILLED', 'DISPUTED'), false);
  });
});
