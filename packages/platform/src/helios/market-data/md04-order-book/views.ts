/**
 * L1 / L2 / L3 read projections from a canonical order book.
 */

import type { BookDepthMode } from './taxonomy.ts';
import type { BookLevel, BookOrder, CanonicalOrderBook } from './types.ts';

export function projectL1(book: CanonicalOrderBook): {
  readonly bestBid: BookLevel | null;
  readonly bestAsk: BookLevel | null;
} {
  return Object.freeze({
    bestBid: book.bids[0] ?? null,
    bestAsk: book.asks[0] ?? null,
  });
}

export function projectL2(book: CanonicalOrderBook): {
  readonly bids: readonly BookLevel[];
  readonly asks: readonly BookLevel[];
} {
  const depth = book.depthMode === 'L1' ? 1 : undefined;
  return Object.freeze({
    bids: depth != null ? book.bids.slice(0, depth) : book.bids,
    asks: depth != null ? book.asks.slice(0, depth) : book.asks,
  });
}

export function projectL3(book: CanonicalOrderBook): readonly BookOrder[] {
  if (book.depthMode === 'L1' || book.depthMode === 'L2') {
    return book.orders;
  }
  return book.orders;
}

export function effectiveDepthMode(book: CanonicalOrderBook, requested: BookDepthMode): BookDepthMode {
  if (book.depthMode === 'L1') return 'L1';
  if (book.depthMode === 'L2' && requested === 'L3') return 'L2';
  return requested;
}

export function executableTopOfBook(
  book: CanonicalOrderBook,
): { readonly bestBid: BookLevel | null; readonly bestAsk: BookLevel | null } {
  if (!book.integrity.executableBook) {
    return Object.freeze({ bestBid: null, bestAsk: null });
  }
  return projectL1(book);
}
