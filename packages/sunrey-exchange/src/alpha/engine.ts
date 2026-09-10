import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  asOrderId,
  asTradeId,
  newExecutionId,
  type ExchangeAccountId,
  type ExchangeMarketId,
  type OrderId,
} from '../ids.ts';
import { applyFill, matchIncoming, sortBook } from '../matching.ts';
import { NativeClearingEngine } from '../native-clearing/engine.ts';
import type { NativeTrade } from '../native-clearing/types.ts';
import { exchangePrice, quoteForQuantity } from '../price.ts';
import { MarketOperationsEngine } from '../ops/engine.ts';
import { depthFromOrders } from '../ops/market-data.ts';
import { PRICE_LABEL } from '../taxonomy.ts';
import type { DigitalOrder, ImmutableTrade, MarketDataSnapshot } from '../types.ts';
import {
  canonicalAlphaMarkets,
  isAlphaNativePairMarket,
  isAlphaUsdMarket,
  resolveAlphaMarketRef,
  type AlphaMarketDefinition,
} from '../ids.ts';
import type { LedgerUsdAuthority } from './usd-ledger.ts';

export type AlphaExchangeParticipant = {
  readonly participantId: string;
  readonly accountId: ExchangeAccountId;
  readonly usdAccountId: string;
};

export type AlphaOrderRequest = {
  readonly participantId: string;
  readonly marketRef: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly priceUnits: bigint;
  readonly now: UtcInstant;
  readonly clientOrderId?: string;
};

type OrderHold = {
  readonly kind: 'USD' | 'NATIVE';
  readonly holdId: string;
  readonly assetId: string;
  readonly quantity: bigint;
};

export class AlphaExchangeEngine {
  readonly clearing: NativeClearingEngine;
  readonly usd: LedgerUsdAuthority;
  readonly ops: MarketOperationsEngine;
  readonly participants = new Map<string, AlphaExchangeParticipant>();
  readonly orders = new Map<OrderId, DigitalOrder>();
  readonly ordersByOwner = new Map<string, OrderId[]>();
  readonly trades: ImmutableTrade[] = [];
  readonly holdsByOrder = new Map<OrderId, OrderHold>();
  private tradeSeq = 0;
  private mdSeq = new Map<string, number>();
  private syncedNativeTrades = new Set<string>();

  constructor(input: { readonly clearing: NativeClearingEngine; readonly usd: LedgerUsdAuthority; readonly now: UtcInstant }) {
    this.clearing = input.clearing;
    this.usd = input.usd;
    this.ops = new MarketOperationsEngine({ now: input.now, ports: { clearing: input.clearing } });
    for (const market of canonicalAlphaMarkets()) {
      if (isAlphaNativePairMarket(market.marketId)) {
        this.ops.states.set(market.marketId, {
          marketId: market.marketId,
          family: 'DIGITAL_ASSET',
          state: market.state,
          previousState: 'PREOPEN',
          reason: 'ALPHA_NATIVE_MARKET',
          actorKind: 'POLICY',
          accepted: true,
          updatedAt: input.now,
        });
        this.ops.sessions.set(market.marketId, {
          sessionId: `mses_${market.marketId}`,
          marketId: market.marketId,
          mode: 'CONTINUOUS',
          timezone: 'UTC',
          openUtc: null,
          closeUtc: null,
          continuous: true,
        });
      }
      this.mdSeq.set(market.marketId, 0);
    }
  }

  registerParticipant(input: {
    readonly participantId: string;
    readonly usdAccountId: string;
    readonly reservation?: bigint;
  }): AlphaExchangeParticipant {
    const accountId = this.clearing.openExchangeAccount(input.participantId);
    this.ops.registerParticipant({
      participantId: input.participantId,
      accountId,
      reservation: input.reservation ?? 10_000_000_000n,
    });
    const participant: AlphaExchangeParticipant = Object.freeze({
      participantId: input.participantId,
      accountId,
      usdAccountId: input.usdAccountId,
    });
    this.participants.set(input.participantId, participant);
    return participant;
  }

  creditNative(accountId: ExchangeAccountId, assetId: typeof SUNREY_COIN_NATIVE_ASSET_ID | typeof MOONREY_COIN_NATIVE_ASSET_ID, quantity: bigint): void {
    this.clearing.faucetToCustody(accountId, assetId, quantity);
  }

  listMarkets(): readonly AlphaMarketDefinition[] {
    return canonicalAlphaMarkets();
  }

  marketState(marketRef: string): AlphaMarketDefinition | undefined {
    return resolveAlphaMarketRef(marketRef);
  }

  snapshot(marketRef: string): MarketDataSnapshot | null {
    const market = resolveAlphaMarketRef(marketRef);
    if (!market) {
      return null;
    }
    const orders = this.openOrdersForMarket(market.marketId);
    const book = sortBook(orders);
    const marketTrades = this.trades.filter((trade) => trade.marketId === market.marketId);
    const last = marketTrades[marketTrades.length - 1] ?? null;
    let volume = AssetQuantity.fromScaledUnits(0n, market.baseAssetId);
    for (const trade of marketTrades) {
      volume = volume.plus(trade.quantity);
    }
    const sequence = ((this.mdSeq.get(market.marketId) ?? 0) + 1) as MarketDataSnapshot['sequence'];
    this.mdSeq.set(market.marketId, Number(sequence));
    return Object.freeze({
      marketId: market.marketId,
      sequence,
      bestBid: book.bids[0]?.limitPrice ?? null,
      bestAsk: book.asks[0]?.limitPrice ?? null,
      lastTrade: last,
      lastPriceLabel: last ? PRICE_LABEL : 'UNAVAILABLE',
      volume,
      depth: {
        bids: book.bids.slice(0, 10).map((order) => ({ price: order.limitPrice!, quantity: order.remaining })),
        asks: book.asks.slice(0, 10).map((order) => ({ price: order.limitPrice!, quantity: order.remaining })),
      },
    });
  }

  tradesFor(marketRef: string): readonly ImmutableTrade[] {
    const market = resolveAlphaMarketRef(marketRef);
    if (!market) {
      return Object.freeze([]);
    }
    return Object.freeze(this.trades.filter((trade) => trade.marketId === market.marketId));
  }

  ordersFor(participantId: string): readonly DigitalOrder[] {
    const ids = this.ordersByOwner.get(participantId) ?? [];
    return Object.freeze(ids.map((id) => this.orders.get(id)).filter((order): order is DigitalOrder => Boolean(order)));
  }

  placeOrder(request: AlphaOrderRequest): DigitalOrder | { readonly ok: false; readonly reason: string } {
    const market = resolveAlphaMarketRef(request.marketRef);
    const participant = this.participants.get(request.participantId);
    if (!market || !participant) {
      return { ok: false, reason: 'UNKNOWN_MARKET_OR_PARTICIPANT' };
    }
    if (request.quantity <= 0n || request.priceUnits <= 0n) {
      return { ok: false, reason: 'INVALID_QUANTITY_OR_PRICE' };
    }
    if (isAlphaNativePairMarket(market.marketId)) {
      return this.placeNativePairOrder(market, participant, request);
    }
    if (isAlphaUsdMarket(market.marketId)) {
      return this.placeUsdQuotedOrder(market, participant, request);
    }
    return { ok: false, reason: 'UNSUPPORTED_MARKET' };
  }

  cancelOrder(participantId: string, orderId: OrderId): DigitalOrder | { readonly ok: false; readonly reason: string } {
    const order = this.orders.get(orderId);
    const participant = this.participants.get(participantId);
    if (!order || !participant || order.beneficialParticipantId !== participantId) {
      return { ok: false, reason: 'NOT_OWNED' };
    }
    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      return order;
    }
    if (isAlphaNativePairMarket(order.marketId)) {
      const cancelled = this.clearing.cancel(orderId);
      this.orders.set(orderId, Object.freeze({ ...cancelled, marketId: order.marketId }));
      return this.orders.get(orderId) ?? cancelled;
    }
    this.releaseHold(orderId);
    const cancelled: DigitalOrder = Object.freeze({
      ...order,
      status: 'CANCELLED',
      version: (order.version + 1) as DigitalOrder['version'],
    });
    this.orders.set(orderId, cancelled);
    return cancelled;
  }

  orderBookView(marketRef: string) {
    const market = resolveAlphaMarketRef(marketRef);
    if (!market) {
      return null;
    }
    return depthFromOrders(this.openOrdersForMarket(market.marketId));
  }

  private placeNativePairOrder(
    market: AlphaMarketDefinition,
    participant: AlphaExchangeParticipant,
    request: AlphaOrderRequest,
  ): DigitalOrder | { readonly ok: false; readonly reason: string } {
    try {
      const before = this.clearing.trades.size;
      const order = this.clearing.placeOrder({
        accountId: participant.accountId,
        side: request.side,
        quantity: request.quantity,
        priceUnits: request.priceUnits,
        now: request.now,
      });
      const tagged: DigitalOrder = Object.freeze({ ...order, marketId: market.marketId });
      this.orders.set(order.orderId, tagged);
      this.trackOrder(participant.participantId, order.orderId);
      if (this.clearing.trades.size > before) {
        for (const trade of this.clearing.trades.values()) {
          this.ingestNativeTrade(market.marketId, trade);
        }
      }
      return tagged;
    } catch (error) {
      return { ok: false, reason: error instanceof Error && 'code' in error ? String((error as { code: string }).code) : 'REJECTED' };
    }
  }

  private placeUsdQuotedOrder(
    market: AlphaMarketDefinition,
    participant: AlphaExchangeParticipant,
    request: AlphaOrderRequest,
  ): DigitalOrder | { readonly ok: false; readonly reason: string } {
    const price = exchangePrice({
      baseAssetId: market.baseAssetId,
      quoteAssetId: 'USD',
      quoteKind: 'FIAT_MONEY',
      priceUnits: request.priceUnits,
      basePrecision: 6,
    });
    const quantity = AssetQuantity.fromScaledUnits(request.quantity, market.baseAssetId);
    const quoteMinor = quoteForQuantity(price, quantity);
    let hold: OrderHold;
    if (request.side === 'SELL') {
      const position = this.clearing.position(participant.accountId, market.baseAssetId);
      if (position.available < request.quantity) {
        return { ok: false, reason: 'INSUFFICIENT_ASSET' };
      }
      const custody = this.clearing.accounts.get(participant.accountId)?.custody;
      if (!custody) {
        return { ok: false, reason: 'UNKNOWN_ACCOUNT' };
      }
      const lockId = `alpha_lock_${randomUUID().replace(/-/g, '')}`;
      this.clearing.chain.lock(lockId, custody, market.baseAssetId, request.quantity);
      hold = Object.freeze({ kind: 'NATIVE', holdId: lockId, assetId: market.baseAssetId, quantity: request.quantity });
    } else {
      const reserved = this.usd.reserve(participant.usdAccountId, quoteMinor);
      if (!reserved.ok) {
        return { ok: false, reason: reserved.code };
      }
      hold = Object.freeze({ kind: 'USD', holdId: reserved.hold.holdId, assetId: 'USD', quantity: quoteMinor });
    }
    const orderId = asOrderId(`xord_${randomUUID().replace(/-/g, '')}`);
    const order: DigitalOrder = Object.freeze({
      orderId,
      version: 1 as DigitalOrder['version'],
      exchangeAccountId: participant.accountId,
      beneficialParticipantId: participant.participantId,
      marketId: market.marketId,
      family: 'DIGITAL_ASSET',
      side: request.side,
      orderType: 'LIMIT',
      quantity,
      remaining: quantity,
      limitPrice: price,
      createdAt: request.now,
      timeInForce: 'GTC',
      status: 'OPEN',
      clientIdempotencyKey: request.clientOrderId ?? orderId,
      authorizationRef: null,
      holdId: hold.kind === 'USD' ? hold.holdId : null,
      coinHoldId: hold.kind === 'NATIVE' ? hold.holdId : null,
      sourceAccountId: request.side === 'SELL' ? participant.accountId : participant.usdAccountId,
      sequence: this.orders.size + 1,
    });
    this.orders.set(orderId, order);
    this.holdsByOrder.set(orderId, hold);
    this.trackOrder(participant.participantId, orderId);
    this.matchUsdOrder(order, request.now);
    return this.orders.get(orderId) ?? order;
  }

  private matchUsdOrder(incoming: DigitalOrder, now: UtcInstant): void {
    const resting = this.openOrdersForMarket(incoming.marketId);
    const result = matchIncoming(incoming, resting, { selfTrade: 'CANCEL_INCOMING' });
    if (result.rejectIncoming) {
      this.releaseHold(incoming.orderId);
      this.orders.set(incoming.orderId, Object.freeze({ ...incoming, status: 'REJECTED' }));
      return;
    }
    let taker = incoming;
    for (const row of result.matches) {
      this.tradeSeq += 1;
      const quoteMinor = quoteForQuantity(row.price, row.quantity);
      const trade: ImmutableTrade = Object.freeze({
        tradeId: asTradeId(`xtrd_${randomUUID().replace(/-/g, '')}`),
        executionId: newExecutionId(),
        marketId: incoming.marketId,
        makerOrderId: row.maker.orderId,
        takerOrderId: row.taker.orderId,
        quantity: row.quantity,
        price: row.price,
        quoteAmount: Money.fromMinorUnits(quoteMinor, 'USD'),
        makerFee: Money.fromMinorUnits(0n, 'USD'),
        takerFee: Money.fromMinorUnits(0n, 'USD'),
        feeScheduleId: 'fees:alpha-v1' as ImmutableTrade['feeScheduleId'],
        matchedAt: now,
        sequence: this.tradeSeq as ImmutableTrade['sequence'],
      });
      this.trades.push(trade);
      this.settleUsdTrade(row.maker, row.taker, quoteMinor, row.quantity.scaledUnits, incoming.marketId);
      const makerFilled = applyFill(this.orders.get(row.maker.orderId) ?? row.maker, row.quantity);
      taker = applyFill(this.orders.get(taker.orderId) ?? taker, row.quantity);
      this.orders.set(makerFilled.orderId, makerFilled);
      this.orders.set(taker.orderId, taker);
      if (makerFilled.status === 'FILLED') {
        this.releaseHold(makerFilled.orderId);
      }
      if (taker.status === 'FILLED') {
        this.releaseHold(taker.orderId);
      }
    }
  }

  private settleUsdTrade(
    maker: DigitalOrder,
    taker: DigitalOrder,
    quoteMinor: bigint,
    baseQty: bigint,
    marketId: ExchangeMarketId,
  ): void {
    const market = canonicalAlphaMarkets().find((row) => row.marketId === marketId);
    if (!market) {
      return;
    }
    const seller = maker.side === 'SELL' ? maker : taker;
    const buyer = maker.side === 'BUY' ? maker : taker;
    const sellerParticipant = this.participants.get(seller.beneficialParticipantId);
    const buyerParticipant = this.participants.get(buyer.beneficialParticipantId);
    if (!sellerParticipant || !buyerParticipant) {
      return;
    }
    const sellerHold = this.holdsByOrder.get(seller.orderId);
    const buyerHold = this.holdsByOrder.get(buyer.orderId);
    if (sellerHold?.kind === 'NATIVE') {
      this.clearing.chain.unlock(sellerHold.holdId);
      const sellerCustody = this.clearing.accounts.get(sellerParticipant.accountId)?.custody;
      const buyerCustody = this.clearing.accounts.get(buyerParticipant.accountId)?.custody;
      if (sellerCustody && buyerCustody) {
        this.clearing.chain.transfer(sellerCustody, buyerCustody, market.baseAssetId, baseQty);
      }
      this.holdsByOrder.delete(seller.orderId);
    }
    if (buyerHold?.kind === 'USD') {
      this.usd.transfer({
        fromAccountId: buyerParticipant.usdAccountId,
        toAccountId: sellerParticipant.usdAccountId,
        minorUnits: quoteMinor,
        fromHoldId: buyerHold.holdId,
      });
      this.holdsByOrder.delete(buyer.orderId);
    }
  }

  private ingestNativeTrade(marketId: ExchangeMarketId, trade: NativeTrade): void {
    if (this.syncedNativeTrades.has(trade.tradeId)) {
      return;
    }
    this.syncedNativeTrades.add(trade.tradeId);
    this.tradeSeq += 1;
    const immutable: ImmutableTrade = Object.freeze({
      tradeId: trade.tradeId,
      executionId: newExecutionId(),
      marketId,
      makerOrderId: asOrderId(`xord_${trade.tradeId}_maker`),
      takerOrderId: asOrderId(`xord_${trade.tradeId}_taker`),
      quantity: trade.quantity,
      price: trade.price,
      quoteAmount: Money.fromMinorUnits(quoteForQuantity(trade.price, trade.quantity), 'USD'),
      makerFee: Money.fromMinorUnits(0n, 'USD'),
      takerFee: Money.fromMinorUnits(0n, 'USD'),
      feeScheduleId: 'fees:alpha-v1' as ImmutableTrade['feeScheduleId'],
      matchedAt: trade.matchedAt,
      sequence: this.tradeSeq as ImmutableTrade['sequence'],
    });
    this.trades.push(immutable);
  }

  private openOrdersForMarket(marketId: ExchangeMarketId): DigitalOrder[] {
    return [...this.orders.values()].filter(
      (order) => order.marketId === marketId && (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
    );
  }

  private trackOrder(participantId: string, orderId: OrderId): void {
    const list = this.ordersByOwner.get(participantId) ?? [];
    list.push(orderId);
    this.ordersByOwner.set(participantId, list);
  }

  private releaseHold(orderId: OrderId): void {
    const hold = this.holdsByOrder.get(orderId);
    if (!hold) {
      return;
    }
    if (hold.kind === 'USD') {
      this.usd.release(hold.holdId);
    } else {
      const lock = this.clearing.chain.locks.get(hold.holdId);
      if (lock && lock.status === 'LOCKED') {
        this.clearing.chain.unlock(hold.holdId);
      }
    }
    this.holdsByOrder.delete(orderId);
  }
}
