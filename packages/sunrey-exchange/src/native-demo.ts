import { asUtcInstant } from '../../domain/src/time.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from './ids.ts';
import { nativeExchangeApi } from './native-clearing/api.ts';
import { NativeClearingEngine } from './native-clearing/engine.ts';

const NOW = asUtcInstant('2026-08-16T16:00:00.000Z');

const clearing = new NativeClearingEngine({ fees: { tradingFeeQuote: 1n, networkFeeBase: 1n } });
const alice = clearing.openAccount('alice');
const bob = clearing.openAccount('bob');
clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 26n);
clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 12n);
clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
const settlement = [...clearing.settlements.values()][0];
if (!settlement) {
  throw new Error('expected settlement intent');
}
const finalized = clearing.submitSettlement(settlement.settlementId);
const api = nativeExchangeApi(clearing);
const report = {
  market: 'SUNREY_COIN/MOONREY_COIN',
  tickerStatus: 'NOT_ASSIGNED',
  aliceSunRey: clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available.toString(),
  bobMoonRey: clearing.position(bob, MOONREY_COIN_NATIVE_ASSET_ID).available.toString(),
  tradingFee: clearing.chain.holding('fees', MOONREY_COIN_NATIVE_ASSET_ID).available.toString(),
  networkFee: clearing.chain.holding('fees', SUNREY_COIN_NATIVE_ASSET_ID).available.toString(),
  settlementStatus: finalized.status,
  receipt: api.settlementReceipt([...clearing.trades.values()][0]!.tradeId),
  reconciliation: api.reconciliationState(),
  noSecondLedger: true,
};
console.log(JSON.stringify(report, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
if (report.aliceSunRey !== '10' || report.bobMoonRey !== '25' || report.reconciliation.outcome !== 'MATCHED') {
  process.exit(1);
}
