import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  loadGrowSandboxAllocationState,
  persistGrowSandboxAllocationState,
} from '../../packages/persistence/src/growth/pg-sandbox-allocation-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { asGrowSandboxAllocationId } from '../../packages/platform/src/work-order/sandbox-allocation/ids.ts';
import type { GrowSandboxAllocation } from '../../packages/platform/src/work-order/sandbox-allocation/types.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-09-16T15:30:00.000Z');

function sampleAllocation(): GrowSandboxAllocation {
  return Object.freeze({
    allocationId: asGrowSandboxAllocationId('gsa_pg_h13'),
    workOrderId: 'ewo_pg_h13',
    customerId: 'cust_pg_h13',
    accountId: 'acct_pg_h13',
    currency: 'USD',
    environment: 'simulation',
    executionMode: 'SANDBOX',
    requestedAmountMinorUnits: '100000',
    acceptedAmountMinorUnits: '100000',
    reservedAmountMinorUnits: '100000',
    availableAtRequestMinorUnits: '1000000',
    status: 'RESERVED',
    mandateRef: Object.freeze({
      mandateId: 'emd_pg_h13',
      mandateVersion: 1,
    }),
    controlRefs: Object.freeze({
      approvalReference: null,
      capabilityContextReference: 'cap_pg_h13',
      authorityDecisionReference: 'emd_pg_h13',
    }),
    balanceReference: Object.freeze({
      accountId: 'acct_pg_h13',
      epoch: 1,
      asOf: NOW,
      ledgerBalanceMinorUnits: '1000000',
      settledMinorUnits: '1000000',
      heldMinorUnits: '0',
      availableMinorUnits: '1000000',
    }),
    holdId: 'hold_pg_h13',
    reservationReference: 'hold:hold_pg_h13',
    riskDecision: 'ALLOW',
    complianceDecision: 'ALLOW',
    refusalReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    idempotencyKey: 'idem_pg_h13',
    createsFinancialAuthority: false,
    postsLedger: false,
    impliesLiveProvider: false,
  });
}

describe('grow sandbox allocation persistence', () => {
  it('round-trips allocation state through PostgreSQL', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('persistence not available');
      return;
    }
    const pools = await preparePersistence();
    const allocation = sampleAllocation();
    await persistGrowSandboxAllocationState(pools.customer, {
      allocations: Object.freeze([allocation]),
    });
    const loaded = await loadGrowSandboxAllocationState(pools.customer);
    assert.equal(loaded.allocations.length, 1);
    assert.equal(loaded.allocations[0]?.allocationId, allocation.allocationId);
    assert.equal(loaded.allocations[0]?.reservedAmountMinorUnits, '100000');
    assert.equal(loaded.allocations[0]?.executionMode, 'SANDBOX');
    await closePersistencePools(pools);
  });
});
