import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
  createProspect,
  CUSTOMER_STATUSES,
  isErr,
  isOk,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
  type CustomerStatus,
} from './index.ts';

const NOW = asUtcInstant('2026-08-13T14:55:00.000Z');
const REFRESH_BY = asUtcInstant('2027-08-13T00:00:00.000Z');
const CREATED_AT = asUtcInstant('2026-01-15T09:00:00.000Z');

const LEGAL_TRANSITIONS: readonly (readonly [CustomerStatus, CustomerStatus])[] = [
  ['PROSPECT', 'PENDING_VERIFICATION'],
  ['PROSPECT', 'CLOSED'],
  ['PENDING_VERIFICATION', 'PROSPECT'],
  ['PENDING_VERIFICATION', 'ACTIVE'],
  ['PENDING_VERIFICATION', 'CLOSED'],
  ['ACTIVE', 'SUSPENDED'],
  ['ACTIVE', 'CLOSED'],
  ['SUSPENDED', 'ACTIVE'],
  ['SUSPENDED', 'CLOSED'],
];

function isLegalPair(from: CustomerStatus, to: CustomerStatus): boolean {
  return LEGAL_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

function snapshot(customer: Customer): Customer {
  return {
    id: customer.id,
    legalEntityId: customer.legalEntityId,
    jurisdiction: customer.jurisdiction,
    residency: customer.residency,
    status: customer.status,
    verification: {
      kycState: customer.verification.kycState,
      kycRecordVersion: customer.verification.kycRecordVersion,
      refreshBy: customer.verification.refreshBy,
    },
    createdAt: customer.createdAt,
    version: customer.version,
  };
}

function prospect(): Customer {
  return createProspect({
    id: asCustomerId('cust_test'),
    legalEntityId: asLegalEntityId('le_example_inc'),
    jurisdiction: asJurisdiction('US'),
    residency: asResidency('CA'),
    verification: notStartedVerification(REFRESH_BY),
    createdAt: CREATED_AT,
  });
}

function withStatus(status: CustomerStatus, version = 3): Customer {
  const base = prospect();
  return Object.freeze({
    ...base,
    status,
    version,
    verification: Object.freeze({ ...base.verification }),
  });
}

describe('Customer domain', () => {
  it('createProspect opens an immutable PROSPECT at version 0', () => {
    const customer = createProspect({
      id: asCustomerId('cust_1'),
      legalEntityId: asLegalEntityId('le_uk'),
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('IE'),
      verification: notStartedVerification(REFRESH_BY),
      createdAt: CREATED_AT,
    });

    assert.equal(customer.status, 'PROSPECT');
    assert.equal(customer.version, 0);
    assert.equal(customer.legalEntityId, 'le_uk');
    assert.equal(customer.jurisdiction, 'GB');
    assert.equal(customer.residency, 'IE');
    assert.equal(customer.verification.kycState, 'NOT_STARTED');
    assert.equal(customer.verification.kycRecordVersion, 0);
    assert.ok(Object.isFrozen(customer));
    assert.ok(Object.isFrozen(customer.verification));
  });

  for (const [from, to] of LEGAL_TRANSITIONS) {
    it(`allows ${from} -> ${to}`, () => {
      const customer = withStatus(from);
      const before = snapshot(customer);
      const result = transitionCustomerStatus(customer, to, NOW);

      assert.equal(isOk(result), true);
      if (!isOk(result)) {
        return;
      }

      assert.equal(result.value.customer.status, to);
      assert.equal(result.value.customer.id, customer.id);
      assert.equal(result.value.customer.legalEntityId, customer.legalEntityId);
      assert.equal(result.value.customer.jurisdiction, customer.jurisdiction);
      assert.equal(result.value.customer.residency, customer.residency);
      assert.equal(result.value.customer.createdAt, customer.createdAt);
      assert.equal(result.value.customer.version, customer.version + 1);
      assert.equal(result.value.occurredAt, NOW);
      assert.deepEqual(result.value.customer.verification, customer.verification);
      assert.ok(Object.isFrozen(result.value.customer));
      assert.notEqual(result.value.customer, customer);
      assert.deepEqual(snapshot(customer), before);
    });
  }

  for (const from of CUSTOMER_STATUSES) {
    for (const to of CUSTOMER_STATUSES) {
      if (isLegalPair(from, to)) {
        continue;
      }

      it(`rejects ${from} -> ${to} as a typed value`, () => {
        const customer = withStatus(from);
        const before = snapshot(customer);
        const result = transitionCustomerStatus(customer, to, NOW);

        assert.equal(result.ok, false);
        assert.equal(isErr(result), true);
        if (!isErr(result)) {
          return;
        }

        assert.equal(result.error.code, 'ILLEGAL_CUSTOMER_STATUS_TRANSITION');
        assert.equal(result.error.from, from);
        assert.equal(result.error.to, to);
        assert.equal(result.error.customerId, customer.id);
        assert.deepEqual(snapshot(customer), before);
      });
    }
  }

  it('does not throw for an illegal transition', () => {
    const closed = withStatus('CLOSED');
    assert.doesNotThrow(() => {
      const result = transitionCustomerStatus(closed, 'ACTIVE', NOW);
      assert.equal(result.ok, false);
    });
  });

  it('does not mutate the input customer on a legal transition', () => {
    const customer = withStatus('ACTIVE');
    const before = snapshot(customer);

    Object.freeze(customer);
    const result = transitionCustomerStatus(customer, 'SUSPENDED', NOW);

    assert.equal(isOk(result), true);
    assert.deepEqual(snapshot(customer), before);
    assert.equal(customer.status, 'ACTIVE');
    assert.equal(customer.version, 3);
  });

  it('does not mutate the input customer on an illegal transition', () => {
    const customer = withStatus('CLOSED');
    const before = snapshot(customer);

    const result = transitionCustomerStatus(customer, 'ACTIVE', NOW);

    assert.equal(isErr(result), true);
    assert.deepEqual(snapshot(customer), before);
    assert.equal(customer.status, 'CLOSED');
  });

  it('CLOSED -> ACTIVE is an explicit typed rejection, not an exception', () => {
    const customer = withStatus('CLOSED');
    let thrown: unknown;
    let result: ReturnType<typeof transitionCustomerStatus> | undefined;

    try {
      result = transitionCustomerStatus(customer, 'ACTIVE', NOW);
    } catch (error) {
      thrown = error;
    }

    assert.equal(thrown, undefined);
    assert.ok(result);
    assert.equal(result.ok, false);
    if (isErr(result)) {
      assert.equal(result.error.code, 'ILLEGAL_CUSTOMER_STATUS_TRANSITION');
      assert.equal(result.error.from, 'CLOSED');
      assert.equal(result.error.to, 'ACTIVE');
    }
  });
});
