import type { UtcInstant } from '../consumer/types.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
  type ExchangeAccountId,
} from '../ids.ts';
import type { MarketOperationsEngine } from '../ops/engine.ts';
import { resolveReferencePrice } from '../ops/reference-price.ts';
import { exchangePrice } from '../price.ts';
import type { TradingSession } from '../ops/types.ts';
import { AlphaAllocationLedger } from './allocation.ts';
import { defaultAlphaLiquidityConfig, type AlphaLiquidityConfig } from './config.ts';
import { SUNREY_ALPHA_MARKET_MAKER_ID } from './ids.ts';
import type {
  AlphaLiquidityStatus,
  AlphaMarketMakerSnapshot,
  AlphaPostedQuote,
  AlphaQuoteBand,
  InternalAlphaMarketMakerView,
} from './types.ts';

const NATIVE_BASE_PRECISION = 6;

function spreadHalf(mid: bigint, spreadBps: bigint): bigint {
  return (mid * spreadBps) / 20_000n;
}

function applySpreadMultiplier(mid: bigint, spreadBps: bigint, multiplierBps: bigint): { readonly bid: bigint; readonly ask: bigint } {
  const effectiveSpread = (spreadBps * multiplierBps) / 10_000n;
  const half = spreadHalf(mid, effectiveSpread);
  return Object.freeze({ bid: mid > half ? mid - half : 1n, ask: mid + half });
}

export class InternalAlphaMarketMaker {
  readonly config: AlphaLiquidityConfig;
  readonly ledger = new AlphaAllocationLedger();
  readonly participantId = SUNREY_ALPHA_MARKET_MAKER_ID;
  accountId: ExchangeAccountId | null = null;
  makerSessionId: string | null = null;
  tradingSession: TradingSession | null = null;
  activeQuoteOrderIds: string[] = [];

  constructor(config: AlphaLiquidityConfig = defaultAlphaLiquidityConfig()) {
    this.config = config;
  }

  bootstrap(ops: MarketOperationsEngine, now: UtcInstant): InternalAlphaMarketMakerView {
    const registered = ops.registerParticipant({
      participantId: this.participantId,
      reservation: 10_000_000_000n,
    });
    this.accountId = registered.accountId;
    const maker = ops.designateMarketMaker({
      participantId: this.participantId,
      accountId: registered.accountId,
      marketId: SUNREY_MOONREY_MARKET_ID,
    });
    this.makerSessionId = maker.sessionId;
    this.tradingSession = ops.openTradingSession(registered.credential, now);

    const genesis = this.config.initialAllocation;
    this.ledger.creditSandboxUsd({
      participantId: this.participantId,
      amount: genesis.sandboxUsdMinor,
      config: this.config,
      provenance: 'GENESIS',
    });
    this.ledger.issueNativeToCustody({
      clearing: ops.clearing,
      accountId: registered.accountId,
      participantId: this.participantId,
      assetId: SUNREY_COIN_NATIVE_ASSET_ID,
      quantity: genesis.sunreyScaled,
      config: this.config,
      provenance: 'GENESIS',
    });
    this.ledger.issueNativeToCustody({
      clearing: ops.clearing,
      accountId: registered.accountId,
      participantId: this.participantId,
      assetId: MOONREY_COIN_NATIVE_ASSET_ID,
      quantity: genesis.moonreyScaled,
      config: this.config,
      provenance: 'GENESIS',
    });

    this.refreshExecutableQuotes(ops, now);
    return this.view(ops);
  }

  refreshExecutableQuotes(ops: MarketOperationsEngine, now: UtcInstant): AlphaPostedQuote[] {
    if (!this.accountId || !this.tradingSession || !this.makerSessionId) {
      throw new Error('ALPHA_MARKET_MAKER_NOT_BOOTSTRAPPED');
    }
    this.cancelActiveQuotes(ops, now);
    const mid = this.resolveSrcMrcMid(ops);
    const status = this.inventoryStatus(ops);
    const posted: AlphaPostedQuote[] = [];
    const priorState = ops.marketState().state;
    if (priorState === 'OPEN') {
      ops.transitionMarket({
        marketId: SUNREY_MOONREY_MARKET_ID,
        state: 'PREOPEN',
        actorKind: 'POLICY',
        reason: 'ALPHA_INTERNAL_LIQUIDITY_REFRESH',
        now,
      });
    }
    let session = ops.gateway.authenticate(this.tradingSession.sessionId);

    for (const band of this.config.depthBands) {
      const prices = applySpreadMultiplier(mid, this.config.spreadBps, band.spreadMultiplierBps);
      const sun = ops.clearing.position(this.accountId, SUNREY_COIN_NATIVE_ASSET_ID);
      const moon = ops.clearing.position(this.accountId, MOONREY_COIN_NATIVE_ASSET_ID);
      const bidQty = status === 'LOW_LIQUIDITY' && moon.available < band.quantity ? moon.available : band.quantity;
      const askQty = status === 'LOW_LIQUIDITY' && sun.available < band.quantity ? sun.available : band.quantity;
      if (bidQty <= 0n && askQty <= 0n) {
        continue;
      }
      session = ops.gateway.authenticate(session.sessionId);
      const bidSeq = session.inboundSeq + 1n;
      const bidAck = ops.enterOrder(
        session.sessionId,
        bidSeq,
        {
          clOrdId: `mmbid_${bidSeq}_${band.quantity.toString()}`,
          marketId: SUNREY_MOONREY_MARKET_ID,
          side: 'BUY',
          orderType: 'LIMIT',
          quantity: bidQty > 0n ? bidQty : 1n,
          priceUnits: prices.bid,
        },
        now,
      );
      session = ops.gateway.authenticate(session.sessionId);
      const askSeq = session.inboundSeq + 1n;
      const askAck = ops.enterOrder(
        session.sessionId,
        askSeq,
        {
          clOrdId: `mmask_${askSeq}_${band.quantity.toString()}`,
          marketId: SUNREY_MOONREY_MARKET_ID,
          side: 'SELL',
          orderType: 'LIMIT',
          quantity: askQty > 0n ? askQty : 1n,
          priceUnits: prices.ask,
        },
        now,
      );
      if (bidAck.order?.orderId) {
        this.activeQuoteOrderIds.push(bidAck.order.orderId);
      }
      if (askAck.order?.orderId) {
        this.activeQuoteOrderIds.push(askAck.order.orderId);
      }
      posted.push(this.buildPostedQuote(mid, prices.bid, prices.ask, bidQty, askQty, band));
    }
    this.tradingSession = session;
    if (priorState === 'OPEN') {
      ops.transitionMarket({
        marketId: SUNREY_MOONREY_MARKET_ID,
        state: 'OPEN',
        actorKind: 'POLICY',
        reason: 'ALPHA_INTERNAL_LIQUIDITY_OPEN',
        now,
      });
    }
    return posted;
  }

  getReferenceQuotes(ops: MarketOperationsEngine): readonly AlphaPostedQuote[] {
    const srcMrcMid = this.resolveSrcMrcMid(ops);
    const srcUsdMid = this.config.referencePrices.srcUsdMinorPerUnit;
    const mrcUsdMid = this.config.referencePrices.mrcUsdMinorPerUnit;
    const srcUsd = this.buildUsdPairQuote('SRC/USD', srcUsdMid);
    const mrcUsd = this.buildUsdPairQuote('MRC/USD', mrcUsdMid);
    const srcMrc = this.buildSrcMrcQuote(srcMrcMid, this.config.depthBands[0]?.quantity ?? 50n);
    void ops;
    return Object.freeze([srcUsd, mrcUsd, srcMrc]);
  }

  inventoryStatus(ops: MarketOperationsEngine): AlphaLiquidityStatus {
    if (!this.accountId) {
      return 'LOW_LIQUIDITY';
    }
    const thresholds = this.config.inventoryThresholds;
    const sun = ops.clearing.position(this.accountId, SUNREY_COIN_NATIVE_ASSET_ID);
    const moon = ops.clearing.position(this.accountId, MOONREY_COIN_NATIVE_ASSET_ID);
    const usd = this.ledger.sandboxUsd(this.participantId);
    if (
      sun.available < thresholds.sunreyScaled
      || moon.available < thresholds.moonreyScaled
      || usd < thresholds.sandboxUsdMinor
    ) {
      return 'LOW_LIQUIDITY';
    }
    return 'OK';
  }

  authorizeReplenishment(input: {
    readonly ops: MarketOperationsEngine;
    readonly now: UtcInstant;
    readonly replenishmentRef: string;
    readonly assetKind: 'SANDBOX_USD' | 'SUNREY_COIN' | 'MOONREY_COIN';
    readonly quantity: bigint;
  }): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    if (!this.accountId) {
      return { ok: false, reason: 'NOT_BOOTSTRAPPED' };
    }
    if (input.quantity <= 0n) {
      return { ok: false, reason: 'INVALID_QUANTITY' };
    }
    if (input.assetKind === 'SANDBOX_USD') {
      this.ledger.creditSandboxUsd({
        participantId: this.participantId,
        amount: input.quantity,
        config: this.config,
        provenance: 'REPLENISHMENT',
      });
    } else {
      const assetId =
        input.assetKind === 'SUNREY_COIN' ? SUNREY_COIN_NATIVE_ASSET_ID : MOONREY_COIN_NATIVE_ASSET_ID;
      this.ledger.issueNativeToCustody({
        clearing: input.ops.clearing,
        accountId: this.accountId,
        participantId: this.participantId,
        assetId,
        quantity: input.quantity,
        config: this.config,
        provenance: 'REPLENISHMENT',
      });
    }
    this.refreshExecutableQuotes(input.ops, input.now);
    return { ok: true };
  }

  fundUserSandboxUsd(participantId: string, amountMinor: bigint): { readonly ok: true; readonly balanceMinor: bigint } {
    this.ledger.creditSandboxUsd({
      participantId,
      amount: amountMinor,
      config: this.config,
      provenance: 'GENESIS',
    });
    return { ok: true, balanceMinor: this.ledger.sandboxUsd(participantId) };
  }

  debitUserSandboxUsd(participantId: string, amountMinor: bigint): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    const result = this.ledger.debitSandboxUsd(participantId, amountMinor);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    return { ok: true };
  }

  userSandboxUsd(participantId: string): bigint {
    return this.ledger.sandboxUsd(participantId);
  }

  moonreyForUsdNotional(usdMinor: bigint): bigint {
    const perUnit = this.config.referencePrices.mrcUsdMinorPerUnit;
    if (perUnit <= 0n) {
      return 0n;
    }
    return (usdMinor * 10n ** BigInt(NATIVE_BASE_PRECISION)) / perUnit;
  }

  snapshot(ops: MarketOperationsEngine): AlphaMarketMakerSnapshot {
    if (!this.accountId) {
      throw new Error('ALPHA_MARKET_MAKER_NOT_BOOTSTRAPPED');
    }
    const ledgerSnap = this.ledger.snapshot(this.participantId);
    return Object.freeze({
      participantId: this.participantId,
      accountId: this.accountId,
      marketId: SUNREY_MOONREY_MARKET_ID,
      allocations: ledgerSnap.allocations,
      sandboxUsdMinor: ledgerSnap.sandboxUsdMinor,
      totalIssuedSunrey: ledgerSnap.totalIssuedSunrey,
      totalIssuedMoonrey: ledgerSnap.totalIssuedMoonrey,
      activeQuoteOrderIds: Object.freeze([...this.activeQuoteOrderIds]),
      liquidityStatus: this.inventoryStatus(ops),
    });
  }

  restoreSnapshot(snapshot: AlphaMarketMakerSnapshot): void {
    this.accountId = snapshot.accountId;
    this.activeQuoteOrderIds = [...snapshot.activeQuoteOrderIds];
    this.ledger.restore({
      allocations: snapshot.allocations,
      sandboxUsdMinor: snapshot.sandboxUsdMinor,
      participantId: snapshot.participantId,
      totalIssuedSunrey: snapshot.totalIssuedSunrey,
      totalIssuedMoonrey: snapshot.totalIssuedMoonrey,
    });
  }

  view(ops: MarketOperationsEngine): InternalAlphaMarketMakerView {
    if (!this.accountId || !this.makerSessionId) {
      throw new Error('ALPHA_MARKET_MAKER_NOT_BOOTSTRAPPED');
    }
    const session = ops.makerSessions.get(this.makerSessionId);
    if (!session) {
      throw new Error('ALPHA_MARKET_MAKER_SESSION_MISSING');
    }
    return Object.freeze({
      session,
      accountId: this.accountId,
      liquidityStatus: this.inventoryStatus(ops),
      quotes: this.getReferenceQuotes(ops),
      allocations: Object.freeze([...this.ledger.records]),
    });
  }

  marketMakerAccountIds(): ReadonlySet<string> {
    return this.accountId ? new Set([this.accountId]) : new Set();
  }

  private resolveSrcMrcMid(ops: MarketOperationsEngine): bigint {
    const lastTrade = ops.trades.length > 0 ? ops.trades[ops.trades.length - 1] ?? null : null;
    const resolved = resolveReferencePrice({
      lastEligibleTrade: lastTrade,
      resting: [...ops.orders.values()],
      approvedOraclePriceUnits: this.config.referencePrices.srcMrcMidPriceUnits,
      oracleApproved: true,
      priceTemplate: exchangePrice({
        baseAssetId: SUNREY_COIN_NATIVE_ASSET_ID,
        quoteAssetId: MOONREY_COIN_NATIVE_ASSET_ID,
        quoteKind: 'ASSET',
        priceUnits: this.config.referencePrices.srcMrcMidPriceUnits,
        basePrecision: NATIVE_BASE_PRECISION,
      }),
    });
    return resolved.priceUnits ?? this.config.referencePrices.srcMrcMidPriceUnits;
  }

  private buildUsdPairQuote(pair: 'SRC/USD' | 'MRC/USD', midMinor: bigint): AlphaPostedQuote {
    const half = spreadHalf(midMinor, this.config.spreadBps);
    const bid = midMinor > half ? midMinor - half : 1n;
    const ask = midMinor + half;
    const qty = this.config.depthBands[0]?.quantity ?? 50n;
    return this.buildPostedQuote(midMinor, bid, ask, qty, qty, {
      quantity: qty,
      spreadMultiplierBps: 10_000n,
    }, pair);
  }

  private buildSrcMrcQuote(mid: bigint, qty: bigint): AlphaPostedQuote {
    const prices = applySpreadMultiplier(mid, this.config.spreadBps, 10_000n);
    return this.buildPostedQuote(mid, prices.bid, prices.ask, qty, qty, {
      quantity: qty,
      spreadMultiplierBps: 10_000n,
    }, 'SRC/MRC');
  }

  private buildPostedQuote(
    mid: bigint,
    bid: bigint,
    ask: bigint,
    bidQty: bigint,
    askQty: bigint,
    band: { readonly quantity: bigint; readonly spreadMultiplierBps: bigint },
    pair: AlphaPostedQuote['pair'] = 'SRC/MRC',
  ): AlphaPostedQuote {
    const spreadUnits = ask - bid;
    const spreadBps = mid > 0n ? (spreadUnits * 10_000n) / mid : 0n;
    const depthBands: AlphaQuoteBand[] = [
      Object.freeze({
        pair,
        side: 'BID',
        priceUnits: bid,
        quantity: bidQty,
        spreadBps,
        source: this.config.liquiditySource,
      }),
      Object.freeze({
        pair,
        side: 'ASK',
        priceUnits: ask,
        quantity: askQty,
        spreadBps,
        source: this.config.liquiditySource,
      }),
    ];
    return Object.freeze({
      pair,
      bidPriceUnits: bid,
      askPriceUnits: ask,
      spreadUnits,
      spreadBps,
      bidQuantity: bidQty,
      askQuantity: askQty,
      source: this.config.liquiditySource,
      depthBands: Object.freeze(depthBands),
    });
  }

  private cancelActiveQuotes(ops: MarketOperationsEngine, now: UtcInstant): void {
    if (!this.accountId) {
      return;
    }
    ops.massCancel({ actor: 'PARTICIPANT', accountId: this.accountId, now });
    this.activeQuoteOrderIds = [];
  }
}

export function createInternalAlphaMarketMaker(
  config?: AlphaLiquidityConfig,
): InternalAlphaMarketMaker {
  return new InternalAlphaMarketMaker(config ?? defaultAlphaLiquidityConfig());
}
