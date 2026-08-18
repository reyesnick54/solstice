import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
  asExchangeAccountId,
  type ExchangeAccountId,
  type OrderId,
} from '../ids.ts';
import { measureLiquidity } from '../ops/liquidity.ts';
import { resolveReferencePrice } from '../ops/reference-price.ts';
import { MarketOperationsEngine } from '../ops/engine.ts';
import type { InstitutionalOrderRequest, TradingCredential, TradingSession } from '../ops/types.ts';
import { createFavoriteMarket, createPriceAlert, alertTriggered } from './alerts.ts';
import { evaluateConsumerAuthorization } from './authorization.ts';
import { evaluateConsumerEligibility } from './eligibility.ts';
import {
  InMemoryConsumerNotificationPort,
  consumerNotification,
  type ConsumerNotificationPort,
} from './notifications.ts';
import { CONSUMER_TRADING_RATE_POLICY, defaultConsumerExchangePolicy, type ConsumerExchangePolicy } from './policy.ts';
import { projectPortfolio } from './portfolio.ts';
import { buildConsumerTradePreview, conversionSide, protectionBreached } from './preview.ts';
import { buildConsumerQuote, quoteIsStale, walkBookEstimate } from './quotes.ts';
import { createConsumerSandbox, type ConsumerSandboxContext } from './sandbox.ts';
import {
  circuitBreakerSafeExplanation,
  consumerOrderTypeToOperational,
  mapOrderStatusView,
  type ConsumerEnvironment,
  type ConsumerFlow,
  type ConsumerNativeAsset,
  type ConsumerOrderType,
  type ConsumerQuoteKind,
  type ConsumerSettlementView,
  type LiquidityWarningCode,
  type ValueSourceKind,
} from './taxonomy.ts';
import type {
  ConsumerAuthorization,
  ConsumerConversionRequest,
  ConsumerEligibilityDecision,
  ConsumerExchangeReport,
  ConsumerFavoriteMarket,
  ConsumerMarketView,
  ConsumerMobileView,
  ConsumerOrderRequest,
  ConsumerOrderStatus,
  ConsumerPortfolioProjection,
  ConsumerPriceAlert,
  ConsumerQuote,
  ConsumerReconciliationReport,
  ConsumerSettlementProjection,
  ConsumerTradePreview,
  ConsumerTradeReceipt,
  ConsumerTradingProfile,
} from './types.ts';

export type ConsumerEnginePorts = {
  readonly ops?: MarketOperationsEngine;
  readonly notifications?: ConsumerNotificationPort;
};

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

class ConsumerRateLimiter {
  private readonly buckets = new Map<string, { readonly resetAt: number; count: number }>();
  private readonly perMinute: number;
  constructor(perMinute: number) {
    this.perMinute = perMinute;
  }
  consume(key: string, nowMs: number): { readonly allowed: boolean } {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= nowMs) {
      this.buckets.set(key, { resetAt: nowMs + 60_000, count: 1 });
      return { allowed: true };
    }
    if (existing.count >= this.perMinute) {
      return { allowed: false };
    }
    existing.count += 1;
    return { allowed: true };
  }
}

export class ConsumerExchangeEngine {
  readonly policy: ConsumerExchangePolicy;
  readonly ops: MarketOperationsEngine;
  readonly notifications: ConsumerNotificationPort;
  readonly profiles = new Map<string, ConsumerTradingProfile>();
  readonly sessions = new Map<string, { participantId: string; authenticated: boolean }>();
  readonly quotes = new Map<string, ConsumerQuote>();
  readonly previews = new Map<string, ConsumerTradePreview>();
  readonly orders = new Map<string, ConsumerOrderStatus>();
  readonly ordersByClient = new Map<string, string>();
  readonly receipts = new Map<string, ConsumerTradeReceipt>();
  readonly favorites = new Map<string, ConsumerFavoriteMarket>();
  readonly alerts = new Map<string, ConsumerPriceAlert>();
  readonly sandboxes: ConsumerSandboxContext[] = [];
  readonly tradingLimiter = new ConsumerRateLimiter(CONSUMER_TRADING_RATE_POLICY.ordersPerMinute);
  readonly publicLimiter = new ConsumerRateLimiter(60);
  readonly opsBindings = new Map<
    string,
    { readonly credential: TradingCredential; session: TradingSession }
  >();
  private seq = 0n;

  constructor(input: { readonly now: UtcInstant; readonly policy?: ConsumerExchangePolicy; readonly ports?: ConsumerEnginePorts }) {
    this.policy = input.policy ?? defaultConsumerExchangePolicy();
    this.ops = input.ports?.ops ?? new MarketOperationsEngine({ now: input.now });
    this.notifications = input.ports?.notifications ?? new InMemoryConsumerNotificationPort();
  }

  nativeMarketId() {
    return this.policy.nativeMarket.marketId;
  }

  registerConsumer(input: {
    readonly participantId: string;
    readonly jurisdiction?: string;
    readonly accountStatus?: ConsumerTradingProfile['accountStatus'];
    readonly custodyReady?: boolean;
    readonly walletReady?: boolean;
    readonly complianceState?: ConsumerTradingProfile['complianceState'];
    readonly environment?: ConsumerEnvironment;
    readonly exchangeCapabilityActive?: boolean;
    readonly reservation?: bigint;
  }): ConsumerTradingProfile {
    const registered = this.ops.registerParticipant({
      participantId: input.participantId,
      reservation: input.reservation ?? 1_000_000_000n,
    });
    const profile: ConsumerTradingProfile = Object.freeze({
      profileId: `cprof_${input.participantId}`,
      participantId: input.participantId,
      accountId: registered.accountId,
      identityClass: 'RETAIL',
      jurisdiction: input.jurisdiction ?? 'GB',
      accountStatus: input.accountStatus ?? 'ACTIVE_SIMULATION',
      custodyReady: input.custodyReady ?? true,
      walletReady: input.walletReady ?? true,
      complianceState: input.complianceState ?? 'CLEAR',
      environment: input.environment ?? 'SIMULATION',
      exchangeCapabilityActive: input.exchangeCapabilityActive ?? true,
    });
    this.profiles.set(input.participantId, profile);
    this.sessions.set(`cses_${input.participantId}`, { participantId: input.participantId, authenticated: true });
    this.opsBindings.set(input.participantId, {
      credential: registered.credential,
      session: this.ops.openTradingSession(registered.credential, this.ops.createdAt),
    });
    return profile;
  }

  openApiSession(participantId: string): { readonly sessionId: string; readonly financialAuthority: false } {
    const sessionId = `cses_${participantId}`;
    this.sessions.set(sessionId, { participantId, authenticated: true });
    return Object.freeze({ sessionId, financialAuthority: false });
  }

  seedLiquidity(input: {
    readonly participantId: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantity: bigint;
    readonly priceUnits: bigint;
    readonly now: UtcInstant;
  }): void {
    const registered = this.ops.registerParticipant({
      participantId: input.participantId,
      reservation: 10_000_000_000n,
    });
    const session = this.ops.openTradingSession(registered.credential, input.now);
    this.ops.enterOrder(
      session.sessionId,
      session.inboundSeq + 1n,
      {
        clOrdId: id('liq'),
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: input.side,
        orderType: 'LIMIT',
        quantity: input.quantity,
        priceUnits: input.priceUnits,
      },
      input.now,
    );
  }

  creditSimulationHolding(accountId: ExchangeAccountId, asset: ConsumerNativeAsset, quantity: bigint): void {
    this.ops.clearing.faucetToCustody(
      accountId,
      asset === 'SUNREY_COIN' ? SUNREY_COIN_NATIVE_ASSET_ID : MOONREY_COIN_NATIVE_ASSET_ID,
      quantity,
    );
  }

  eligibility(participantId: string, marketId = SUNREY_MOONREY_MARKET_ID): ConsumerEligibilityDecision {
    const profile = this.requireProfile(participantId);
    return evaluateConsumerEligibility({
      profile,
      policy: this.policy,
      marketState: this.ops.marketState(marketId).state,
      marketId,
    });
  }

  getConsumerMarket(now: UtcInstant): ConsumerMarketView {
    const snapshot = this.ops.snapshot('DEPTH');
    const liquidity = measureLiquidity({
      marketId: this.nativeMarketId(),
      orders: [...this.ops.orders.values()],
      trades: this.ops.trades,
      marketMakerAccountIds: new Set(),
    });
    const tradeCount = BigInt(this.ops.trades.length);
    const statisticsValid = tradeCount >= this.policy.minTradesForStatistics;
    const prices = this.ops.trades.map((trade) => trade.price.priceUnits);
    const warnings = this.liquidityWarnings(liquidity.spreadUnits, liquidity.bidDepth, liquidity.askDepth, snapshot.state, false);
    this.seq = snapshot.sequence > this.seq ? snapshot.sequence : this.seq + 1n;
    return Object.freeze({
      marketId: this.nativeMarketId(),
      baseAsset: 'SUNREY_COIN',
      quoteAsset: 'MOONREY_COIN',
      fixedExchangeRate: false,
      lastEligibleTrade: snapshot.lastTradePrice,
      bestBid: snapshot.bestBid,
      bestAsk: snapshot.bestAsk,
      spreadUnits: liquidity.spreadUnits,
      statistics: Object.freeze({
        valid: statisticsValid,
        reason: statisticsValid ? 'OK' : 'INSUFFICIENT_HISTORY',
        tradeCount,
        volume: statisticsValid ? liquidity.turnover : null,
        highPriceUnits: statisticsValid && prices.length > 0 ? prices.reduce((a, b) => (a > b ? a : b)) : null,
        lowPriceUnits: statisticsValid && prices.length > 0 ? prices.reduce((a, b) => (a < b ? a : b)) : null,
      }),
      depthSummary: Object.freeze({ bidDepth: liquidity.bidDepth, askDepth: liquidity.askDepth }),
      marketState: snapshot.state,
      liquidityWarnings: warnings,
      dataTimestamp: now,
      marketDataSequence: snapshot.sequence,
      circuitBreakerExplanation: circuitBreakerSafeExplanation(snapshot.state),
      confidentialSurveillanceExposed: false,
    });
  }

  getConsumerQuote(input: {
    readonly participantId: string;
    readonly side: ConsumerQuote['side'];
    readonly quantity: bigint;
    readonly notional?: bigint | null;
    readonly kind?: ConsumerQuoteKind;
    readonly now: UtcInstant;
    readonly clientCachedMarketData?: boolean;
  }): ConsumerQuote | { readonly ok: false; readonly reason: string } {
    if (input.clientCachedMarketData) {
      return Object.freeze({ ok: false, reason: 'CLIENT_CACHE_NOT_AUTHORITATIVE' });
    }
    const gate = this.eligibility(input.participantId);
    if (!gate.allowed && gate.reasonCodes.includes('WRONG_JURISDICTION')) {
      return Object.freeze({ ok: false, reason: 'WRONG_JURISDICTION' });
    }
    const quote = buildConsumerQuote({
      quoteId: id('cquote'),
      marketId: this.nativeMarketId(),
      side: input.side,
      quantity: input.quantity,
      notional: input.notional ?? null,
      requestedKind: input.kind ?? 'INDICATIVE',
      orders: [...this.ops.orders.values()],
      policy: this.policy,
      sequence: this.ops.snapshot('BBO').sequence,
      now: input.now,
    });
    this.quotes.set(quote.quoteId, quote);
    return quote;
  }

  previewConsumerTrade(input: {
    readonly participantId: string;
    readonly flow: ConsumerFlow;
    readonly side: ConsumerQuote['side'];
    readonly orderType: ConsumerOrderType;
    readonly quantity: bigint;
    readonly protectionBps?: bigint | null;
    readonly quoteId?: string | null;
    readonly now: UtcInstant;
  }): ConsumerTradePreview | { readonly ok: false; readonly reason: string; readonly reasonCodes: readonly string[] } {
    const gate = this.eligibility(input.participantId);
    if (!gate.allowed) {
      return Object.freeze({ ok: false, reason: gate.reasonCodes[0] ?? 'INELIGIBLE', reasonCodes: gate.reasonCodes });
    }
    const quote = input.quoteId ? this.quotes.get(input.quoteId) ?? null : null;
    const reference = this.reference();
    const preview = buildConsumerTradePreview({
      previewId: id('cprev'),
      flow: input.flow,
      side: input.side,
      orderType: input.orderType,
      quantity: input.quantity,
      protectionBps: input.protectionBps ?? null,
      quote,
      orders: [...this.ops.orders.values()],
      policy: this.policy,
      marketState: this.ops.marketState().state,
      referenceUnits: reference.priceUnits,
      referenceSource: (reference.source ?? 'UNAVAILABLE') as ValueSourceKind,
      sequence: this.ops.snapshot('BBO').sequence,
      now: input.now,
    });
    this.previews.set(preview.previewId, preview);
    return preview;
  }

  submitConsumerTrade(input: {
    readonly participantId: string;
    readonly request: ConsumerOrderRequest;
    readonly authorization: ConsumerAuthorization;
    readonly now: UtcInstant;
    readonly targetEnvironment?: ConsumerEnvironment;
  }): ConsumerOrderStatus | { readonly ok: false; readonly reason: string; readonly reasonCodes: readonly string[] } {
    const duplicate = this.ordersByClient.get(`${input.participantId}:${input.request.clientOrderId}`);
    if (duplicate) {
      const existing = this.orders.get(duplicate);
      if (existing) {
        return existing;
      }
    }
    const profile = this.requireProfile(input.participantId);
    if (profile.environment === 'SANDBOX' && (input.targetEnvironment === 'PRODUCTION' || this.policy.productionActivated)) {
      return this.reject('SANDBOX_CANNOT_TRADE_PRODUCTION');
    }
    const gate = this.eligibility(input.participantId, input.request.marketId);
    if (!gate.allowed) {
      return this.reject(gate.reasonCodes[0] ?? 'INELIGIBLE', gate.reasonCodes);
    }
    const preview = input.request.previewId ? this.previews.get(input.request.previewId) ?? null : null;
    const auth = evaluateConsumerAuthorization({
      profile,
      authorization: input.authorization,
      expectedIntentDisplay: preview?.humanReadableIntent ?? null,
    });
    if (!auth.allowed) {
      return this.reject(auth.reasonCodes[0] ?? 'UNAUTHORIZED', auth.reasonCodes);
    }
    if (input.request.orderType === 'MARKET_WITH_PROTECTION' && input.request.priceProtectionBps === null) {
      return this.reject('PRICE_PROTECTION_REQUIRED');
    }
    const quote = input.request.quoteId ? this.quotes.get(input.request.quoteId) ?? null : null;
    if (quote && quoteIsStale(quote, input.now)) {
      if (this.policy.staleQuotePolicy === 'REJECT') {
        return this.reject('STALE_QUOTE');
      }
    }
    const estimate = walkBookEstimate({
      side: input.request.side,
      quantity: input.request.quantity,
      orders: [...this.ops.orders.values()],
    });
    const previewOrFresh =
      preview ??
      (this.previewConsumerTrade({
        participantId: input.participantId,
        flow: input.request.flow,
        side: input.request.side,
        orderType: input.request.orderType,
        quantity: input.request.quantity,
        protectionBps: input.request.priceProtectionBps,
        quoteId: input.request.quoteId,
        now: input.now,
      }) as ConsumerTradePreview);
    if ('ok' in previewOrFresh) {
      return previewOrFresh;
    }
    if (protectionBreached(previewOrFresh.priceProtection, estimate.estimatedPriceUnits, input.request.side)) {
      return this.reject('PRICE_PROTECTION_EXCEEDED');
    }
    const rate = this.tradingLimiter.consume(`trade:${input.participantId}`, Date.parse(input.now));
    if (!rate.allowed) {
      return this.reject('TRADING_RATE_LIMIT');
    }
    const binding = this.requireOpsBinding(input.participantId);
    const inbound: InstitutionalOrderRequest = {
      clOrdId: input.request.clientOrderId,
      marketId: input.request.marketId,
      side: input.request.side,
      orderType: consumerOrderTypeToOperational(input.request.orderType),
      quantity: input.request.quantity,
      priceUnits: input.request.limitPriceUnits,
    };
    const ack = this.ops.enterOrder(binding.session.sessionId, binding.session.inboundSeq + 1n, inbound, input.now);
    binding.session = this.ops.gateway.authenticate(binding.session.sessionId);
    const status: ConsumerOrderStatus = Object.freeze({
      clientOrderId: input.request.clientOrderId,
      orderId: ack.orderId,
      canonicalOrderId: ack.orderId,
      view: mapOrderStatusView(ack.status),
      side: input.request.side,
      orderType: input.request.orderType,
      quantity: input.request.quantity,
      remaining: ack.order?.remaining.scaledUnits ?? input.request.quantity,
      marketId: input.request.marketId,
      environment: profile.environment,
      origin: input.authorization.origin,
      matchingPriority: 'NONE',
      order: ack.order,
    });
    if (ack.outcome === 'REJECT') {
      return this.reject(ack.reason ?? 'REJECTED');
    }
    this.orders.set(status.orderId ?? input.request.clientOrderId, status);
    this.ordersByClient.set(`${input.participantId}:${input.request.clientOrderId}`, status.orderId ?? input.request.clientOrderId);
    this.notifications.publish(
      consumerNotification({
        kind: status.view === 'PARTIALLY_FILLED' ? 'PARTIAL_FILL' : status.view === 'FILLED' ? 'FILLED' : 'ORDER_ACCEPTED',
        participantId: input.participantId,
        body: `Order ${input.request.clientOrderId} ${status.view}`,
        now: input.now,
      }),
    );
    if (ack.order && (ack.order.status === 'FILLED' || ack.order.status === 'PARTIALLY_FILLED')) {
      this.recordReceipt(input.participantId, status, input.request.clientOrderId, input.now);
    }
    return status;
  }

  submitConsumerConversion(input: {
    readonly participantId: string;
    readonly request: ConsumerConversionRequest;
    readonly authorization: ConsumerAuthorization;
    readonly now: UtcInstant;
  }): ReturnType<ConsumerExchangeEngine['submitConsumerTrade']> {
    const side = conversionSide(input.request.fromAsset, input.request.toAsset);
    return this.submitConsumerTrade({
      participantId: input.participantId,
      authorization: input.authorization,
      now: input.now,
      request: {
        clientOrderId: input.request.clientOrderId,
        marketId: this.nativeMarketId(),
        flow: 'CONVERT',
        side,
        orderType: 'MARKET_WITH_PROTECTION',
        quantity: input.request.quantity,
        limitPriceUnits: null,
        priceProtectionBps: input.request.priceProtectionBps,
        quoteId: input.request.quoteId,
        previewId: null,
      },
    });
  }

  cancelConsumerOrder(input: {
    readonly participantId: string;
    readonly clientOrderId: string;
    readonly authorization: ConsumerAuthorization;
    readonly now: UtcInstant;
  }): ConsumerOrderStatus | { readonly ok: false; readonly reason: string; readonly reasonCodes: readonly string[] } {
    const profile = this.requireProfile(input.participantId);
    const auth = evaluateConsumerAuthorization({
      profile,
      authorization: input.authorization,
      expectedIntentDisplay: null,
    });
    if (!auth.allowed) {
      return this.reject(auth.reasonCodes[0] ?? 'UNAUTHORIZED', auth.reasonCodes);
    }
    const key = this.ordersByClient.get(`${input.participantId}:${input.clientOrderId}`);
    const existing = key ? this.orders.get(key) : undefined;
    if (!existing?.orderId) {
      return this.reject('UNKNOWN_ORDER');
    }
    const binding = this.requireOpsBinding(input.participantId);
    const ack = this.ops.cancelOrder(
      binding.session.sessionId,
      binding.session.inboundSeq + 1n,
      {
        clOrdId: `cxl_${input.clientOrderId}`,
        origClOrdId: input.clientOrderId,
        marketId: existing.marketId,
        side: existing.side,
        orderType: 'LIMIT',
        quantity: existing.quantity,
        priceUnits: null,
      },
      input.now,
    );
    binding.session = this.ops.gateway.authenticate(binding.session.sessionId);
    const next: ConsumerOrderStatus = Object.freeze({
      ...existing,
      view: ack.outcome === 'ACK' ? 'CANCELLED' : existing.view,
      order: ack.order ?? existing.order,
      remaining: ack.order?.remaining.scaledUnits ?? existing.remaining,
    });
    this.orders.set(existing.orderId, next);
    this.notifications.publish(
      consumerNotification({
        kind: 'CANCELLED',
        participantId: input.participantId,
        body: `Order ${input.clientOrderId} cancelled`,
        now: input.now,
      }),
    );
    return next;
  }

  getConsumerOrder(participantId: string, clientOrderId: string): ConsumerOrderStatus | null {
    const key = this.ordersByClient.get(`${participantId}:${clientOrderId}`);
    return key ? (this.orders.get(key) ?? null) : null;
  }

  getConsumerTradeReceipt(orderId: string): ConsumerTradeReceipt | null {
    return this.receipts.get(orderId) ?? null;
  }

  getConsumerPortfolio(input: {
    readonly participantId: string;
    readonly authenticated: boolean;
    readonly now: UtcInstant;
    readonly includeAnalytics?: boolean;
  }): ConsumerPortfolioProjection | { readonly ok: false; readonly reason: string } {
    if (!input.authenticated) {
      return Object.freeze({ ok: false, reason: 'AUTH_REQUIRED' });
    }
    const profile = this.requireProfile(input.participantId);
    const reference = this.reference();
    const openOrders = [...this.orders.values()].filter(
      (order) => order.view === 'OPEN' || order.view === 'PARTIALLY_FILLED' || order.view === 'SUBMITTED',
    );
    const fills = [...this.receipts.values()].flatMap((receipt) => receipt.fills);
    const pending = this.settlementProjections(profile.accountId);
    return projectPortfolio({
      engine: this.ops.clearing,
      accountId: profile.accountId,
      environment: profile.environment,
      referenceUnits: reference.priceUnits,
      valueSource: (reference.source ?? 'UNAVAILABLE') as ValueSourceKind,
      openOrders,
      fills,
      pendingSettlement: pending,
      now: input.now,
      includeCostBasis: input.includeAnalytics ?? false,
    });
  }

  favoriteMarket(participantId: string, marketId = SUNREY_MOONREY_MARKET_ID): ConsumerFavoriteMarket {
    const favorite = createFavoriteMarket({ participantId, marketId });
    this.favorites.set(favorite.favoriteId, favorite);
    return favorite;
  }

  createPriceAlert(input: {
    readonly participantId: string;
    readonly direction: 'ABOVE' | 'BELOW';
    readonly thresholdPriceUnits: bigint;
    readonly now: UtcInstant;
    readonly autoTrade?: boolean;
  }): ConsumerPriceAlert | { readonly ok: false; readonly reason: string } {
    const created = createPriceAlert({
      participantId: input.participantId,
      marketId: this.nativeMarketId(),
      direction: input.direction,
      thresholdPriceUnits: input.thresholdPriceUnits,
      source: (this.reference().source ?? 'UNAVAILABLE') as ValueSourceKind,
      marketDataSequence: this.ops.snapshot('BBO').sequence,
      now: input.now,
      autoTrade: input.autoTrade,
    });
    if (!created.ok) {
      return created;
    }
    this.alerts.set(created.alert.alertId, created.alert);
    return created.alert;
  }

  evaluatePriceAlerts(now: UtcInstant): readonly ConsumerPriceAlert[] {
    const price = this.ops.snapshot('TRADES').lastTradePrice;
    if (price === null) {
      return [];
    }
    const fired: ConsumerPriceAlert[] = [];
    for (const alert of this.alerts.values()) {
      if (alertTriggered(alert, price)) {
        fired.push(alert);
        this.notifications.publish(
          consumerNotification({
            kind: 'PRICE_ALERT',
            participantId: alert.participantId,
            body: `Informational price alert ${alert.alertId} at ${price.toString()}`,
            now,
          }),
        );
      }
    }
    return fired;
  }

  depositReference(participantId: string): { readonly address: string; readonly source: 'CANONICAL_CUSTODY' } {
    const profile = this.requireProfile(participantId);
    return Object.freeze({
      address: this.ops.clearing.allocateDepositAddress(profile.accountId),
      source: 'CANONICAL_CUSTODY',
    });
  }

  requestWithdrawal(input: {
    readonly participantId: string;
    readonly assetId: ConsumerNativeAsset;
    readonly quantity: bigint;
    readonly destination: string;
    readonly bypassSecurity?: boolean;
  }): { readonly ok: true; readonly withdrawalId: string } | { readonly ok: false; readonly reason: string } {
    if (input.bypassSecurity || input.destination === 'BYPASS') {
      return Object.freeze({ ok: false, reason: 'WITHDRAWAL_BYPASS_REJECTED' });
    }
    const profile = this.requireProfile(input.participantId);
    try {
      const withdrawal = this.ops.clearing.requestWithdrawal(
        profile.accountId,
        input.assetId === 'SUNREY_COIN' ? SUNREY_COIN_NATIVE_ASSET_ID : MOONREY_COIN_NATIVE_ASSET_ID,
        input.quantity,
        input.destination,
      );
      return Object.freeze({ ok: true, withdrawalId: withdrawal.withdrawalId });
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as { code: string }).code) : 'WITHDRAWAL_REJECTED';
      return Object.freeze({ ok: false, reason: code });
    }
  }

  explorerPublicView(market: ConsumerMarketView): Readonly<Record<string, string | boolean | null>> {
    return Object.freeze({
      marketId: market.marketId,
      state: market.marketState,
      lastTrade: market.lastEligibleTrade?.toString() ?? null,
      portfolioExposed: false,
    });
  }

  createSandbox(appId: string, now: UtcInstant): ConsumerSandboxContext {
    const sandbox = createConsumerSandbox({ appId, label: 'consumer-trading', now });
    this.sandboxes.push(sandbox);
    this.registerConsumer({
      participantId: sandbox.account.sandboxId,
      environment: 'SANDBOX',
      jurisdiction: 'SIMULATION',
    });
    return sandbox;
  }

  notifyMarketRestriction(now: UtcInstant): void {
    const state = this.ops.marketState().state;
    for (const profile of this.profiles.values()) {
      this.notifications.publish(
        consumerNotification({
          kind: 'MARKET_RESTRICTION',
          participantId: profile.participantId,
          body: circuitBreakerSafeExplanation(state),
          now,
        }),
      );
    }
  }

  reconcile(): ConsumerReconciliationReport {
    const native = this.ops.reconcile();
    const chainHoldings = [...this.ops.clearing.accounts.values()].reduce((sum, account) => {
      const sun = this.ops.clearing.position(account.accountId, SUNREY_COIN_NATIVE_ASSET_ID);
      const moon = this.ops.clearing.position(account.accountId, MOONREY_COIN_NATIVE_ASSET_ID);
      return sum + sun.finalized + moon.finalized;
    }, 0n);
    return Object.freeze({
      projectionHoldings: this.profiles.size,
      exchangeReservations: native.reservations,
      trades: native.trades,
      dvpIntents: native.settlementIntents,
      custodyAttributed: native.custodyAttribution,
      chainHoldings,
      outcome: native.outcome,
      notes: native.notes,
      balancingEntries: false,
      portfolioCreatedBalance: false,
    });
  }

  report(): ConsumerExchangeReport {
    return Object.freeze({
      marketId: this.nativeMarketId(),
      marketState: this.ops.marketState().state,
      openOrders: [...this.orders.values()].filter((order) => order.view === 'OPEN' || order.view === 'PARTIALLY_FILLED').length,
      alerts: this.alerts.size,
      notifications: 'rows' in this.notifications ? this.notifications.rows.length : 0,
      sandboxAccounts: this.sandboxes.length,
      productionActivated: false,
      secretsPresent: false,
    });
  }

  productionActivation(gates: Parameters<MarketOperationsEngine['productionActivation']>[0] = {}) {
    const activation = this.ops.productionActivation(gates);
    return Object.freeze({
      ...activation,
      consumerTradingAvailable: false,
    });
  }

  toMobileView<T extends object>(value: T): ConsumerMobileView<T> {
    const mobile: Record<string, string | boolean | null> = {};
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'bigint') {
        mobile[key] = child.toString();
      } else if (typeof child === 'boolean' || typeof child === 'string' || child === null) {
        mobile[key] = child;
      } else if (typeof child === 'number') {
        mobile[key] = String(child);
      }
    }
    return Object.freeze({ canonical: value, mobile: Object.freeze(mobile) });
  }

  private requireOpsBinding(participantId: string): { readonly credential: TradingCredential; session: TradingSession } {
    const binding = this.opsBindings.get(participantId);
    if (!binding) {
      throw Object.assign(new Error('UNKNOWN_CONSUMER'), { code: 'UNKNOWN_CONSUMER' });
    }
    return binding;
  }

  private requireProfile(participantId: string): ConsumerTradingProfile {
    const profile = this.profiles.get(participantId);
    if (!profile) {
      throw Object.assign(new Error('UNKNOWN_CONSUMER'), { code: 'UNKNOWN_CONSUMER' });
    }
    return profile;
  }

  private reference() {
    return resolveReferencePrice({
      lastEligibleTrade: this.ops.trades[this.ops.trades.length - 1] ?? null,
      resting: [...this.ops.orders.values()],
      approvedOraclePriceUnits: this.ops.oraclePrice,
      oracleApproved: this.ops.oracleApproved,
    });
  }

  private liquidityWarnings(
    spread: bigint | null,
    bidDepth: bigint,
    askDepth: bigint,
    state: ConsumerMarketView['marketState'],
    stale: boolean,
  ): readonly LiquidityWarningCode[] {
    const codes: LiquidityWarningCode[] = [];
    if (spread !== null && this.reference().priceUnits) {
      const mid = this.reference().priceUnits ?? 1n;
      if (mid > 0n && (spread * 10_000n) / mid >= this.policy.highSpreadBps) {
        codes.push('HIGH_SPREAD');
      }
    }
    if (bidDepth + askDepth < this.policy.lowDepthThreshold) {
      codes.push('LOW_DEPTH');
    }
    if (state === 'PAUSED' || state === 'HALTED') {
      codes.push('MARKET_PAUSED');
    }
    if (state === 'RESTRICTED' || state === 'CLOSED') {
      codes.push('MARKET_RESTRICTED');
    }
    if (stale) {
      codes.push('QUOTE_STALE');
    }
    return Object.freeze(codes);
  }

  private settlementProjections(accountId: ExchangeAccountId): readonly ConsumerSettlementProjection[] {
    const rows: ConsumerSettlementProjection[] = [];
    for (const settlement of this.ops.clearing.settlements.values()) {
      if (settlement.intent.buyer !== accountId && settlement.intent.seller !== accountId) {
        continue;
      }
      rows.push(
        Object.freeze({
          settlementId: settlement.settlementId,
          view: this.settlementView(settlement.status),
          canonicalStatus: settlement.status,
          tradeIds: settlement.tradeIds,
          duplicateInstructionCreated: false,
        }),
      );
    }
    return Object.freeze(rows);
  }

  private settlementView(status: ConsumerSettlementProjection['canonicalStatus']): ConsumerSettlementView {
    if (status === 'FINALIZED') {
      return 'FINALIZED';
    }
    if (status === 'SUBMISSION_UNKNOWN') {
      return 'SUBMISSION_UNKNOWN';
    }
    if (status === 'MATCHED') {
      return 'TRADE_MATCHED';
    }
    return 'SETTLEMENT_PENDING';
  }

  private recordReceipt(participantId: string, status: ConsumerOrderStatus, clientOrderId: string, now: UtcInstant): void {
    void participantId;
    void now;
    if (!status.orderId) {
      return;
    }
    const fills = this.ops.trades
      .filter((trade) => trade.takerOrderId === status.orderId || trade.makerOrderId === status.orderId)
      .map((trade) =>
        Object.freeze({
          tradeId: trade.tradeId,
          quantity: trade.quantity.scaledUnits,
          priceUnits: trade.price.priceUnits,
        }),
      );
    const settlement = [...this.ops.clearing.settlements.values()].find((row) =>
      row.tradeIds.some((tradeId) => fills.some((fill) => fill.tradeId === tradeId)),
    );
    this.receipts.set(
      status.orderId,
      Object.freeze({
        receiptId: id('crec'),
        orderId: status.orderId,
        clientOrderId,
        fills: Object.freeze(fills),
        fees: Object.freeze({
          exchangeFeeQuantity: this.policy.simulationExchangeFee,
          exchangeFeeAsset: 'MOONREY_COIN',
          exchangeFeeConfigured: true,
          networkFeeQuantity: this.policy.simulationNetworkFee,
          networkFeeApplicable: false,
          otherKnownCharges: Object.freeze([]),
          productionRatesInvented: false,
          scheduleId: this.policy.simulationFeeScheduleId,
        }),
        settlementReference: settlement?.settlementId ?? null,
        chainFinalityReference: settlement?.transactionId ?? null,
        marketPolicyVersion: this.policy.policyVersion,
        trades: Object.freeze(this.ops.trades.filter((trade) => fills.some((fill) => fill.tradeId === trade.tradeId))),
      }),
    );
    if (settlement?.status === 'FINALIZED') {
      this.notifications.publish(
        consumerNotification({
          kind: 'SETTLEMENT_FINALIZED',
          participantId,
          body: `Settlement ${settlement.settlementId} finalized`,
          now,
        }),
      );
    }
  }

  private reject(reason: string, reasonCodes: readonly string[] = [reason]) {
    return Object.freeze({ ok: false as const, reason, reasonCodes: Object.freeze([...reasonCodes]) });
  }
}

export function asConsumerAccountId(value: string): ExchangeAccountId {
  return asExchangeAccountId(value);
}

export type { OrderId };
