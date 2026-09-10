import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  ALPHA_MARKET_INSTRUMENT_MRC_USD,
  ALPHA_MARKET_INSTRUMENT_SRC_MRC,
  ALPHA_MARKET_INSTRUMENT_SRC_USD,
  MRC_USD_ALPHA_MARKET_ID,
  SRC_MRC_ALPHA_MARKET_ID,
  SRC_USD_ALPHA_MARKET_ID,
  SUNREY_COIN_USD_MARKET_ID,
  SUNREY_MOONREY_MARKET_ID,
  resolveAlphaMarketRef,
} from '../ids.ts';
import { createAlphaExchangeSandbox } from './sandbox.ts';

const NOW = asUtcInstant('2026-09-10T12:00:00.000Z');

describe('Internal Alpha Exchange markets', () => {
  it('registers canonical SRC-USD, MRC-USD, and SRC-MRC identifiers', () => {
    assert.equal(resolveAlphaMarketRef('SRC-USD')?.marketId, SRC_USD_ALPHA_MARKET_ID);
    assert.equal(resolveAlphaMarketRef('MRC-USD')?.marketId, MRC_USD_ALPHA_MARKET_ID);
    assert.equal(resolveAlphaMarketRef('SRC-MRC')?.marketId, SRC_MRC_ALPHA_MARKET_ID);
  });

  it('keeps historical simulation fixtures addressable', () => {
    assert.equal(resolveAlphaMarketRef('market:sunrey-coin-usd-simulation')?.instrument, ALPHA_MARKET_INSTRUMENT_SRC_USD);
    assert.equal(resolveAlphaMarketRef('market:moonrey-coin-usd-simulation')?.instrument, ALPHA_MARKET_INSTRUMENT_MRC_USD);
    assert.equal(resolveAlphaMarketRef('market:sunrey-coin-moonrey-coin-native')?.instrument, ALPHA_MARKET_INSTRUMENT_SRC_MRC);
    assert.equal(resolveAlphaMarketRef('SUNREY_COIN-USD')?.marketId, SRC_USD_ALPHA_MARKET_ID);
    void SUNREY_COIN_USD_MARKET_ID;
    void SUNREY_MOONREY_MARKET_ID;
  });

  it('derives market data from live Alpha order book state', () => {
    const world = createAlphaExchangeSandbox({ now: NOW });
    const maker = world.seedParticipant({
      participantId: 'maker',
      usdAccountId: 'acct_maker_usd',
      usdMinor: 0n,
      sunrey: 1_000_000n,
      moonrey: 1_000_000n,
    });
    const buyer = world.seedParticipant({
      participantId: 'buyer',
      usdAccountId: 'acct_buyer_usd',
      usdMinor: 500_000n,
    });
    const ask = world.alpha.placeOrder({
      participantId: maker.participantId,
      marketRef: ALPHA_MARKET_INSTRUMENT_SRC_USD,
      side: 'SELL',
      quantity: 100_000n,
      priceUnits: 250n,
      now: NOW,
    });
    assert.ok(!('ok' in ask));
    const bid = world.alpha.placeOrder({
      participantId: buyer.participantId,
      marketRef: ALPHA_MARKET_INSTRUMENT_SRC_USD,
      side: 'BUY',
      quantity: 100_000n,
      priceUnits: 250n,
      now: NOW,
    });
    assert.ok(!('ok' in bid));
    const snapshot = world.alpha.snapshot(ALPHA_MARKET_INSTRUMENT_SRC_USD);
    assert.ok(snapshot);
    assert.equal(snapshot!.lastTrade?.price.priceUnits, 250n);
    assert.equal(snapshot!.volume.scaledUnits, 100_000n);
    const listed = world.api.markets();
    assert.equal(listed.items.length, 3);
    assert.ok(listed.items.some((item) => item.instrument === ALPHA_MARKET_INSTRUMENT_MRC_USD));
  });

  it('matches native SRC-MRC through the canonical clearing path', () => {
    const world = createAlphaExchangeSandbox({ now: NOW });
    world.seedParticipant({
      participantId: 'seller',
      usdAccountId: 'acct_seller_usd',
      sunrey: 500_000n,
      moonrey: 0n,
    });
    world.seedParticipant({
      participantId: 'buyer',
      usdAccountId: 'acct_buyer_usd',
      moonrey: 2_000_000n,
    });
    world.alpha.placeOrder({
      participantId: 'seller',
      marketRef: ALPHA_MARKET_INSTRUMENT_SRC_MRC,
      side: 'SELL',
      quantity: 100_000n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    world.alpha.placeOrder({
      participantId: 'buyer',
      marketRef: ALPHA_MARKET_INSTRUMENT_SRC_MRC,
      side: 'BUY',
      quantity: 100_000n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    const trades = world.alpha.tradesFor(ALPHA_MARKET_INSTRUMENT_SRC_MRC);
    assert.equal(trades.length, 1);
    assert.equal(trades[0]?.marketId, SRC_MRC_ALPHA_MARKET_ID);
  });
});
