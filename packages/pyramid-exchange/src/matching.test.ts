import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId, asUtcInstant } from '@solstice/domain';
import type { KernelAuthorization } from '@solstice/kernel';
import { mintClearedOrder } from './cleared-order.ts';
import { assertClearedOrder, isClearedOrder } from './cleared-order.ts';
import { MatchingEngine } from './matching.ts';
import { PYR_USD, type Order } from './types.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function auth(): KernelAuthorization {
  return {
    intentId: 'int_m' as KernelAuthorization['intentId'],
    kind: 'PLACE_ORDER',
    posture: 'CLEAR',
    permitHash: 'b'.repeat(64),
    issuedAt: NOW,
    evidenceId: 'ev_m',
    __kernelBrand: 'KernelAuthorization',
  };
}

function draft(partial: Partial<Order> & Pick<Order, 'id' | 'side' | 'quantity' | 'sequence'>): Order {
  return Object.freeze({
    customerId: asCustomerId(partial.customerId ?? 'cust_a'),
    customerName: 'A',
    jurisdiction: 'GB',
    pair: PYR_USD,
    type: partial.type ?? 'LIMIT',
    remaining: partial.quantity,
    price: partial.price,
    timeInForce: 'GTC',
    state: 'NEW',
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  });
}

function cleared(order: Order) {
  return mintClearedOrder(order, {
    clearanceId: `clr_${order.id}`,
    evidenceId: 'ev_m',
    authorization: auth(),
    checks: Object.freeze(['test']),
  });
}

describe('matching engine', () => {
  it('is deterministic from the same seeded sequence', () => {
    const run = (seed: string) => {
      const engine = new MatchingEngine(seed);
      engine.accept(cleared(draft({ id: 'a', customerId: asCustomerId('c1'), side: 'SELL', quantity: 100n, price: 20000n, sequence: 1 })));
      engine.accept(cleared(draft({ id: 'b', customerId: asCustomerId('c2'), side: 'BUY', quantity: 60n, price: 20000n, sequence: 2 })));
      return engine.listFills().map((fill) => ({ id: fill.id, qty: fill.quantity.toString(), px: fill.price.toString() }));
    };
    assert.deepEqual(run('seed-a'), run('seed-a'));
    assert.notDeepEqual(run('seed-a'), run('seed-b'));
  });

  it('matches price-time priority with a partial fill', () => {
    const engine = new MatchingEngine('pt');
    engine.accept(cleared(draft({ id: 'early', customerId: asCustomerId('s1'), side: 'SELL', quantity: 80n, price: 20000n, sequence: 1 })));
    engine.accept(cleared(draft({ id: 'late', customerId: asCustomerId('s2'), side: 'SELL', quantity: 80n, price: 20000n, sequence: 2 })));
    const result = engine.accept(cleared(draft({ id: 'taker', customerId: asCustomerId('b1'), side: 'BUY', quantity: 100n, price: 20000n, sequence: 3 })));
    assert.equal(result.fills.length, 2);
    assert.equal(result.fills[0]!.makerOrderId, 'early');
    assert.equal(result.fills[0]!.quantity, 80n);
    assert.equal(result.fills[1]!.makerOrderId, 'late');
    assert.equal(result.fills[1]!.quantity, 20n);
    assert.equal(engine.getOrder('late')?.remaining, 60n);
    assert.equal(engine.getOrder('taker')?.state, 'FILLED');
  });

  it('matches a market order against the best resting limit', () => {
    const engine = new MatchingEngine('mkt');
    engine.accept(cleared(draft({ id: 'ask', customerId: asCustomerId('s1'), side: 'SELL', quantity: 40n, price: 19900n, sequence: 1 })));
    const result = engine.accept(
      cleared(draft({ id: 'mkt', customerId: asCustomerId('b1'), side: 'BUY', quantity: 40n, type: 'MARKET', sequence: 2 })),
    );
    assert.equal(result.fills[0]!.price, 19900n);
    assert.equal(result.fills[0]!.quantity, 40n);
  });

  it('cancels a resting order', () => {
    const engine = new MatchingEngine('cxl');
    engine.accept(cleared(draft({ id: 'rest', customerId: asCustomerId('s1'), side: 'SELL', quantity: 10n, price: 20000n, sequence: 1 })));
    engine.accept(cleared(draft({ id: 'rest', customerId: asCustomerId('s1'), side: 'SELL', quantity: 10n, type: 'CANCEL', sequence: 2 })));
    assert.equal(engine.getOrder('rest')?.state, 'CANCELLED');
    assert.equal(engine.listResting().length, 0);
  });

  it('prevents self-trades at the engine', () => {
    const engine = new MatchingEngine('stp');
    engine.accept(cleared(draft({ id: 'mine', customerId: asCustomerId('same'), side: 'SELL', quantity: 10n, price: 20000n, sequence: 1 })));
    const result = engine.accept(
      cleared(draft({ id: 'also', customerId: asCustomerId('same'), side: 'BUY', quantity: 10n, price: 20000n, sequence: 2 })),
    );
    assert.equal(result.fills.length, 0);
    assert.equal(result.selfTradePrevented, true);
    assert.equal(engine.listResting().length, 2);
  });

  it('refuses a non-cleared object at runtime', () => {
    const engine = new MatchingEngine('raw');
    const raw = draft({ id: 'raw', side: 'BUY', quantity: 1n, price: 1n, sequence: 1 });
    assert.equal(isClearedOrder(raw), false);
    assert.throws(() => engine.accept(raw as never), /ClearedOrder/);
    assert.throws(() => assertClearedOrder(raw));
  });
});
