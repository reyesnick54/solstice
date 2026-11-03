/**
 * HELIOS NATIVE04 — book state captured on each simulated fill.
 */

import type { UtcInstant } from '@solstice/domain';

import { bestAsk, bestBid, type MarketBook } from './market-book.ts';

export type BookStateSnapshot = {
  readonly snapshotId: string;
  readonly observedAt: UtcInstant;
  readonly bestBidMinorUnits: bigint | null;
  readonly bestAskMinorUnits: bigint | null;
  readonly bidDepthLevels: number;
  readonly askDepthLevels: number;
  readonly maxDepthLevelsApplied: number | null;
};

export function bookStateFromMarketBook(book: MarketBook, maxDepthLevelsApplied: number | null): BookStateSnapshot {
  const bid = bestBid(book);
  const ask = bestAsk(book);
  return Object.freeze({
    snapshotId: book.snapshotId,
    observedAt: book.observedAt as UtcInstant,
    bestBidMinorUnits: bid?.priceMinorUnits ?? null,
    bestAskMinorUnits: ask?.priceMinorUnits ?? null,
    bidDepthLevels: book.bids.length,
    askDepthLevels: book.asks.length,
    maxDepthLevelsApplied,
  });
}
