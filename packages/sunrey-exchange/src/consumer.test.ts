import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { SUNREY_MOONREY_MARKET_ID } from './ids.ts';
import {
  CONSUMER_QUOTE_KINDS,
  CONSUMER_TRADING_RATE_POLICY,
  PUBLIC_API_RATE_LIMIT_PER_MINUTE,
  ConsumerExchangeEngine,
  consumerApi,
  createConsumerSandbox,
  defaultConsumerExchangePolicy,
  humanReadableTradeIntent,
  mapConsumerSettlementView,
  runConsumerExchangeCommand,
  sessionCannotSpend,
} from './consumer/index.ts';
import type { ConsumerAuthorization } from './consumer/types.ts';

const NOW = asUtcInstant('2026-08-18T14:00:00.000Z');
const LATER = asUtcInstant('2026-08-18T14:00:20.000Z');

function walletAuth(intentDisplay: string | null = null): ConsumerAuthorization {
  return Object.freeze({
    sessionId: 'cses_alice',
    sessionAuthenticated: true,
    wallet: Object.freeze({
      walletId: 'wallet_alice',
      signedIntentHex: 'signed-consumer-intent-aabbccddeeff',
      intentDisplay: intentDisplay ?? 'unsigned-preview',
      authorizationKind: 'WALLET_SIGNATURE' as const,
    }),
    origin: 'HUMAN',
    agentMandate: null,
  });
}

function sessionOnly(): ConsumerAuthorization {
  return Object.freeze({
    sessionId: 'cses_alice',
    sessionAuthenticated: true,
    wallet: null,
    origin: 'HUMAN',
    agentMandate: null,
  });
}

function readyEngine(overrides: ConstructorParameters<typeof ConsumerExchangeEngine>[0]['policy'] = undefined) {
  const engine = new ConsumerExchangeEngine({
    now: NOW,
    ...(overrides ? { policy: overrides } : {}),
  });
  engine.registerConsumer({ participantId: 'alice' });
  engine.seedLiquidity({
    participantId: 'maker',
    side: 'SELL',
    quantity: 50n,
    priceUnits: 2_500_000n,
    now: NOW,
  });
  return engine;
}

describe('chunk 99 consumer market view and quotes', () => {
  it('exposes SUNREY/MOONREY without a fixed rate and does not invent statistics', () => {
    const engine = readyEngine();
    const market = engine.getConsumerMarket(NOW);
    assert.equal(market.baseAsset, 'SUNREY_COIN');
    assert.equal(market.quoteAsset, 'MOONREY_COIN');
    assert.equal(market.fixedExchangeRate, false);
    assert.equal(market.statistics.valid, false);
    assert.equal(market.statistics.reason, 'INSUFFICIENT_HISTORY');
    assert.equal(market.confidentialSurveillanceExposed, false);
    assert.deepEqual([...CONSUMER_QUOTE_KINDS], ['INDICATIVE', 'EXECUTABLE']);
  });

  it('labels order-book estimates as INDICATIVE, never guaranteed', () => {
    const engine = readyEngine();
    const quote = engine.getConsumerQuote({
      participantId: 'alice',
      side: 'BUY',
      quantity: 2n,
      kind: 'EXECUTABLE',
      now: NOW,
    });
    assert.equal('ok' in quote, false);
    if ('ok' in quote) {
      throw new Error('expected quote');
    }
    assert.equal(quote.kind, 'INDICATIVE');
    assert.equal(quote.guaranteedExecution, false);
    assert.equal(quote.informational, true);
    assert.ok(quote.marketDataSequence >= 0n);
  });

  it('rejects client-cached market data as the quote authority', () => {
    const engine = readyEngine();
    const quote = engine.getConsumerQuote({
      participantId: 'alice',
      side: 'BUY',
      quantity: 1n,
      now: NOW,
      clientCachedMarketData: true,
    });
    assert.equal('ok' in quote && quote.ok === false && quote.reason === 'CLIENT_CACHE_NOT_AUTHORITATIVE', true);
  });
});

describe('chunk 99 trade preview, buy/sell/convert, and price protection', () => {
  it('builds a preview with human-readable intent, fees, and custody effect', () => {
    const engine = readyEngine();
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'BUY',
      side: 'BUY',
      orderType: 'MARKET_WITH_PROTECTION',
      quantity: 2n,
      protectionBps: 300n,
      now: NOW,
    });
    assert.equal('ok' in preview, false);
    if ('ok' in preview) {
      throw new Error('expected preview');
    }
    assert.match(preview.humanReadableIntent, /Review before authorization/);
    assert.equal(preview.estimatedFee.productionRatesInvented, false);
    assert.equal(preview.riskDisclosure.noGuaranteedPrice, true);
    assert.equal(preview.priceProtection?.guaranteed, false);
    assert.equal(preview.assetReceived, 'SUNREY_COIN');
    assert.equal(preview.assetSpent, 'MOONREY_COIN');
  });

  it('maps convert onto protected market-style execution', () => {
    const engine = new ConsumerExchangeEngine({ now: NOW });
    engine.registerConsumer({ participantId: 'alice' });
    engine.seedLiquidity({
      participantId: 'bidder',
      side: 'BUY',
      quantity: 10n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    engine.creditSimulationHolding(engine.profiles.get('alice')!.accountId, 'SUNREY_COIN', 10n);
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'CONVERT',
      side: 'SELL',
      orderType: 'MARKET_WITH_PROTECTION',
      quantity: 1n,
      protectionBps: 300n,
      now: NOW,
    });
    assert.equal('ok' in preview, false);
    if ('ok' in preview) {
      throw new Error('expected preview');
    }
    const result = engine.submitConsumerConversion({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(preview.humanReadableIntent),
      request: {
        clientOrderId: 'cvt-1',
        fromAsset: 'SUNREY_COIN',
        toAsset: 'MOONREY_COIN',
        quantity: 1n,
        priceProtectionBps: 300n,
        quoteId: null,
      },
    });
    assert.equal('ok' in result, false);
    if ('ok' in result) {
      throw new Error(result.reason);
    }
    assert.equal(result.side, 'SELL');
    assert.equal(result.orderType, 'MARKET_WITH_PROTECTION');
    assert.equal(result.matchingPriority, 'NONE');
  });

  it('enforces price protection and requires it on market-style orders', () => {
    const engine = new ConsumerExchangeEngine({ now: NOW });
    engine.registerConsumer({ participantId: 'alice' });
    engine.seedLiquidity({
      participantId: 'maker',
      side: 'SELL',
      quantity: 50n,
      priceUnits: 2_620_000n,
      now: NOW,
    });
    const missing = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'mwp-missing',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'MARKET_WITH_PROTECTION',
        quantity: 1n,
        limitPriceUnits: null,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in missing && missing.reason === 'PRICE_PROTECTION_REQUIRED', true);

    const tight = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'mwp-tight',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'MARKET_WITH_PROTECTION',
        quantity: 1n,
        limitPriceUnits: null,
        priceProtectionBps: 1n,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in tight && tight.reason === 'PRICE_PROTECTION_EXCEEDED', true);
  });

  it('submits a consumer limit order through the canonical engine', () => {
    const engine = readyEngine();
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'BUY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 1n,
      now: NOW,
    });
    assert.equal('ok' in preview, false);
    if ('ok' in preview) {
      throw new Error('expected preview');
    }
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(preview.humanReadableIntent),
      request: {
        clientOrderId: 'lim-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: preview.previewId,
      },
    });
    assert.equal('ok' in result, false);
    if ('ok' in result) {
      throw new Error(result.reason);
    }
    assert.ok(result.canonicalOrderId);
    assert.ok(['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'SUBMITTED'].includes(result.view));
  });
});

describe('chunk 99 wallet, mobile, and agent authorization', () => {
  it('rejects a session without financial authority', () => {
    const engine = readyEngine();
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: sessionOnly(),
      request: {
        clientOrderId: 'no-wallet',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'MARKET_WITH_PROTECTION',
        quantity: 1n,
        limitPriceUnits: null,
        priceProtectionBps: 300n,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in result && result.reason === 'SESSION_WITHOUT_FINANCIAL_AUTHORITY', true);
    assert.equal(sessionCannotSpend().sessionSufficientToSpend, false);
  });

  it('requires the human-readable intent before wallet authorization', () => {
    const text = humanReadableTradeIntent({
      flow: 'BUY',
      side: 'BUY',
      quantity: 1n,
      assetSpent: 'MOONREY_COIN',
      assetReceived: 'SUNREY_COIN',
      estimatedPrice: 2_500_000n,
      protectionBps: 300n,
    });
    assert.match(text, /Review before authorization/);
    const engine = readyEngine();
    const preview = engine.previewConsumerTrade({
      participantId: 'alice',
      flow: 'BUY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 1n,
      now: NOW,
    });
    assert.equal('ok' in preview, false);
    if ('ok' in preview) {
      throw new Error('expected preview');
    }
    const mismatch = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth('wrong intent text'),
      request: {
        clientOrderId: 'intent-mismatch',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: preview.previewId,
      },
    });
    assert.equal('ok' in mismatch && mismatch.reason === 'INTENT_DISPLAY_MISMATCH', true);
  });

  it('rejects an agent without a mandate and gives no matching priority with one', () => {
    const engine = readyEngine();
    const noMandate = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: {
        sessionId: 'cses_alice',
        sessionAuthenticated: true,
        wallet: walletAuth().wallet,
        origin: 'AGENT',
        agentMandate: null,
      },
      request: {
        clientOrderId: 'agent-none',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in noMandate && noMandate.reason === 'AGENT_MANDATE_REQUIRED', true);

    const withMandate = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: {
        sessionId: 'cses_alice',
        sessionAuthenticated: true,
        wallet: walletAuth().wallet,
        origin: 'AGENT',
        agentMandate: {
          mandateId: 'mandate-1',
          capability: 'CONSUMER_TRADE',
          matchingPriority: 'NONE',
          privilegedPrice: false,
        },
      },
      request: {
        clientOrderId: 'agent-ok',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in withMandate, false);
    if ('ok' in withMandate) {
      throw new Error(withMandate.reason);
    }
    assert.equal(withMandate.origin, 'AGENT');
    assert.equal(withMandate.matchingPriority, 'NONE');
  });
});

describe('chunk 99 eligibility, market state, stale quotes, and idempotency', () => {
  it('rejects the wrong jurisdiction', () => {
    const engine = new ConsumerExchangeEngine({ now: NOW });
    engine.registerConsumer({ participantId: 'alice', jurisdiction: 'XX' });
    engine.seedLiquidity({
      participantId: 'maker',
      side: 'SELL',
      quantity: 10n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'jur',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in result && result.reason === 'WRONG_JURISDICTION', true);
  });

  it('rejects a paused market and explains the circuit breaker safely', () => {
    const engine = readyEngine();
    engine.ops.transitionMarket({
      state: 'PAUSED',
      actorKind: 'HUMAN',
      reason: 'CIRCUIT_BREAKER',
      now: NOW,
    });
    const market = engine.getConsumerMarket(NOW);
    assert.match(market.circuitBreakerExplanation, /temporarily restricted/);
    assert.equal(market.confidentialSurveillanceExposed, false);
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'paused',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in result && result.reason === 'PAUSED_MARKET', true);
  });

  it('rejects a stale quote according to policy', () => {
    const engine = readyEngine();
    const quote = engine.getConsumerQuote({
      participantId: 'alice',
      side: 'BUY',
      quantity: 1n,
      now: NOW,
    });
    assert.equal('ok' in quote, false);
    if ('ok' in quote) {
      throw new Error('expected quote');
    }
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: LATER,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'stale',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'MARKET_WITH_PROTECTION',
        quantity: 1n,
        limitPriceUnits: null,
        priceProtectionBps: 300n,
        quoteId: quote.quoteId,
        previewId: null,
      },
    });
    assert.equal('ok' in result && result.reason === 'STALE_QUOTE', true);
  });

  it('reprices a stale quote when policy says REPRICE', () => {
    const engine = readyEngine(defaultConsumerExchangePolicy({ staleQuotePolicy: 'REPRICE' }));
    const quote = engine.getConsumerQuote({
      participantId: 'alice',
      side: 'BUY',
      quantity: 1n,
      now: NOW,
    });
    assert.equal('ok' in quote, false);
    if ('ok' in quote) {
      throw new Error('expected quote');
    }
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: LATER,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'reprice',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'MARKET_WITH_PROTECTION',
        quantity: 1n,
        limitPriceUnits: null,
        priceProtectionBps: 300n,
        quoteId: quote.quoteId,
        previewId: null,
      },
    });
    assert.equal('ok' in result, false);
  });

  it('replays a duplicate client order id', () => {
    const engine = readyEngine();
    const request = {
      clientOrderId: 'dup-1',
      marketId: SUNREY_MOONREY_MARKET_ID,
      flow: 'BUY' as const,
      side: 'BUY' as const,
      orderType: 'LIMIT' as const,
      quantity: 1n,
      limitPriceUnits: 2_500_000n,
      priceProtectionBps: null,
      quoteId: null,
      previewId: null,
    };
    const first = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request,
    });
    const second = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request,
    });
    assert.equal('ok' in first, false);
    assert.deepEqual(second, first);
  });

  it('blocks trading when the Exchange capability is inactive', () => {
    const engine = new ConsumerExchangeEngine({ now: NOW });
    engine.registerConsumer({ participantId: 'alice', exchangeCapabilityActive: false });
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'cap',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in result && result.reason === 'EXCHANGE_CAPABILITY_INACTIVE', true);
  });
});

describe('chunk 99 portfolio, settlement, sandbox, alerts, and privacy', () => {
  it('projects holdings from chain/custody without creating a second store', () => {
    const engine = readyEngine();
    engine.creditSimulationHolding(engine.profiles.get('alice')!.accountId, 'SUNREY_COIN', 7n);
    const denied = engine.getConsumerPortfolio({ participantId: 'alice', authenticated: false, now: NOW });
    assert.equal('ok' in denied && denied.reason === 'AUTH_REQUIRED', true);
    const portfolio = engine.getConsumerPortfolio({
      participantId: 'alice',
      authenticated: true,
      now: NOW,
      includeAnalytics: true,
    });
    assert.equal('ok' in portfolio, false);
    if ('ok' in portfolio) {
      throw new Error(portfolio.reason);
    }
    assert.equal(portfolio.createdIndependentStore, false);
    assert.equal(portfolio.productionLabel, 'SIMULATION');
    const sunrey = portfolio.holdings.find((row) => row.assetId === 'SUNREY_COIN');
    assert.equal(sunrey?.quantity, 7n);
    assert.equal(sunrey?.source, 'CHAIN');
    assert.equal(sunrey?.redemptionValueGuaranteed, false);
    assert.equal(portfolio.costBasis?.taxCorrectnessClaimed, false);
    assert.equal(portfolio.performance?.investmentPromise, false);
  });

  it('keeps sandbox portfolios marked non-production and blocks production trading', () => {
    const engine = readyEngine();
    const sandbox = engine.createSandbox('app-1', NOW);
    assert.equal(sandbox.productionLabel, 'NON_PRODUCTION');
    assert.equal(sandbox.canTradeProduction, false);
    const standalone = createConsumerSandbox({ appId: 'app-2', label: 'retail' });
    assert.equal(standalone.syntheticAssetsOnly, true);
    const result = engine.submitConsumerTrade({
      participantId: sandbox.account.sandboxId,
      now: NOW,
      targetEnvironment: 'PRODUCTION',
      authorization: walletAuth(),
      request: {
        clientOrderId: 'sbx',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in result && result.reason === 'SANDBOX_CANNOT_TRADE_PRODUCTION', true);
  });

  it('does not let a price alert trade by itself', () => {
    const engine = readyEngine();
    const rejected = engine.createPriceAlert({
      participantId: 'alice',
      direction: 'ABOVE',
      thresholdPriceUnits: 1n,
      now: NOW,
      autoTrade: true,
    });
    assert.equal('ok' in rejected && rejected.reason === 'PRICE_ALERT_CANNOT_TRADE', true);
    const alert = engine.createPriceAlert({
      participantId: 'alice',
      direction: 'ABOVE',
      thresholdPriceUnits: 1n,
      now: NOW,
    });
    assert.equal('ok' in alert, false);
    if ('ok' in alert) {
      throw new Error(alert.reason);
    }
    assert.equal(alert.canTradeAutomatically, false);
    assert.equal(alert.informational, true);
    assert.ok(alert.marketDataSequence >= 0n);
  });

  it('rejects a withdrawal security bypass and uses canonical deposit addresses', () => {
    const engine = readyEngine();
    const deposit = engine.depositReference('alice');
    assert.equal(deposit.source, 'CANONICAL_CUSTODY');
    assert.match(deposit.address, /^sr1ex_/);
    const bypass = engine.requestWithdrawal({
      participantId: 'alice',
      assetId: 'SUNREY_COIN',
      quantity: 1n,
      destination: 'sr1dest',
      bypassSecurity: true,
    });
    assert.equal(bypass.ok, false);
    if (bypass.ok) {
      throw new Error('expected bypass rejection');
    }
    assert.equal(bypass.reason, 'WITHDRAWAL_BYPASS_REJECTED');
  });

  it('binds a filled order to a DVP receipt and maps settlement states without duplicates', () => {
    assert.equal(mapConsumerSettlementView('MATCHED'), 'TRADE_MATCHED');
    assert.equal(mapConsumerSettlementView('SETTLEMENT_CREATED'), 'SETTLEMENT_PENDING');
    assert.equal(mapConsumerSettlementView('SUBMITTED'), 'SETTLEMENT_PENDING');
    assert.equal(mapConsumerSettlementView('SUBMISSION_UNKNOWN'), 'SUBMISSION_UNKNOWN');
    assert.equal(mapConsumerSettlementView('FINALIZED'), 'FINALIZED');
    assert.equal(mapConsumerSettlementView('NONE'), 'SETTLEMENT_PENDING');

    const engine = readyEngine();
    const result = engine.submitConsumerTrade({
      participantId: 'alice',
      now: NOW,
      authorization: walletAuth(),
      request: {
        clientOrderId: 'dvp-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: 'BUY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        limitPriceUnits: 2_500_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: null,
      },
    });
    assert.equal('ok' in result, false);
    if ('ok' in result) {
      throw new Error(result.reason);
    }
    assert.ok(['FILLED', 'PARTIALLY_FILLED', 'OPEN', 'SUBMITTED'].includes(result.view));
    if (result.orderId && (result.view === 'FILLED' || result.view === 'PARTIALLY_FILLED')) {
      const receipt = engine.getConsumerTradeReceipt(result.orderId);
      assert.ok(receipt);
      assert.ok(receipt.fills.length >= 1);
      assert.equal(receipt.fees.productionRatesInvented, false);
      assert.ok(receipt.marketPolicyVersion >= 1);
    }
    const portfolio = engine.getConsumerPortfolio({
      participantId: 'alice',
      authenticated: true,
      now: NOW,
    });
    assert.equal('ok' in portfolio, false);
    if ('ok' in portfolio) {
      throw new Error(portfolio.reason);
    }
    assert.ok(portfolio.pendingSettlement.every((row) => row.duplicateInstructionCreated === false));
    const report = engine.reconcile();
    assert.equal(report.balancingEntries, false);
    assert.equal(report.portfolioCreatedBalance, false);
    assert.ok(report.projectionHoldings >= 1);
    assert.ok(report.dvpIntents >= 0);
  });

  it('does not expose a private portfolio on the explorer view', () => {
    const engine = readyEngine();
    const market = engine.getConsumerMarket(NOW);
    const publicView = engine.explorerPublicView(market);
    assert.equal(publicView.portfolioExposed, false);
    assert.equal('holdings' in publicView, false);
  });

  it('keeps trading controls distinct from ordinary developer API quotas', () => {
    assert.equal(CONSUMER_TRADING_RATE_POLICY.distinctFromDeveloperQuota, true);
    assert.equal(CONSUMER_TRADING_RATE_POLICY.distinctFromPublicRpcQuota, true);
    assert.notEqual(CONSUMER_TRADING_RATE_POLICY.ordersPerMinute, PUBLIC_API_RATE_LIMIT_PER_MINUTE);
    assert.equal(defaultConsumerExchangePolicy().developerQuotaAuthorizesTrading, false);
    assert.equal(defaultConsumerExchangePolicy().publicApiRateLimitPerMinute, PUBLIC_API_RATE_LIMIT_PER_MINUTE);
  });

  it('keeps production consumer trading gated', () => {
    const engine = readyEngine();
    const activation = engine.productionActivation({ LEGAL: true });
    assert.equal(activation.productionActivated, false);
    assert.equal(activation.consumerTradingAvailable, false);
    assert.equal(activation.liveFlagsRemainDisabled, true);
  });

  it('exposes the documented SDK/API surface and CLI', () => {
    assert.equal(typeof consumerApi.getConsumerPortfolio, 'function');
    assert.equal(typeof consumerApi.getConsumerMarket, 'function');
    assert.equal(typeof consumerApi.getConsumerQuote, 'function');
    assert.equal(typeof consumerApi.previewConsumerTrade, 'function');
    assert.equal(typeof consumerApi.submitConsumerTrade, 'function');
    assert.equal(typeof consumerApi.cancelConsumerOrder, 'function');
    assert.equal(typeof consumerApi.getConsumerOrder, 'function');
    assert.equal(typeof consumerApi.getConsumerTradeReceipt, 'function');
    assert.equal(typeof consumerApi.createPriceAlert, 'function');
    const engine = readyEngine();
    const cli = runConsumerExchangeCommand(engine, ['consumer-report'], NOW);
    assert.equal(cli.ok, true);
  });

  it('notifies on market restriction without leaking surveillance data', () => {
    const engine = readyEngine();
    engine.ops.transitionMarket({
      state: 'RESTRICTED',
      actorKind: 'SECURITY_AUTHORITY',
      reason: 'OPERATOR',
      now: NOW,
    });
    engine.notifyMarketRestriction(NOW);
    const notes = engine.notifications.list('alice');
    assert.ok(notes.some((note) => note.kind === 'MARKET_RESTRICTION'));
    assert.ok(notes.every((note) => note.confidentialSurveillance === false));
  });
});
