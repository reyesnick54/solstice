/**
 * Order-book normalization and validation.
 * Does not imply order-book capability for providers that do not supply it.
 */

import { isUtcInstant } from '../../../../domain/src/time.ts';
import type { OrderBookLevel, OrderBookSnapshot } from './types.ts';

export type OrderBookValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function validateOrderBookLevel(level: OrderBookLevel): OrderBookValidationResult {
  if (level.priceMinorUnits <= 0n) {
    return { ok: false, code: 'MALFORMED_ORDER_BOOK', message: 'order book price must be positive' };
  }
  if (level.quantityMinorUnits < 0n) {
    return { ok: false, code: 'MALFORMED_ORDER_BOOK', message: 'order book quantity cannot be negative' };
  }
  if (!Number.isFinite(level.depth) || level.depth < 0) {
    return { ok: false, code: 'MALFORMED_ORDER_BOOK', message: 'order book depth must be non-negative' };
  }
  return { ok: true };
}

export function validateOrderBookSnapshot(
  snapshot: OrderBookSnapshot,
  options: { readonly allowCrossedMarket?: boolean } = {},
): OrderBookValidationResult {
  if (!isUtcInstant(snapshot.sourceTimestamp)) {
    return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'order book sourceTimestamp is malformed' };
  }
  if (!isUtcInstant(snapshot.arrivalTimestamp)) {
    return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'order book arrivalTimestamp is malformed' };
  }
  if (Date.parse(snapshot.arrivalTimestamp) < Date.parse(snapshot.sourceTimestamp)) {
    return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'order book arrival precedes source event' };
  }

  for (const bid of snapshot.bids) {
    const result = validateOrderBookLevel(bid);
    if (!result.ok) return result;
  }
  for (const ask of snapshot.asks) {
    const result = validateOrderBookLevel(ask);
    if (!result.ok) return result;
  }

  const bestBid = snapshot.bids[0]?.priceMinorUnits ?? null;
  const bestAsk = snapshot.asks[0]?.priceMinorUnits ?? null;
  if (bestBid !== null && bestAsk !== null && bestBid >= bestAsk && !options.allowCrossedMarket) {
    return { ok: false, code: 'CROSSED_MARKET', message: 'crossed order book is not permitted' };
  }

  return { ok: true };
}

export function normalizeOrderBookLevels(
  levels: readonly OrderBookLevel[],
  side: 'bid' | 'ask',
): readonly OrderBookLevel[] {
  const sorted = [...levels].sort((a, b) => {
    const cmp = side === 'bid'
      ? Number(b.priceMinorUnits - a.priceMinorUnits)
      : Number(a.priceMinorUnits - b.priceMinorUnits);
    return cmp;
  });
  return Object.freeze(sorted.map((level, index) => Object.freeze({ ...level, depth: index + 1 })));
}
