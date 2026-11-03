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
  effectiveSubmitAt,
  isActiveBy,
  type LatencyModelConfig,
} from './latency-model.ts';
import {
  matchOrderAgainstBar,
  matchOrderAgainstLevel2,
  matchOrderAgainstQuote,
  matchOrderAgainstTrade,
  type MatchingContext,
} from './matching-engine.ts';
import { isBookStale, marketBookFromLevel2, marketBookFromQuote } from './market-book.ts';
import { DEFAULT_SLIPPAGE_MODEL, type SlippageModelConfig } from './slippage-model.ts';
import type { BarExecutionMode, OhlcPathSequence } from './taxonomy.ts';
import type {
  CancelOrderResult,
  MarketUpdate,
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

  private now: UtcInstant;
  private orderSeq = 0;
  private fillSeq = 0;
  private readonly orders = new Map<string, SimulatedWorkingOrder>();
  private readonly fills: SimulatedFill[] = [];
  private lastMarketUpdate: MarketUpdate | null = null;

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
      currency: request.currency,
      fills: Object.freeze([]),
    });
    this.orders.set(orderId, order);
    this.processPendingActivations();
    this.tryMatchWorkingOrders();
    return Object.freeze({ accepted: true, order: this.orders.get(orderId)! });
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
    if (order.status === 'CANCEL_PENDING') {
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
      }
    }
  }
}
