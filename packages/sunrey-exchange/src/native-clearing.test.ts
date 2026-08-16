import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { detectSurveillanceAlerts } from '../../market-surveillance/src/detectors.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID, SUNREY_MOONREY_MARKET_ID } from './ids.ts';
import { nativeExchangeApi } from './native-clearing/api.ts';
import { NativeClearingEngine } from './native-clearing/engine.ts';
import { sunreyMoonreyMarket } from './native-clearing/markets.ts';
import { EXCHANGE_SETTLEMENT_ISSUER, NATIVE_TICKER_STATUS } from './native-clearing/types.ts';
import { quoteAssetQuantity, quoteForQuantity } from './price.ts';
import { exchangePrice } from './price.ts';

const NOW = asUtcInstant('2026-08-16T16:00:00.000Z');

function engine(fees = { tradingFeeQuote: 0n, networkFeeBase: 0n }) {
  const clearing = new NativeClearingEngine({ fees });
  const alice = clearing.openAccount('alice');
  const bob = clearing.openAccount('bob');
  return { clearing, alice, bob };
}

describe('native market definition', () => {
  it('uses canonical asset ids and unassigned tickers', () => {
    const market = sunreyMoonreyMarket();
    assert.equal(market.marketId, SUNREY_MOONREY_MARKET_ID);
    assert.equal(market.baseAsset, SUNREY_COIN_NATIVE_ASSET_ID);
    assert.equal(market.quoteAsset, MOONREY_COIN_NATIVE_ASSET_ID);
    assert.equal(market.tickerStatus, NATIVE_TICKER_STATUS);
    assert.equal(typeof market.quantityIncrement, 'bigint');
    assert.equal(typeof market.priceIncrement, 'bigint');
  });
});

describe('fixed-point price arithmetic', () => {
  it('computes exact notional without floating point', () => {
    const price = exchangePrice({
      baseAssetId: SUNREY_COIN_NATIVE_ASSET_ID,
      quoteAssetId: MOONREY_COIN_NATIVE_ASSET_ID,
      quoteKind: 'ASSET',
      priceUnits: 2_500_000n,
      quoteScale: 6,
      basePrecision: 6,
    });
    const qty = AssetQuantity.fromScaledUnits(10_000_000n, SUNREY_COIN_NATIVE_ASSET_ID);
    assert.equal(quoteForQuantity(price, qty), 25_000_000n);
    assert.equal(quoteAssetQuantity(price, qty).scaledUnits, 25_000_000n);
    assert.equal(quoteAssetQuantity(price, qty).assetId, MOONREY_COIN_NATIVE_ASSET_ID);
  });
});

describe('native deposits and derived positions', () => {
  it('does not credit unfinalized deposits', () => {
    const { clearing, alice } = engine();
    const address = clearing.allocateDepositAddress(alice);
    const deposit = clearing.observeChainTransfer({
      address,
      assetId: MOONREY_COIN_NATIVE_ASSET_ID,
      quantity: 26n,
      transactionId: 'ntx_mempool',
      finality: 'PENDING_PROPOSAL',
    });
    assert.equal(deposit.credited, false);
    assert.equal(clearing.position(alice, MOONREY_COIN_NATIVE_ASSET_ID).available, 0n);
    assert.equal(clearing.position(alice, MOONREY_COIN_NATIVE_ASSET_ID).finalized, 0n);
  });

  it('credits finalized deposits into derived available', () => {
    const { clearing, alice } = engine();
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 26n);
    const position = clearing.position(alice, MOONREY_COIN_NATIVE_ASSET_ID);
    assert.equal(position.available, 26n);
    assert.equal(position.finalized, 26n);
    assert.equal(position.reserved, 0n);
  });
});

describe('reservations and withdrawals', () => {
  it('reserves assets on order accept and blocks withdrawal of reserved quantity', () => {
    const { clearing, alice, bob } = engine();
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 12n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 26n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    assert.equal(clearing.position(bob, SUNREY_COIN_NATIVE_ASSET_ID).available, 2n);
    assert.equal(clearing.position(bob, SUNREY_COIN_NATIVE_ASSET_ID).reserved, 10n);
    assert.throws(
      () => clearing.requestWithdrawal(bob, SUNREY_COIN_NATIVE_ASSET_ID, 3n, 'ext_bob'),
      /INSUFFICIENT_ASSET/,
    );
    const allowed = clearing.requestWithdrawal(bob, SUNREY_COIN_NATIVE_ASSET_ID, 2n, 'ext_bob');
    assert.equal(allowed.status, 'REQUESTED');
  });

  it('partial fill keeps remainder reserved and cancel releases it', () => {
    const { clearing, alice, bob } = engine();
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 20n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 26n);
    const sell = clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 20n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const after = clearing.orders.get(sell.orderId)!;
    assert.equal(after.status, 'PARTIALLY_FILLED');
    assert.equal(after.remaining.scaledUnits, 10n);
    const reservation = [...clearing.reservations.values()].find((item) => item.orderId === sell.orderId)!;
    assert.equal(reservation.remaining, 10n);
    assert.equal(reservation.state, 'PARTIAL');
    clearing.cancel(sell.orderId);
    assert.equal(clearing.position(bob, SUNREY_COIN_NATIVE_ASSET_ID).reserved, 0n);
    assert.equal(clearing.orders.get(sell.orderId)?.status, 'CANCELLED');
  });
});

describe('atomic DVP and settlement safety', () => {
  it('settles SunRey/MoonRey atomically with exact fees and receipts', () => {
    const { clearing, alice, bob } = engine({ tradingFeeQuote: 1n, networkFeeBase: 1n });
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 12n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 26n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const settlement = [...clearing.settlements.values()][0]!;
    assert.equal(settlement.status, 'SETTLEMENT_CREATED');
    const finalized = clearing.submitSettlement(settlement.settlementId);
    assert.equal(finalized.status, 'FINALIZED');
    assert.equal(clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available, 10n);
    assert.equal(clearing.position(bob, MOONREY_COIN_NATIVE_ASSET_ID).available, 25n);
    assert.equal(clearing.chain.holding('fees', MOONREY_COIN_NATIVE_ASSET_ID).available, 1n);
    assert.equal(clearing.chain.holding('fees', SUNREY_COIN_NATIVE_ASSET_ID).available, 1n);
    const trade = [...clearing.trades.values()][0]!;
    const receipt = clearing.receipt(trade.tradeId)!;
    assert.equal(receipt.tradingFee, 1n);
    assert.equal(receipt.networkFee, 1n);
    assert.equal(receipt.notional, 25n);
    assert.equal(receipt.quantity, 10n);
    assert.ok(receipt.blockchainTransactionId);
    assert.ok(receipt.finalizedHeight > 0n);
    assert.equal(clearing.reconcile().outcome, 'MATCHED');
    const api = nativeExchangeApi(clearing);
    assert.equal(api.availableNativePositions(alice)[0]?.available, 10n);
    assert.equal(api.settlementReceipt(trade.tradeId)?.settlementId, settlement.settlementId);
  });

  it('rejects fabricated, replayed, wrong-asset, and wrong-network settlements without movement', () => {
    const { clearing, alice, bob } = engine();
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 10n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 25n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const settlement = [...clearing.settlements.values()][0]!;
    const beforeAlice = clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available;
    assert.throws(() => {
      clearing.chain.applySettlement({
        ...settlement.intent,
        exchangeSignature: 'alice:forged',
      });
    }, /WRONG_AUTHORITY/);
    assert.throws(() => {
      clearing.chain.applySettlement({
        ...settlement.intent,
        networkId: 'net_other',
      });
    }, /WRONG_NETWORK/);
    assert.throws(() => {
      clearing.chain.applySettlement({
        ...settlement.intent,
        baseAsset: MOONREY_COIN_NATIVE_ASSET_ID,
        quoteAsset: MOONREY_COIN_NATIVE_ASSET_ID,
      });
    }, /WRONG_ASSET/);
    clearing.submitSettlement(settlement.settlementId);
    assert.throws(() => clearing.chain.applySettlement(settlement.intent), /SETTLEMENT_REPLAY|TRADE_ALREADY_SETTLED/);
    assert.equal(clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available, 10n);
    assert.equal(beforeAlice, 0n);
    void EXCHANGE_SETTLEMENT_ISSUER;
  });

  it('rejects insufficient reservation atomically and does not create a duplicate', () => {
    const { clearing, alice, bob } = engine();
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 10n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 25n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const settlement = [...clearing.settlements.values()][0]!;
    const failed = clearing.chain.submitSettlement({
      ...settlement.intent,
      settlementId: 'xset_insufficient' as typeof settlement.settlementId,
      reservationRefs: ['res-missing'],
      nonce: 99n,
    });
    assert.equal(clearing.submitSettlement(settlement.settlementId).status, 'FINALIZED');
    const rejected = (() => {
      try {
        clearing.chain.finalize(failed.transactionId);
        return false;
      } catch {
        return true;
      }
    })();
    assert.equal(rejected, true);
    assert.equal(clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available, 10n);
    assert.equal(clearing.chain.usedSettlements.size, 1);
  });

  it('resolves submission ambiguity by transaction id and settles once', () => {
    const { clearing, alice, bob } = engine();
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 10n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 25n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const settlement = [...clearing.settlements.values()][0]!;
    const unknown = clearing.submitSettlement(settlement.settlementId, true);
    assert.equal(unknown.status, 'SUBMISSION_UNKNOWN');
    assert.ok(unknown.transactionId);
    const queried = clearing.queryTransaction(unknown.transactionId!);
    assert.equal(queried.found, true);
    const resolved = clearing.querySettlement(settlement.settlementId);
    assert.equal(resolved.status, 'FINALIZED');
    assert.equal(clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available, 10n);
    assert.equal(clearing.chain.settledTrades.size, 1);
    const again = clearing.submitSettlement(settlement.settlementId);
    assert.equal(again.settlementId, resolved.settlementId);
    assert.equal(clearing.chain.settledTrades.size, 1);
  });
});

describe('market surveillance inputs', () => {
  it('exposes immutable settlement facts for detectors', () => {
    const { clearing, alice, bob } = engine();
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 10n);
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 25n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const settlement = [...clearing.settlements.values()][0]!;
    clearing.submitSettlement(settlement.settlementId);
    const observed = clearing.observedTrades[0]!;
    const alerts = detectSurveillanceAlerts(
      {
        marketId: observed.marketId,
        orders: [],
        trades: [
          {
            tradeId: observed.tradeId,
            marketId: observed.marketId,
            makerOrderId: 'maker',
            takerOrderId: 'taker',
            makerAccountId: observed.seller,
            takerAccountId: observed.buyer,
            makerParticipantId: 'bob',
            takerParticipantId: 'alice',
            quantity: observed.quantity,
            priceUnits: observed.priceUnits,
            matchedAt: NOW,
          },
        ],
      },
      NOW,
    );
    assert.ok(Array.isArray(alerts));
    assert.ok(observed.settlementId);
  });
});
