import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PyramidExchangeSystem } from './system.ts';
import { KILL_SWITCH_IDS } from './kill-switch.ts';

describe('kill switches', () => {
  it('each switch works with the agent runtime absent', () => {
    const exchange = new PyramidExchangeSystem('kills');
    exchange.bootstrapHouse();
    const trader = exchange.registerTrader({
      customerId: 'cust_ks',
      name: 'Pat',
      jurisdiction: 'GB',
      usd: 20_000n,
      pyr: 20_000n,
    });
    exchange.approveListing({ jurisdiction: 'GB', capabilities: ['SPOT_TRADE'], reason: 'kill switch fixture' });
    for (const id of KILL_SWITCH_IDS) {
      const scope =
        id === 'CUSTOMER' ? trader.customerId : id === 'ASSET_PAIR' ? 'PYR/USD' : id === 'JURISDICTION' ? 'GB' : undefined;
      exchange.toggleKillSwitch(id, true, `human engage ${id}`, scope);
      assert.equal(exchange.kills.isEngaged(id, scope), true, id);
      if (id === 'EXCHANGE' || id === 'ASSET_PAIR' || id === 'CUSTOMER' || id === 'JURISDICTION') {
        const placed = exchange.place({
          id: `ord_${id}`,
          customerId: trader.customerId,
          side: 'BUY',
          type: 'LIMIT',
          quantity: 1n,
          price: 20000n,
        });
        assert.equal(placed.ok, false, id);
      }
      exchange.toggleKillSwitch(id, false, `human clear ${id}`, scope);
      assert.equal(exchange.kills.isEngaged(id, scope), false, id);
    }
  });
});
