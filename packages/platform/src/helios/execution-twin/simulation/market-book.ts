/**
 * HELIOS OS03 — L2 market book for simulated venue matching.
 */

import type { Level2Snapshot, QuoteObservation } from './types.ts';
import { bookLevel, type BookLevel } from './book-level.ts';

export type MarketBook = {
  readonly instrumentId: string;
  readonly currency: string;
  readonly observedAt: string;
  readonly snapshotId: string;
  readonly bids: readonly BookLevel[];
  readonly asks: readonly BookLevel[];
};

function sortBids(levels: readonly BookLevel[]): readonly BookLevel[] {
  return Object.freeze([...levels].sort((a, b) => (a.priceMinorUnits === b.priceMinorUnits ? 0 : a.priceMinorUnits > b.priceMinorUnits ? -1 : 1)));
}

function sortAsks(levels: readonly BookLevel[]): readonly BookLevel[] {
  return Object.freeze([...levels].sort((a, b) => (a.priceMinorUnits === b.priceMinorUnits ? 0 : a.priceMinorUnits < b.priceMinorUnits ? -1 : 1)));
}

export function marketBookFromLevel2(snapshot: Level2Snapshot): MarketBook {
  return Object.freeze({
    instrumentId: snapshot.instrumentId,
    currency: snapshot.currency,
    observedAt: snapshot.observedAt,
    snapshotId: snapshot.snapshotId,
    bids: sortBids(snapshot.bids.map((row) => bookLevel(row.priceMinorUnits, row.sizeUnits))),
    asks: sortAsks(snapshot.asks.map((row) => bookLevel(row.priceMinorUnits, row.sizeUnits))),
  });
}

export function marketBookFromQuote(quote: QuoteObservation): MarketBook {
  return Object.freeze({
    instrumentId: quote.instrumentId,
    currency: quote.currency,
    observedAt: quote.observedAt,
    snapshotId: quote.quoteId,
    bids: sortBids([bookLevel(quote.bidMinorUnits, quote.bidSizeUnits)]),
    asks: sortAsks([bookLevel(quote.askMinorUnits, quote.askSizeUnits)]),
  });
}

export function bestBid(book: MarketBook): BookLevel | null {
  return book.bids[0] ?? null;
}

export function bestAsk(book: MarketBook): BookLevel | null {
  return book.asks[0] ?? null;
}

export function midPriceMinor(book: MarketBook): bigint | null {
  const bid = bestBid(book);
  const ask = bestAsk(book);
  if (!bid || !ask) {
    return null;
  }
  return (bid.priceMinorUnits + ask.priceMinorUnits) / 2n;
}

export function spreadMinor(book: MarketBook): bigint | null {
  const bid = bestBid(book);
  const ask = bestAsk(book);
  if (!bid || !ask) {
    return null;
  }
  return ask.priceMinorUnits - bid.priceMinorUnits;
}

export function isBookStale(book: MarketBook, asOf: string, maxAgeMs: number): boolean {
  const observedMs = Date.parse(book.observedAt);
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(observedMs) || Number.isNaN(asOfMs)) {
    return true;
  }
  return asOfMs - observedMs > maxAgeMs;
}

export function walkBookForSide(
  book: MarketBook,
  side: 'BUY' | 'SELL',
  quantityUnits: bigint,
  maxDepthLevels: number | null = null,
): readonly { readonly level: BookLevel; readonly filledUnits: bigint }[] {
  const allLevels = side === 'BUY' ? book.asks : book.bids;
  const levels =
    maxDepthLevels != null && maxDepthLevels >= 0
      ? allLevels.slice(0, maxDepthLevels)
      : allLevels;
  const fills: { level: BookLevel; filledUnits: bigint }[] = [];
  let remaining = quantityUnits;
  for (const level of levels) {
    if (remaining <= 0n) {
      break;
    }
    const take = remaining >= level.sizeUnits ? level.sizeUnits : remaining;
    if (take > 0n) {
      fills.push({ level, filledUnits: take });
      remaining -= take;
    }
  }
  return Object.freeze(fills);
}

export function availableLiquidityUnits(book: MarketBook, side: 'BUY' | 'SELL'): bigint {
  const levels = side === 'BUY' ? book.asks : book.bids;
  return levels.reduce((sum, row) => sum + row.sizeUnits, 0n);
}
