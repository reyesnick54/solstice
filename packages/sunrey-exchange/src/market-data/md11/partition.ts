/**
 * MD11 partition key helpers (trade date × venue × feed × instrument family).
 */

import type { MarketDataPartitionKey } from './types.ts';

export function partitionKeyId(partition: MarketDataPartitionKey): string {
  return `${partition.tradeDate}|${partition.venue}|${partition.feed}|${partition.instrumentFamily}`;
}

export function exchangeTimeTradeDate(exchangeTimeUtc: string): string {
  return exchangeTimeUtc.slice(0, 10);
}

export function buildPartitionKey(input: {
  readonly exchangeTime: string;
  readonly venue: string;
  readonly feed: string;
  readonly instrumentFamily: string;
}): MarketDataPartitionKey {
  return Object.freeze({
    tradeDate: exchangeTimeTradeDate(input.exchangeTime),
    venue: input.venue,
    feed: input.feed,
    instrumentFamily: input.instrumentFamily,
  });
}
