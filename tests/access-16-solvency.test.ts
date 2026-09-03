/**
 * ACCESS-16 cross-package integration — consumer BFF solvency posture.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxAccessEconomy } from '../packages/human-access-economy/src/service.ts';
import { ACCESS_SOLVENCY_INVARIANT_IDS } from '../packages/access-economy/src/solvency/index.ts';

describe('ACCESS-16 consumer BFF solvency integration', () => {
  it('exposes consumer posture without treasury detail', () => {
    const product = createSandboxAccessEconomy('cust_access16');
    const actor = Object.freeze({
      actorId: 'actor_access16',
      customerId: 'cust_access16',
      verified: true,
      restricted: false,
    });
    const availability = product.checkAvailability(actor, {
      category: 'MOBILITY',
      summary: 'Ford Mustang Miami',
      location: 'Miami, FL',
    });
    assert.equal(availability.ok, true);
    if (!availability.ok) {
      return;
    }
    assert.ok(['AVAILABLE', 'LIMITED', 'TEMPORARILY_UNAVAILABLE'].includes(availability.value.consumerPosture));
    assert.equal(availability.value.consumerPostureMessage.includes('reserve'), false);
    assert.equal(availability.value.consumerPostureMessage.includes('solvency'), false);
    const serialized = JSON.stringify(availability.value);
    assert.equal(serialized.includes('minorUnits'), false);
    assert.equal(serialized.includes('SettlementReserve'), false);
  });

  it('declares all ACCESS-16 invariant ids for architecture closure', () => {
    assert.equal(ACCESS_SOLVENCY_INVARIANT_IDS.length, 10);
  });
});
