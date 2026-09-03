// @ts-nocheck
/**
 * ACCESS Wave 3 / Prompt 37 — state machine unit tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCESS_TRANSACTION_TRANSITIONS,
  assertAccessTransactionTransition,
  canTransitionAccessTransaction,
  isTerminalAccessTransactionStatus,
} from './state-machine.ts';

describe('AccessTransactionStateMachine', () => {
  it('rejects illegal transitions', () => {
    assert.equal(canTransitionAccessTransaction('CREATED', 'SETTLED'), false);
    assert.throws(() => assertAccessTransactionTransition('CREATED', 'SETTLED'));
  });

  it('allows happy-path progression', () => {
    const path = [
      'CREATED',
      'QUOTED',
      'ELIGIBILITY_APPROVED',
      'PROVIDER_RESERVED',
      'BOOKED',
      'FULFILLED',
      'SETTLED',
    ] as const;
    for (let index = 1; index < path.length; index += 1) {
      assert.equal(canTransitionAccessTransaction(path[index - 1], path[index]), true);
    }
  });

  it('allows reconciliation and refund paths', () => {
    assert.equal(canTransitionAccessTransaction('BOOKING_PENDING', 'RECONCILIATION_REQUIRED'), true);
    assert.equal(canTransitionAccessTransaction('SETTLED', 'PARTIALLY_REFUNDED'), true);
    assert.equal(canTransitionAccessTransaction('PARTIALLY_REFUNDED', 'REFUNDED'), true);
    assert.equal(canTransitionAccessTransaction('QUOTED', 'REQUOTE_REQUIRED'), true);
  });

  it('marks terminal cancelled and refunded', () => {
    assert.equal(isTerminalAccessTransactionStatus('CANCELLED'), true);
    assert.equal(isTerminalAccessTransactionStatus('REFUNDED'), true);
    assert.equal(isTerminalAccessTransactionStatus('BOOKED'), false);
  });

  it('defines transitions for every status', () => {
    for (const status of Object.keys(ACCESS_TRANSACTION_TRANSITIONS)) {
      assert.ok(ACCESS_TRANSACTION_TRANSITIONS[status as keyof typeof ACCESS_TRANSACTION_TRANSITIONS]);
    }
  });
});
