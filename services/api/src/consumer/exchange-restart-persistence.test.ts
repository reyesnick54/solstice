import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  captureConsumerAlphaSnapshot,
  hydrateConsumerAlphaLifecycle,
} from '@solstice/sunrey-exchange';
import { ExchangeBffSurface, type ExchangeBffPersistenceHooks } from './exchange.ts';
import { createSandboxWorld } from './fixtures.ts';

/**
 * Regression: the direct order route (submitConfirmedOrder), cancellation,
 * quotes and the sandbox faucet mutated exchange state without persisting it,
 * so a hosted restart silently dropped orders and faucet credits.
 */
function snapshotStore() {
  const rows = new Map<string, ReturnType<typeof captureConsumerAlphaSnapshot>>();
  const now = () => '2026-11-10T06:00:00.000Z' as never;
  const hooks: ExchangeBffPersistenceHooks = {
    async load(customerId, mode) {
      const snapshot = rows.get(`${customerId}:${mode}`);
      return snapshot ? hydrateConsumerAlphaLifecycle({ snapshot, now: now() }) : null;
    },
    async save(customerId, mode, world) {
      rows.set(`${customerId}:${mode}`, captureConsumerAlphaSnapshot(world));
    },
    async loadIdempotency() {
      return null;
    },
    async saveIdempotency() {},
  };
  // A "restarted" surface preloads from what was persisted, like createDurableExchangeSurface.
  const restart = () => {
    const preloaded = new Map();
    for (const [key, snapshot] of rows) preloaded.set(key, hydrateConsumerAlphaLifecycle({ snapshot, now: now() }));
    return new ExchangeBffSurface(now, hooks, preloaded);
  };
  return { rows, hooks, now, restart };
}

function isError(v: unknown): v is { errorCode: string } {
  return Boolean(v && typeof v === 'object' && 'errorCode' in v);
}

describe('exchange state survives a restart', () => {
  it('persists faucet credit, confirmed orders and cancellations', async () => {
    const store = snapshotStore();
    const principal = createSandboxWorld().personas.exchange;
    const first = new ExchangeBffSurface(store.now, store.hooks);

    await first.fund(principal, 'req_fund');
    assert.equal(store.rows.size, 1, 'faucet credit persisted');

    const quote = await first.quote(principal, { marketId: 'SRC-MRC', side: 'BUY', quantity: '1' }, 'req_q');
    assert.equal(isError(quote), false, JSON.stringify(quote));
    const order = await first.submitConfirmedOrder(
      principal,
      { marketId: 'SRC-MRC', side: 'BUY', quantity: '1', quoteId: (quote as { quoteId: string }).quoteId, confirmed: true, stepUpSatisfied: true },
      'req_o',
    );
    assert.equal(isError(order), false, JSON.stringify(order));
    const orderId = (order as { orderId: string }).orderId;

    const afterRestart = store.restart();
    const orders = afterRestart.orders(principal, 'req_list') as { items: Array<{ orderId: string; status?: string }> };
    assert.ok(orders.items.some((o) => o.orderId === orderId), 'order survives restart');
    const before = first.portfolio(principal, 'req_p1') as { items: unknown[] };
    const after = afterRestart.portfolio(principal, 'req_p2') as { items: unknown[] };
    assert.deepEqual(after.items, before.items, 'balances survive restart');

    const cancelled = await afterRestart.cancelOrderById(principal, orderId, 'req_c');
    if (!isError(cancelled)) {
      const again = store.restart();
      const row = (again.orderById(principal, orderId, 'req_g') as { status?: string });
      assert.equal(row.status, (afterRestart.orderById(principal, orderId, 'req_g2') as { status?: string }).status, 'cancellation survives restart');
    }
  });
});
