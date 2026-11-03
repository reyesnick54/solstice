/**
 * HELIOS OS03 — simulated venue orchestrating latency, book updates, and matching.
 */

import type { UtcInstant } from '@solstice/domain';

import { DEFAULT_FEE_MODEL, type FeeModelConfig } from './fee-model.ts';
import { DEFAULT_FILL_MODEL, type FillModelConfig } from './fill-model.ts';
import {
  cancelEffectiveBy,
  DEFAULT_LATENCY_MODEL,
  effectiveCancelAt,
  effectiveReplaceAt,
  effectiveSubmitAt,
  isActiveBy,
  type LatencyModelConfig,
} from './latency-model.ts';
import {
  bestAsk,
  bestBid,
  isBookStale,
  marketBookFromLevel2,
  marketBookFromQuote,
} from './market-book.ts';
import {
  matchOrderAgainstBar,
  matchOrderAgainstLevel2,
  matchOrderAgainstQuote,
  matchOrderAgainstTrade,
  type MatchingContext,
} from './matching-engine.ts';
import { DEFAULT_SLIPPAGE_MODEL, type SlippageModelConfig } from './slippage-model.ts';
import type { BarExecutionMode, OhlcPathSequence } from './taxonomy.ts';
import type {
  CancelOrderResult,
  MarketUpdate,
  ReplaceOrderRequest,
  ReplaceOrderResult,
  SimulatedFill,
  SimulatedWorkingOrder,
  SubmitOrderRequest,
  SubmitOrderResult,
} from './types.ts';

export type SimulatedVenueConfig = {
  readonly venueId: string;
  readonly fillModel?: FillModelConfig;
  readonly feeModel?: FeeModelConfig;
  readonly slippageModel?: SlippageModelConfig;
  readonly latencyModel?: LatencyModelConfig;
  readonly barExecutionMode?: BarExecutionMode;
  readonly ohlcPathSequence?: OhlcPathSequence;
  readonly maxBookAgeMs?: number;
  readonly maxBookDepthLevels?: number | null;
};

export class SimulatedVenue {
  readonly venueId: string;
  private readonly fillModel: FillModelConfig;
  private readonly feeModel: FeeModelConfig;
  private readonly slippageModel: SlippageModelConfig;
  private readonly latencyModel: LatencyModelConfig;
  private readonly barExecutionMode: BarExecutionMode;
  private readonly ohlcPathSequence: OhlcPathSequence;
  private readonly maxBookAgeMs: number;
  private readonly maxBookDepthLevels: number | null;

  private now: UtcInstant;
  private orderSeq = 0;
  private fillSeq = 0;
  private readonly orders = new Map<string, SimulatedWorkingOrder>();
  private readonly fills: SimulatedFill[] = [];
  private lastMarketUpdate: MarketUpdate | null = null;
  private readonly positionUnitsByInstrument = new Map<string, bigint>();

  constructor(initialNow: UtcInstant, config: SimulatedVenueConfig) {
    this.now = initialNow;
    this.venueId = config.venueId;
    this.fillModel = config.fillModel ?? DEFAULT_FILL_MODEL;
    this.feeModel = config.feeModel ?? DEFAULT_FEE_MODEL;
    this.slippageModel = config.slippageModel ?? DEFAULT_SLIPPAGE_MODEL;
    this.latencyModel = config.latencyModel ?? DEFAULT_LATENCY_MODEL;
    this.barExecutionMode = config.barExecutionMode ?? 'CLOSE_ONLY';
    this.ohlcPathSequence = config.ohlcPathSequence ?? 'O_H_L_C';
    this.maxBookAgeMs = config.maxBookAgeMs ?? 60_000;
    this.maxBookDepthLevels = config.maxBookDepthLevels ?? null;
  }

  getPositionUnits(instrumentId: string): bigint {
    return this.positionUnitsByInstrument.get(instrumentId) ?? 0n;
  }

  getFills(): readonly SimulatedFill[] {
    return Object.freeze([...this.fills]);
  }

  getOrder(orderId: string): SimulatedWorkingOrder | null {
    return this.orders.get(orderId) ?? null;
  }

  listOrders(): readonly SimulatedWorkingOrder[] {
    return Object.freeze([...this.orders.values()]);
  }

  advanceClock(asOf: UtcInstant): void {
    this.now = asOf;
    this.processPendingActivations();
    this.processPendingReplaces();
    this.processPendingCancels();
  }

  onMarketUpdate(update: MarketUpdate): readonly SimulatedFill[] {
    this.lastMarketUpdate = update;
    this.tryMatchWorkingOrders();
    return this.getFills();
  }

  submitOrder(request: SubmitOrderRequest): SubmitOrderResult {
    this.orderSeq += 1;
    const orderId = `${this.venueId}:ord:${this.orderSeq}`;
    const reduceOnly = request.reduceOnly === true;
    if (reduceOnly && violatesReduceOnly(this.getPositionUnits(request.instrumentId), request.side)) {
      return Object.freeze({
        accepted: false,
        reason: 'REDUCE_ONLY_WOULD_INCREASE_EXPOSURE',
        orderId: null,
      });
    }
    if (request.timeInForce === 'POST_ONLY' && this.postOnlyWouldTake(request)) {
      return Object.freeze({
        accepted: false,
        reason: 'POST_ONLY_WOULD_TAKE',
        orderId: null,
      });
    }
    const activeAt = effectiveSubmitAt(this.now, this.latencyModel);
    const order: SimulatedWorkingOrder = Object.freeze({
      orderId,
      clientOrderId: request.clientOrderId,
      instrumentId: request.instrumentId,
      side: request.side,
      orderType: request.orderType,
      timeInForce: request.timeInForce,
      quantityUnits: request.quantityUnits,
      remainingQuantityUnits: request.quantityUnits,
      limitPriceMinorUnits: request.limitPriceMinorUnits ?? null,
      stopPriceMinorUnits: request.stopPriceMinorUnits ?? null,
      status: 'PENDING_ACTIVATION',
      stopTriggered: false,
      submittedAt: this.now,
      activeAt,
      cancelRequestedAt: null,
      cancelEffectiveAt: null,
      replaceRequestedAt: null,
      replaceEffectiveAt: null,
      pendingLimitPriceMinorUnits: null,
      pendingQuantityUnits: null,
      reduceOnly,
      currency: request.currency,
      fills: Object.freeze([]),
    });
    this.orders.set(orderId, order);
    this.processPendingActivations();
    this.tryMatchWorkingOrders();
    return Object.freeze({ accepted: true, order: this.orders.get(orderId)! });
  }

  replaceOrder(orderId: string, request: ReplaceOrderRequest): ReplaceOrderResult {
    const current = this.orders.get(orderId);
    if (!current) {
      return Object.freeze({ status: 'NOT_FOUND', reason: 'order not found', order: null });
    }
    if (current.status === 'FILLED' || current.status === 'CANCELLED' || current.status === 'REJECTED') {
      return Object.freeze({ status: 'REPLACE_REJECTED', reason: 'terminal order', order: current });
    }
    const replaceEffectiveAt = effectiveReplaceAt(this.now, this.latencyModel);
    const pending = Object.freeze({
      ...current,
      replaceRequestedAt: this.now,
      replaceEffectiveAt,
      pendingLimitPriceMinorUnits:
        request.limitPriceMinorUnits !== undefined ? request.limitPriceMinorUnits : current.limitPriceMinorUnits,
      pendingQuantityUnits:
        request.quantityUnits !== undefined ? request.quantityUnits : current.remainingQuantityUnits,
    });
    this.orders.set(orderId, pending);
    this.processPendingReplaces();
    const latest = this.orders.get(orderId)!;
    return Object.freeze({
      status: latest.replaceEffectiveAt && !isActiveBy(this.now, latest.replaceEffectiveAt) ? 'REPLACE_PENDING' : 'REPLACED',
      order: latest,
    });
  }

  cancelOrder(orderId: string): CancelOrderResult {
    const current = this.orders.get(orderId);
    if (!current) {
      return Object.freeze({ status: 'NOT_FOUND', reason: 'order not found' });
    }
    if (current.status === 'FILLED' || current.status === 'CANCELLED' || current.status === 'REJECTED') {
      return Object.freeze({ status: 'CANCEL_REJECTED', order: current });
    }
    const cancelEffectiveAt = effectiveCancelAt(this.now, this.latencyModel);
    const pending = Object.freeze({
      ...current,
      status: current.status === 'PENDING_ACTIVATION' ? ('PENDING_ACTIVATION' as const) : ('CANCEL_PENDING' as const),
      cancelRequestedAt: this.now,
      cancelEffectiveAt,
    });
    this.orders.set(orderId, pending);
    this.processPendingCancels();
    const latest = this.orders.get(orderId)!;
    return Object.freeze({
      status: latest.status === 'CANCELLED' ? 'CANCELLED' : 'CANCEL_PENDING',
      order: latest,
    });
  }

  private matchingContext(): MatchingContext {
    return Object.freeze({
      venueId: this.venueId,
      asOf: this.now,
      fillModel: this.fillModel,
      feeModel: this.feeModel,
      slippageModel: this.slippageModel,
      latencyModel: this.latencyModel,
      barExecutionMode: this.barExecutionMode,
      ohlcPathSequence: this.ohlcPathSequence,
      maxBookDepthLevels: this.maxBookDepthLevels,
      nextFillSeq: () => {
        this.fillSeq += 1;
        return `${this.venueId}:fill:${this.fillSeq}`;
      },
    });
  }

  private processPendingActivations(): void {
    for (const [orderId, order] of this.orders) {
      if (order.status !== 'PENDING_ACTIVATION') {
        continue;
      }
      if (order.cancelEffectiveAt && cancelEffectiveBy(this.now, order.cancelEffectiveAt)) {
        continue;
      }
      if (isActiveBy(this.now, order.activeAt)) {
        this.orders.set(
          orderId,
          Object.freeze({
            ...order,
            status: 'WORKING',
          }),
        );
      }
    }
  }

  private processPendingReplaces(): void {
    for (const [orderId, order] of this.orders) {
      if (!order.replaceEffectiveAt || !isActiveBy(this.now, order.replaceEffectiveAt)) {
        continue;
      }
      const nextQty = order.pendingQuantityUnits ?? order.remainingQuantityUnits;
      const filled = order.quantityUnits - order.remainingQuantityUnits;
      const nextRemaining = nextQty > filled ? nextQty - filled : 0n;
      this.orders.set(
        orderId,
        Object.freeze({
          ...order,
          limitPriceMinorUnits:
            order.pendingLimitPriceMinorUnits !== undefined
              ? order.pendingLimitPriceMinorUnits
              : order.limitPriceMinorUnits,
          quantityUnits: nextQty + filled,
          remainingQuantityUnits: nextRemaining,
          replaceRequestedAt: null,
          replaceEffectiveAt: null,
          pendingLimitPriceMinorUnits: null,
          pendingQuantityUnits: null,
        }),
      );
    }
  }

  private processPendingCancels(): void {
    for (const [orderId, order] of this.orders) {
      if (order.status !== 'CANCEL_PENDING' && order.status !== 'PENDING_ACTIVATION') {
        continue;
      }
      if (!cancelEffectiveBy(this.now, order.cancelEffectiveAt)) {
        continue;
      }
      this.orders.set(
        orderId,
        Object.freeze({
          ...order,
          status: 'CANCELLED',
          remainingQuantityUnits: 0n,
        }),
      );
    }
  }

  private isOrderMatchable(order: SimulatedWorkingOrder): boolean {
    if (order.cancelEffectiveAt && cancelEffectiveBy(this.now, order.cancelEffectiveAt)) {
      return false;
    }
    if (order.status !== 'WORKING' && order.status !== 'PARTIALLY_FILLED' && order.status !== 'STOP_TRIGGERED') {
      return false;
    }
    if (!isActiveBy(this.now, order.activeAt)) {
      return false;
    }
    return order.remainingQuantityUnits > 0n;
  }

  private bookIsStaleForUpdate(update: MarketUpdate): boolean {
    if (update.kind === 'LEVEL_2_BOOK') {
      const book = marketBookFromLevel2(update.snapshot);
      return isBookStale(book, this.now, this.maxBookAgeMs);
    }
    if (update.kind === 'QUOTE') {
      const book = marketBookFromQuote(update.quote);
      return isBookStale(book, this.now, this.maxBookAgeMs);
    }
    return false;
  }

  private postOnlyWouldTake(request: SubmitOrderRequest): boolean {
    const update = this.lastMarketUpdate;
    if (!update) {
      return request.orderType === 'MARKET';
    }
    let book;
    if (update.kind === 'LEVEL_2_BOOK') {
      book = marketBookFromLevel2(update.snapshot);
    } else if (update.kind === 'QUOTE') {
      book = marketBookFromQuote(update.quote);
    } else {
      return request.orderType === 'MARKET';
    }
    if (request.orderType === 'MARKET' || request.orderType === 'STOP') {
      return true;
    }
    const limit = request.limitPriceMinorUnits ?? null;
    if (limit == null) {
      return false;
    }
    if (request.side === 'BUY') {
      const ask = bestAsk(book);
      return ask != null && limit >= ask.priceMinorUnits;
    }
    const bid = bestBid(book);
    return bid != null && limit <= bid.priceMinorUnits;
  }

  private applyFillToPosition(instrumentId: string, side: 'BUY' | 'SELL', quantityUnits: bigint): void {
    const current = this.getPositionUnits(instrumentId);
    const delta = side === 'BUY' ? quantityUnits : -quantityUnits;
    this.positionUnitsByInstrument.set(instrumentId, current + delta);
  }

  private tryMatchWorkingOrders(): void {
    const update = this.lastMarketUpdate;
    if (!update) {
      return;
    }
    if (this.bookIsStaleForUpdate(update)) {
      return;
    }
    const ctx = this.matchingContext();
    for (const [orderId, order] of [...this.orders.entries()]) {
      if (!this.isOrderMatchable(order)) {
        continue;
      }
      if (update.kind === 'LEVEL_2_BOOK' && update.snapshot.instrumentId !== order.instrumentId) {
        continue;
      }
      if (update.kind === 'QUOTE' && update.quote.instrumentId !== order.instrumentId) {
        continue;
      }
      if (update.kind === 'TRADE' && update.trade.instrumentId !== order.instrumentId) {
        continue;
      }
      if (update.kind === 'BAR' && update.bar.instrumentId !== order.instrumentId) {
        continue;
      }

      let result;
      switch (update.kind) {
        case 'LEVEL_2_BOOK':
          result = matchOrderAgainstLevel2(order, update.snapshot, ctx);
          break;
        case 'QUOTE':
          result = matchOrderAgainstQuote(order, update.quote, ctx);
          break;
        case 'TRADE':
          result = matchOrderAgainstTrade(order, update.trade, ctx);
          break;
        case 'BAR':
          result = matchOrderAgainstBar(order, update.bar, ctx);
          break;
        default:
          continue;
      }
      this.orders.set(orderId, result.order);
      for (const fill of result.newFills) {
        this.fills.push(fill);
        this.applyFillToPosition(fill.instrumentId, fill.side, fill.quantityUnits);
      }
    }
  }
}

function violatesReduceOnly(positionUnits: bigint, side: 'BUY' | 'SELL'): boolean {
  if (side === 'BUY' && positionUnits >= 0n) {
    return true;
  }
  if (side === 'SELL' && positionUnits <= 0n) {
    return true;
  }
  return false;
}
