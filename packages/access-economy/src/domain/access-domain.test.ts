/**
 * ACCESS Wave 1 / Prompt 28 — canonical Access domain model tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCESS_CATEGORIES,
  ACCESS_ENTITLEMENT_NON_CASH_FLAGS,
  ACCESS_UNITS,
  accessDomainFailure,
  buildAccessCapacity,
  buildAccessSettlement,
  createAccessDomainServices,
  createAccessDomainStore,
  defaultTokenConversionContribution,
  deriveAvailableCapacityUnits,
  deriveRemainingEntitlementUnits,
  fixtureAccessAllocation,
  fixtureAccessCapacity,
  fixtureAccessCategory,
  fixtureAccessEntitlement,
  fixtureAccessProduct,
  fixtureAccessQuote,
  fixtureAccessRedemption,
  fixtureAccessReservation,
  fixtureAccessSettlement,
  fixtureAccessTransaction,
  FIXTURE_PROVIDER,
  FIXTURE_USER,
  isAccessCategoryId,
  isAccessUnit,
  validateAccessCapacity,
  validateAccessEntitlement,
  validateAccessQuote,
  validateAccessSettlement,
  validateCapacityUnits,
  validateEntitlementUnits,
} from './index.ts';

describe('ACCESS Wave 1 / Prompt 28 domain models', () => {
  it('defines governed access categories', () => {
    assert.deepEqual(ACCESS_CATEGORIES, [
      'MOBILITY',
      'LODGING',
      'EXPERIENCES',
      'FOOD',
      'AI_COMPUTE',
      'ENERGY',
      'TRANSPORTATION',
      'ROBOTICS',
      'OTHER',
    ]);
    for (const id of ACCESS_CATEGORIES) {
      const category = fixtureAccessCategory(id);
      assert.equal(category.id, id);
      assert.equal(isAccessCategoryId(id), true);
      assert.equal(category.enabled, true);
      assert.equal(isAccessUnit(category.defaultUnit), true);
    }
  });

  it('defines canonical access units', () => {
    assert.ok(ACCESS_UNITS.includes('VEHICLE_HOUR'));
    assert.ok(ACCESS_UNITS.includes('ROOM_NIGHT'));
    assert.ok(ACCESS_UNITS.includes('GPU_HOUR'));
    assert.ok(ACCESS_UNITS.includes('KWH'));
    assert.equal(isAccessUnit('MEAL'), true);
    assert.equal(isAccessUnit('UNKNOWN'), false);
  });

  it('builds access products with explicit units', () => {
    const product = fixtureAccessProduct();
    assert.equal(product.name, 'Standard Mobility Day');
    assert.equal(product.unit, 'VEHICLE_DAY');
    assert.equal(product.providerId, null);
  });

  it('enforces capacity invariants', () => {
    const capacity = fixtureAccessCapacity();
    assert.equal(validateAccessCapacity(capacity), null);
    assert.equal(capacity.availableUnits, 85n);
    assert.equal(
      deriveAvailableCapacityUnits(capacity.totalUnits, capacity.reservedUnits, capacity.consumedUnits),
      85n,
    );
    const overReserved = validateCapacityUnits(100n, 80n, 30n, 0n);
    assert.equal(overReserved?.code, 'OVER_RESERVED');
  });

  it('derives remaining entitlement units', () => {
    const entitlement = fixtureAccessEntitlement();
    assert.equal(validateAccessEntitlement(entitlement), null);
    assert.equal(entitlement.remainingUnits, 3n);
    assert.equal(deriveRemainingEntitlementUnits(5n, 1n, 1n), 3n);
  });

  it('rejects negative units', () => {
    const failure = validateEntitlementUnits(5n, -1n, 0n, 0n);
    assert.equal(failure?.code, 'NEGATIVE_UNITS');
    const capacityFailure = validateCapacityUnits(10n, -1n, 0n, 0n);
    assert.equal(capacityFailure?.code, 'NEGATIVE_UNITS');
  });

  it('rejects over-reservation and over-consumption on entitlements', () => {
    const overConsumed = validateEntitlementUnits(5n, 3n, 3n, 0n);
    assert.equal(overConsumed?.code, 'OVER_CONSUMED');
    const invalidRemaining = validateEntitlementUnits(5n, 1n, 1n, 5n);
    assert.equal(invalidRemaining?.code, 'INVALID_REMAINING_UNITS');
  });

  it('models access allocation without formula logic', () => {
    const allocation = fixtureAccessAllocation();
    assert.equal(allocation.allocatedUnits, 5n);
    assert.ok(allocation.evidenceReference.startsWith('acew1ev_'));
    assert.ok(allocation.allocationPolicyId.startsWith('aceap_'));
  });

  it('validates quote monetary fields as non-negative', () => {
    const quote = fixtureAccessQuote();
    assert.equal(validateAccessQuote(quote), null);
    const invalid = validateAccessQuote({ ...quote, providerPrice: -1n });
    assert.equal(invalid?.code, 'NEGATIVE_UNITS');
  });

  it('models reservations without provider API coupling', () => {
    const reservation = fixtureAccessReservation();
    assert.equal(reservation.status, 'ENTITLEMENT_RESERVED');
    assert.equal(reservation.providerReservationReference, null);
    assert.ok(reservation.providerId.startsWith('aceprv_'));
  });

  it('models redemptions with reversal-capable status', () => {
    const redemption = fixtureAccessRedemption();
    assert.equal(redemption.status, 'PENDING');
    assert.equal(redemption.unitsConsumed, 1n);
  });

  it('defaults token conversion contribution to zero', () => {
    assert.equal(defaultTokenConversionContribution(), 0n);
    const settlement = fixtureAccessSettlement();
    assert.equal(settlement.tokenConversionContribution, 0n);
    assert.equal(validateAccessSettlement(settlement), null);
  });

  it('documents that access entitlement is not cash', () => {
    const entitlement = fixtureAccessEntitlement();
    assert.deepEqual(entitlement.nonCash, ACCESS_ENTITLEMENT_NON_CASH_FLAGS);
    assert.equal(entitlement.nonCash.isCash, false);
    assert.equal(entitlement.nonCash.isBankBalance, false);
    assert.equal(entitlement.nonCash.isMonetaryAsset, false);
    const cashEntitlement = {
      ...entitlement,
      nonCash: { ...ACCESS_ENTITLEMENT_NON_CASH_FLAGS, isCash: true as const },
    };
    assert.equal(validateAccessEntitlement(cashEntitlement)?.code, 'ENTITLEMENT_IS_NOT_CASH');
  });

  it('keeps provider references vendor-independent', () => {
    const quote = fixtureAccessQuote();
    assert.ok(quote.providerId.startsWith('aceprv_'));
    assert.equal(quote.providerProductId, 'provider-product-1');
    assert.notEqual(quote.providerId, quote.providerProductId);
  });

  it('anchors transactions across lifecycle references', () => {
    const transaction = fixtureAccessTransaction();
    assert.equal(transaction.status, 'RESERVED');
    assert.ok(transaction.quoteId);
    assert.ok(transaction.reservationId);
    assert.equal(transaction.settlementId, null);
  });

  it('exposes catalog, capacity, entitlement, and transaction services', () => {
    const store = createAccessDomainStore();
    const mobility = fixtureAccessCategory('MOBILITY');
    const product = fixtureAccessProduct();
    const capacity = fixtureAccessCapacity();
    const entitlement = fixtureAccessEntitlement();
    const transaction = fixtureAccessTransaction();
    store.categories.set(mobility.id, mobility);
    store.products.set(product.accessProductId, product);
    store.capacities.set(capacity.capacityId, capacity);
    store.entitlements.set(entitlement.entitlementId, entitlement);
    store.transactions.set(transaction.transactionId, transaction);

    const services = createAccessDomainServices(store);
    assert.equal(services.catalog.getCategories().length, 1);
    assert.equal(services.catalog.getProducts('MOBILITY').length, 1);
    assert.equal(services.capacity.getCapacityById(capacity.capacityId)?.capacityId, capacity.capacityId);
    assert.equal(services.entitlement.getEntitlements(FIXTURE_USER).length, 1);
    assert.equal(
      services.transaction.getTransaction(transaction.transactionId)?.transactionId,
      transaction.transactionId,
    );
  });

  it('rejects invalid capacity builds', () => {
    assert.throws(() =>
      buildAccessCapacity({
        ...fixtureAccessCapacity(),
        totalUnits: 10n,
        reservedUnits: 8n,
        consumedUnits: 5n,
      }),
    );
  });

  it('uses stable idempotent identifiers', () => {
    const quote = fixtureAccessQuote();
    assert.ok(quote.quoteId.startsWith('acew1q_'));
    const reservation = fixtureAccessReservation();
    assert.ok(reservation.reservationId.startsWith('acew1r_'));
    const settlement = fixtureAccessSettlement();
    assert.ok(settlement.settlementId.startsWith('acew1s_'));
  });

  it('surfaces access domain failures as structured codes', () => {
    const failure = accessDomainFailure('NEGATIVE_UNITS', 'test');
    assert.equal(failure.code, 'NEGATIVE_UNITS');
    assert.equal(failure.message, 'test');
  });
});
