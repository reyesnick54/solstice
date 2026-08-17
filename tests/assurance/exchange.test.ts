import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../../packages/sunrey-exchange/src/ids.ts';
import { NativeClearingEngine } from '../../packages/sunrey-exchange/src/native-clearing/engine.ts';

const NOW = asUtcInstant('2026-08-17T00:00:00.000Z');

describe('Chunk 56 exchange properties', () => {
  it('conserves reservations and settles DVP at most once', () => {
    const clearing = new NativeClearingEngine({ fees: { tradingFeeQuote: 1n, networkFeeBase: 1n } });
    const alice = clearing.openExchangeAccount('alice');
    const bob = clearing.openExchangeAccount('bob');
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 12n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 26n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const settlement = [...clearing.settlements.values()][0];
    assert.ok(settlement);
    const finalized = clearing.submitSettlement(settlement.settlementId);
    assert.equal(finalized.status, 'FINALIZED');
    assert.throws(() => clearing.submitSettlement(settlement.settlementId));
    assert.equal(clearing.reconcile().outcome, 'MATCHED');
  });

  it('cancel releases only the remaining reservation', () => {
    const clearing = new NativeClearingEngine();
    const alice = clearing.openExchangeAccount('alice');
    const bob = clearing.openExchangeAccount('bob');
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 20n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 26n);
    const sell = clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 20n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.cancel(sell.orderId);
    assert.equal(clearing.position(bob, SUNREY_COIN_NATIVE_ASSET_ID).reserved, 0n);
  });
});
