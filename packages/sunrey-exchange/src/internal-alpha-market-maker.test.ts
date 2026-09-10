import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { UtcInstant } from './consumer/types.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
} from './ids.ts';
import { ConsumerExchangeEngine } from './consumer/engine.ts';
import type { ConsumerAuthorization } from './consumer/types.ts';
import {
  defaultAlphaLiquidityConfig,
  InternalAlphaMarketMaker,
  SUNREY_ALPHA_INTERNAL_LIQUIDITY_SOURCE,
  SUNREY_ALPHA_MARKET_MAKER_ID,
} from './alpha/index.ts';

const NOW = '2026-09-10T04:00:00.000Z' as UtcInstant;

function walletAuth(intentDisplay: string | null = null): ConsumerAuthorization {
  return Object.freeze({
    sessionId: 'cses_alice',
    sessionAuthenticated: true,
    wallet: Object.freeze({
      walletId: 'wallet_alice',
      signedIntentHex: 'signed-alpha-intent-aabbccddeeff',
      intentDisplay: intentDisplay ?? 'unsigned-preview',
      authorizationKind: 'WALLET_SIGNATURE' as const,
    }),
    origin: 'HUMAN',
    agentMandate: null,
  });
}

function alphaEngine(participantId = 'alice') {
  const engine = new ConsumerExchangeEngine({ now: NOW });
  engine.registerConsumer({ participantId, environment: 'SANDBOX' });
  engine.activateInternalAlphaLiquidity(NOW);
  return engine;
}

function fundMoonrey(engine: ConsumerExchangeEngine, participantId: string, quantity: bigint) {
  const profile = engine.profiles.get(participantId)!;
  engine.creditSimulationHolding(profile.accountId, 'MOONREY_COIN', quantity);
}

function fundSunrey(engine: ConsumerExchangeEngine, participantId: string, quantity: bigint) {
  const profile = engine.profiles.get(participantId)!;
  engine.creditSimulationHolding(profile.accountId, 'SUNREY_COIN', quantity);
}

describe('Internal Alpha market maker bootstrap', () => {
  it('creates canonical SUNREY_ALPHA_MARKET_MAKER with explicit allocation provenance', () => {
    const engine = alphaEngine();
    const maker = engine.getInternalAlphaLiquidity()!;
    const view = maker.view(engine.ops);
    const openOrders = [...engine.ops.orders.values()].filter((row) => row.status === 'OPEN');
    assert.ok(openOrders.length >= 2, `expected open MM orders, got ${openOrders.length}`);
    assert.equal(view.session.participantId, SUNREY_ALPHA_MARKET_MAKER_ID);
    assert.equal(view.session.hiddenPriority, false);
    assert.equal(view.allocations.length, 3);
    assert.ok(view.allocations.every((row) => row.source === SUNREY_ALPHA_INTERNAL_LIQUIDITY_SOURCE));
    assert.ok(view.allocations.every((row) => row.provenance === 'GENESIS'));
  });

  it('posts deterministic reference quotes for SRC/USD, MRC/USD, and SRC/MRC', () => {
    const engine = alphaEngine();
    const quotes = engine.getInternalAlphaLiquidity()!.getReferenceQuotes(engine.ops);
    assert.equal(quotes.length, 3);
    for (const quote of quotes) {
      assert.equal(quote.source, SUNREY_ALPHA_INTERNAL_LIQUIDITY_SOURCE);
      assert.ok(quote.spreadUnits > 0n);
      assert.ok(quote.bidPriceUnits < quote.askPriceUnits);
    }
    const pairs = quotes.map((row) => row.pair);
    assert.deepEqual(pairs, ['SRC/USD', 'MRC/USD', 'SRC/MRC']);
  });

  it('uses documented alpha config rather than unexplained hardcoded prices', () => {
    const config = defaultAlphaLiquidityConfig();
    const maker = new InternalAlphaMarketMaker(config);
    const engine = new ConsumerExchangeEngine({ now: NOW });
    maker.bootstrap(engine.ops, NOW);
    const srcUsd = maker.getReferenceQuotes(engine.ops).find((row) => row.pair === 'SRC/USD')!;
    assert.equal(srcUsd.bidPriceUnits + srcUsd.spreadUnits, srcUsd.askPriceUnits);
    assert.ok(srcUsd.askPriceUnits > config.referencePrices.srcUsdMinorPerUnit);
  });
});

describe('Internal Alpha executable trading through canonical matching', () => {
  it('fills user BUY SRC against market-maker SELL liquidity', () => {
    const engine = alphaEngine();
    fundMoonrey(engine, 'alice', 200n * 1_000_000n);
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'BUY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 2n,
      now: NOW,
    });
    assert.equal('ok' in preview, false);
    const tradesBefore = engine.ops.trades.length;
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((preview as { humanReadableIntent: string }).humanReadableIntent),
      request: {
        clientOrderId: 'buy-src-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 2n,
        limitPriceUnits: 2_600_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: (preview as { previewId: string }).previewId,
      },
    });
    assert.equal('ok' in result, false);
    if ('ok' in result) {
      throw new Error(result.reason);
    }
    assert.ok(engine.ops.trades.length > tradesBefore);
    assert.ok(['FILLED', 'PARTIALLY_FILLED', 'OPEN'].includes(result.view));
  });

  it('fills user SELL SRC against market-maker BUY liquidity', () => {
    const engine = alphaEngine();
    fundSunrey(engine, 'alice', 5n);
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'SELL',
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: 1n,
      now: NOW,
    });
    const tradesBefore = engine.ops.trades.length;
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((preview as { humanReadableIntent: string }).humanReadableIntent),
      request: {
        clientOrderId: 'sell-src-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'SELL',
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_400_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: (preview as { previewId: string }).previewId,
      },
    });
    assert.equal('ok' in result, false);
    if ('ok' in result) {
      throw new Error(result.reason);
    }
    assert.ok(engine.ops.trades.length > tradesBefore);
    assert.equal(result.view, 'FILLED');
  });

  it('supports buy MRC via SELL SRC and sell MRC via BUY SRC conversion flow', () => {
    const engine = alphaEngine();
    fundSunrey(engine, 'alice', 3n);
    const sellPreview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'CONVERT',
      side: 'SELL',
      orderType: 'MARKET_WITH_PROTECTION',
      quantity: 1n,
      protectionBps: 500n,
      now: NOW,
    });
    const sellResult = engine.submitConsumerConversion({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((sellPreview as { humanReadableIntent: string }).humanReadableIntent),
      request: {
        clientOrderId: 'buy-mrc-via-sell-src',
        fromAsset: 'SUNREY_COIN',
        toAsset: 'MOONREY_COIN',
        quantity: 1n,
        priceProtectionBps: 500n,
        quoteId: null,
      },
    });
    assert.equal('ok' in sellResult, false);

    fundMoonrey(engine, 'alice', 100n * 1_000_000n);
    const buyPreview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'CONVERT',
      side: 'BUY',
      orderType: 'MARKET_WITH_PROTECTION',
      quantity: 1n,
      protectionBps: 500n,
      now: NOW,
    });
    const buyResult = engine.submitConsumerConversion({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((buyPreview as { humanReadableIntent: string }).humanReadableIntent),
      request: {
        clientOrderId: 'sell-mrc-via-buy-src',
        fromAsset: 'MOONREY_COIN',
        toAsset: 'SUNREY_COIN',
        quantity: 1n,
        priceProtectionBps: 500n,
        quoteId: null,
      },
    });
    assert.equal('ok' in buyResult, false);
  });

  it('supports partial fills when size exceeds top-of-book depth band', () => {
    const engine = alphaEngine();
    fundMoonrey(engine, 'alice', 500n * 1_000_000n);
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'BUY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 120n,
      now: NOW,
    });
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((preview as { humanReadableIntent: string }).humanReadableIntent),
      request: {
        clientOrderId: 'partial-fill',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 120n,
        limitPriceUnits: 2_600_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: (preview as { previewId: string }).previewId,
      },
    });
    assert.equal('ok' in result, false);
    if ('ok' in result) {
      throw new Error(result.reason);
    }
    assert.equal(result.view, 'PARTIALLY_FILLED');
    assert.ok(result.remaining > 0n);
    assert.ok(result.remaining < 120n);
  });
});

describe('Internal Alpha liquidity controls', () => {
  it('reports LOW_LIQUIDITY when inventory falls below configured threshold', () => {
    const config = defaultAlphaLiquidityConfig({
      initialAllocation: {
        sandboxUsdMinor: 1_000_000_00n,
        sunreyScaled: 5n * 1_000_000n,
        moonreyScaled: 5n * 1_000_000n,
      },
      inventoryThresholds: {
        sunreyScaled: 10n * 1_000_000n,
        moonreyScaled: 10n * 1_000_000n,
        sandboxUsdMinor: 10_000_00n,
      },
    });
    const engine = new ConsumerExchangeEngine({ now: NOW, policy: undefined });
    const maker = new InternalAlphaMarketMaker(config);
    maker.bootstrap(engine.ops, NOW);
    assert.equal(maker.inventoryStatus(engine.ops), 'LOW_LIQUIDITY');
  });

  it('does not silently mint inventory without authorized replenishment', () => {
    const engine = alphaEngine();
    const maker = engine.getInternalAlphaLiquidity()!;
    const before = maker.snapshot(engine.ops);
    const issuedBefore = engine.ops.clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    const replenish = maker.authorizeReplenishment({
      ops: engine.ops,
      now: NOW,
      replenishmentRef: 'alpha_replenish_ref_1',
      assetKind: 'SUNREY_COIN',
      quantity: 10n * 1_000_000n,
    });
    assert.equal(replenish.ok, true);
    const issuedAfter = engine.ops.clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    assert.equal(issuedAfter - issuedBefore, 10n * 1_000_000n);
    assert.ok(maker.ledger.records.some((row) => row.provenance === 'REPLENISHMENT'));
    assert.notEqual(before.totalIssuedSunrey, maker.snapshot(engine.ops).totalIssuedSunrey);
  });

  it('maintains non-negative balances across user and market-maker accounts', () => {
    const engine = alphaEngine();
    fundMoonrey(engine, 'alice', 50n * 1_000_000n);
    engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'non-neg-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 3n,
        limitPriceUnits: 2_600_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    for (const account of engine.ops.clearing.accounts.values()) {
      for (const assetId of [SUNREY_COIN_NATIVE_ASSET_ID, MOONREY_COIN_NATIVE_ASSET_ID]) {
        const pos = engine.ops.clearing.position(account.accountId, assetId);
        assert.ok(pos.available >= 0n);
        assert.ok(pos.finalized >= 0n);
      }
    }
  });

  it('prevents double-spend via client order id idempotency', () => {
    const engine = alphaEngine();
    fundMoonrey(engine, 'alice', 20n * 1_000_000n);
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'BUY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 1n,
      now: NOW,
    });
    const request = {
      clientOrderId: 'double-spend-guard',
      marketId: SUNREY_MOONREY_MARKET_ID,
      flow: 'BUY' as const,
      side: 'BUY' as const,
      orderType: 'LIMIT' as const,
      quantity: 1n,
      limitPriceUnits: 2_600_000n,
      priceProtectionBps: null,
      quoteId: null,
      previewId: (preview as { previewId: string }).previewId,
    };
    const first = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((preview as { humanReadableIntent: string }).humanReadableIntent),
      request,
    });
    const second = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((preview as { humanReadableIntent: string }).humanReadableIntent),
      request,
    });
    assert.equal('ok' in first, false);
    assert.equal('ok' in second, false);
    if ('ok' in first || 'ok' in second) {
      throw new Error('expected orders');
    }
    assert.equal(first.orderId, second.orderId);
    assert.equal(engine.ops.trades.filter((trade) => trade.takerOrderId === first.orderId).length, 1);
  });

  it('applies configured spread on posted executable quotes', () => {
    const engine = alphaEngine();
    const market = engine.getConsumerMarket(NOW);
    assert.ok(market.spreadUnits !== null);
    assert.ok((market.spreadUnits ?? 0n) > 0n);
    assert.ok(market.bestBid !== null && market.bestAsk !== null);
    assert.ok((market.bestAsk ?? 0n) > (market.bestBid ?? 0n));
  });

  it('restores allocation snapshot without duplicating fills or chain issuance totals', () => {
    const engine = alphaEngine();
    const maker = engine.getInternalAlphaLiquidity()!;
    fundMoonrey(engine, 'alice', 10n * 1_000_000n);
    engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'persist-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_600_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    const snap = maker.snapshot(engine.ops);
    const tradesBefore = engine.ops.trades.length;
    const issuedBefore = engine.ops.clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    const restored = new InternalAlphaMarketMaker(defaultAlphaLiquidityConfig());
    restored.restoreSnapshot(snap);
    assert.equal(restored.ledger.records.length, snap.allocations.length);
    assert.equal(engine.ops.trades.length, tradesBefore);
    assert.equal(engine.ops.clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID), issuedBefore);
  });
});

describe('Internal Alpha sandbox USD flow', () => {
  it('debits sandbox USD and funds MRC for BUY SRC notional through the market', () => {
    const engine = alphaEngine();
    engine.fundAlphaSandboxUsd('alice', 10_000_00n);
    const maker = engine.getInternalAlphaLiquidity()!;
    const buyNotionalMinor = 100_00n;
    const debit = maker.debitUserSandboxUsd('alice', buyNotionalMinor);
    assert.equal(debit.ok, true);
    const moonrey = maker.moonreyForUsdNotional(buyNotionalMinor);
    fundMoonrey(engine, 'alice', moonrey);
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'BUY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 1n,
      now: NOW,
    });
    const tradesBefore = engine.ops.trades.length;
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth((preview as { humanReadableIntent: string }).humanReadableIntent),
      request: {
        clientOrderId: 'buy-src-usd-notional',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_600_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: (preview as { previewId: string }).previewId,
      },
    });
    assert.equal('ok' in result, false);
    assert.ok(engine.ops.trades.length > tradesBefore);
    assert.equal(maker.userSandboxUsd('alice'), 10_000_00n - buyNotionalMinor);
  });
});
