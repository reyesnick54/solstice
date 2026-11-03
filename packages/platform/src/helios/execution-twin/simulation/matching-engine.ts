/**
 * HELIOS OS03 / NATIVE04 — order-type matching against simulated market inputs.
 *
 * SPDX-Provenance: Adapted from BYTEX (Apache-2.0)
 * Upstream: https://github.com/BYTEX-TRADE/bytex @ 67b3e103043476a0490bb7afa146ec9ac339b116
 * Clean-room TypeScript reimplementation; golden vectors in vendor/assimilation/bytex/.
 */

import type { UtcInstant } from '@solstice/domain';

import {
  buildFillEvidence,
  matchAgainstBook,
  materializeFill,
  type FillModelConfig,
} from './fill-model.ts';
import { bestAsk, bestBid, marketBookFromLevel2, marketBookFromQuote, type MarketBook } from './market-book.ts';
import type { FeeModelConfig } from './fee-model.ts';
import type { LatencyModelConfig } from './latency-model.ts';
import type { SlippageModelConfig } from './slippage-model.ts';
import type {
  BarExecutionMode,
  ExecutionFidelityLevel,
  MarketDataInputGranularity,
  OhlcPathSequence,
} from './taxonomy.ts';
import type {
  BarObservation,
  Level2Snapshot,
  ObservationRef,
  QuoteObservation,
  SimulatedFill,
  SimulatedWorkingOrder,
  TradeObservation,
} from './types.ts';

export type MatchingContext = {
  readonly venueId: string;
  readonly asOf: UtcInstant;
  readonly fillModel: FillModelConfig;
  readonly feeModel: FeeModelConfig;
  readonly slippageModel: SlippageModelConfig;
  readonly latencyModel: LatencyModelConfig;
  readonly barExecutionMode: BarExecutionMode;
  readonly ohlcPathSequence: OhlcPathSequence;
  readonly maxBookDepthLevels: number | null;
  readonly nextFillSeq: () => string;
};

function observationRefFromBook(book: MarketBook, granularity: MarketDataInputGranularity): ObservationRef {
  return Object.freeze({
    refId: book.snapshotId,
    granularity,
    observedAt: book.observedAt as UtcInstant,
  });
}

function stopTriggered(order: SimulatedWorkingOrder, referencePriceMinor: bigint): boolean {
  if (order.stopPriceMinorUnits == null) {
    return false;
  }
  if (order.side === 'BUY') {
    return referencePriceMinor >= order.stopPriceMinorUnits;
  }
  return referencePriceMinor <= order.stopPriceMinorUnits;
}

function barPathPrices(bar: BarObservation, sequence: OhlcPathSequence): readonly bigint[] {
  if (sequence === 'O_H_L_C') {
    return Object.freeze([bar.openMinorUnits, bar.highMinorUnits, bar.lowMinorUnits, bar.closeMinorUnits]);
  }
  return Object.freeze([bar.openMinorUnits, bar.lowMinorUnits, bar.highMinorUnits, bar.closeMinorUnits]);
}

function syntheticBookFromBar(
  bar: BarObservation,
  mode: BarExecutionMode,
  sequence: OhlcPathSequence,
  side: 'BUY' | 'SELL',
): { readonly book: MarketBook; readonly fidelity: ExecutionFidelityLevel; readonly refs: readonly ObservationRef[] } {
  const ref: ObservationRef = Object.freeze({
    refId: bar.barId,
    granularity: 'BAR',
    observedAt: bar.observedAt,
  });
  if (mode === 'CLOSE_ONLY') {
    const price = bar.closeMinorUnits;
    const book: MarketBook = Object.freeze({
      instrumentId: bar.instrumentId,
      currency: bar.currency,
      observedAt: bar.observedAt,
      snapshotId: bar.barId,
      bids: Object.freeze([{ priceMinorUnits: price, sizeUnits: bar.volumeUnits > 0n ? bar.volumeUnits : 1_000_000n }]),
      asks: Object.freeze([{ priceMinorUnits: price, sizeUnits: bar.volumeUnits > 0n ? bar.volumeUnits : 1_000_000n }]),
    });
    return Object.freeze({ book, fidelity: 'BAR', refs: Object.freeze([ref]) });
  }
  const path = barPathPrices(bar, sequence);
  const touch = side === 'BUY' ? path.reduce((max, p) => (p > max ? p : max), path[0]!) : path.reduce((min, p) => (p < min ? p : min), path[0]!);
  const book: MarketBook = Object.freeze({
    instrumentId: bar.instrumentId,
    currency: bar.currency,
    observedAt: bar.observedAt,
    snapshotId: `${bar.barId}:${sequence}`,
    bids: Object.freeze([{ priceMinorUnits: touch, sizeUnits: bar.volumeUnits > 0n ? bar.volumeUnits : 1_000_000n }]),
    asks: Object.freeze([{ priceMinorUnits: touch, sizeUnits: bar.volumeUnits > 0n ? bar.volumeUnits : 1_000_000n }]),
  });
  return Object.freeze({ book, fidelity: 'BAR', refs: Object.freeze([ref]) });
}

export function matchOrderAgainstLevel2(
  order: SimulatedWorkingOrder,
  snapshot: Level2Snapshot,
  ctx: MatchingContext,
): { readonly order: SimulatedWorkingOrder; readonly newFills: readonly SimulatedFill[] } {
  const book = marketBookFromLevel2(snapshot);
  return matchOrderAgainstBook(order, book, 'LEVEL_2_BOOK', 'LEVEL_2_BOOK', [observationRefFromBook(book, 'LEVEL_2_BOOK')], ctx, null, null);
}

export function matchOrderAgainstQuote(
  order: SimulatedWorkingOrder,
  quote: QuoteObservation,
  ctx: MatchingContext,
): { readonly order: SimulatedWorkingOrder; readonly newFills: readonly SimulatedFill[] } {
  const book = marketBookFromQuote(quote);
  return matchOrderAgainstBook(order, book, 'QUOTE', 'QUOTE', [observationRefFromBook(book, 'QUOTE')], ctx, null, null);
}

export function matchOrderAgainstTrade(
  order: SimulatedWorkingOrder,
  trade: TradeObservation,
  ctx: MatchingContext,
): { readonly order: SimulatedWorkingOrder; readonly newFills: readonly SimulatedFill[] } {
  const ref: ObservationRef = Object.freeze({
    refId: trade.tradeId,
    granularity: 'TRADE',
    observedAt: trade.observedAt,
  });
  const book: MarketBook = Object.freeze({
    instrumentId: trade.instrumentId,
    currency: trade.currency,
    observedAt: trade.observedAt,
    snapshotId: trade.tradeId,
    bids: Object.freeze([{ priceMinorUnits: trade.priceMinorUnits, sizeUnits: trade.sizeUnits }]),
    asks: Object.freeze([{ priceMinorUnits: trade.priceMinorUnits, sizeUnits: trade.sizeUnits }]),
  });
  return matchOrderAgainstBook(order, book, 'TRADE', 'TRADE', [ref], ctx, null, null);
}

export function matchOrderAgainstBar(
  order: SimulatedWorkingOrder,
  bar: BarObservation,
  ctx: MatchingContext,
): { readonly order: SimulatedWorkingOrder; readonly newFills: readonly SimulatedFill[] } {
  const synthetic = syntheticBookFromBar(bar, ctx.barExecutionMode, ctx.ohlcPathSequence, order.side);
  return matchOrderAgainstBook(
    order,
    synthetic.book,
    'BAR',
    synthetic.fidelity,
    synthetic.refs,
    ctx,
    ctx.barExecutionMode,
    ctx.barExecutionMode === 'DETERMINISTIC_OHLC_PATH' ? ctx.ohlcPathSequence : null,
  );
}

function matchOrderAgainstBook(
  order: SimulatedWorkingOrder,
  book: MarketBook,
  inputGranularity: MarketDataInputGranularity,
  fidelity: ExecutionFidelityLevel,
  observationRefs: readonly ObservationRef[],
  ctx: MatchingContext,
  barMode: BarExecutionMode | null,
  ohlcPath: OhlcPathSequence | null,
): { readonly order: SimulatedWorkingOrder; readonly newFills: readonly SimulatedFill[] } {
  if (order.remainingQuantityUnits <= 0n) {
    return Object.freeze({ order, newFills: Object.freeze([]) });
  }

  const reference =
    order.side === 'BUY' ? bestAsk(book)?.priceMinorUnits : bestBid(book)?.priceMinorUnits;
  if (reference == null) {
    return Object.freeze({ order, newFills: Object.freeze([]) });
  }

  let working = order;
  if ((order.orderType === 'STOP' || order.orderType === 'STOP_LIMIT') && !order.stopTriggered) {
    if (!stopTriggered(order, reference)) {
      return Object.freeze({ order, newFills: Object.freeze([]) });
    }
    working = Object.freeze({ ...order, stopTriggered: true, status: 'STOP_TRIGGERED' });
  }

  const effectiveType =
    working.orderType === 'STOP'
      ? 'MARKET'
      : working.orderType === 'STOP_LIMIT' && working.stopTriggered
        ? 'LIMIT'
        : working.orderType;

  if (effectiveType === 'LIMIT' && working.limitPriceMinorUnits == null) {
    return Object.freeze({ order: working, newFills: Object.freeze([]) });
  }

  const role = effectiveType === 'MARKET' ? 'TAKER' : 'MAKER';
  const crossSpread =
    effectiveType === 'MARKET' ||
    (working.side === 'BUY' &&
      bestAsk(book) != null &&
      working.limitPriceMinorUnits != null &&
      working.limitPriceMinorUnits >= bestAsk(book)!.priceMinorUnits) ||
    (working.side === 'SELL' &&
      bestBid(book) != null &&
      working.limitPriceMinorUnits != null &&
      working.limitPriceMinorUnits <= bestBid(book)!.priceMinorUnits);

  const matchRole = crossSpread ? 'TAKER' : role;
  const { slices, unfilledUnits } = matchAgainstBook({
    book,
    side: working.side,
    quantityUnits: working.remainingQuantityUnits,
    limitPriceMinorUnits: effectiveType === 'MARKET' ? null : working.limitPriceMinorUnits,
    asLiquidityRole: matchRole,
    fillModel: ctx.fillModel,
    slippageModel: ctx.slippageModel,
    applyImpact: matchRole === 'TAKER' && fidelity !== 'BAR',
    maxBookDepthLevels: ctx.maxBookDepthLevels,
  });

  let allowedSlices = slices;
  if (working.timeInForce === 'FOK' && unfilledUnits > 0n) {
    return Object.freeze({
      order: Object.freeze({ ...working, status: 'REJECTED', remainingQuantityUnits: working.quantityUnits }),
      newFills: Object.freeze([]),
    });
  }
  if (working.timeInForce === 'IOC' && unfilledUnits > 0n) {
    allowedSlices = slices;
  }

  const evidence = buildFillEvidence({
    observationRefs,
    executionFidelityLevel: fidelity,
    inputGranularity,
    latencyModel: ctx.latencyModel,
    slippageModel: ctx.slippageModel,
    feeModel: ctx.feeModel,
    evidenceRefs: Object.freeze([`sim-fill@${ctx.asOf}`]),
    barExecutionMode: barMode,
    ohlcPathSequence: ohlcPath,
    book,
    maxBookDepthLevels: ctx.maxBookDepthLevels,
  });

  const newFills: SimulatedFill[] = [];
  let remaining = working.remainingQuantityUnits;
  for (const slice of allowedSlices) {
    if (remaining <= 0n) {
      break;
    }
    const qty = slice.quantityUnits > remaining ? remaining : slice.quantityUnits;
    newFills.push(
      materializeFill({
        fillId: ctx.nextFillSeq(),
        orderId: working.orderId,
        instrumentId: working.instrumentId,
        side: working.side,
        slice: Object.freeze({ ...slice, quantityUnits: qty }),
        currency: working.currency,
        venueId: ctx.venueId,
        filledAt: ctx.asOf,
        feeModel: ctx.feeModel,
        evidence,
      }),
    );
    remaining -= qty;
  }

  let status = working.status;
  if (newFills.length > 0 && remaining === 0n) {
    status = 'FILLED';
  } else if (newFills.length > 0 && remaining > 0n) {
    status = 'PARTIALLY_FILLED';
    if (working.timeInForce === 'IOC') {
      status = 'CANCELLED';
    }
  } else if (working.timeInForce === 'IOC' || working.timeInForce === 'FOK') {
    status = unfilledUnits === working.remainingQuantityUnits ? 'CANCELLED' : status;
  }

  const updated = Object.freeze({
    ...working,
    remainingQuantityUnits: working.timeInForce === 'IOC' && newFills.length > 0 && remaining > 0n ? 0n : remaining,
    status,
    fills: Object.freeze([...working.fills, ...newFills]),
  });

  return Object.freeze({ order: updated, newFills: Object.freeze(newFills) });
}
