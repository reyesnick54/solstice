/**
 * MD01 — map venue-normalized shapes to canonical market-data events.
 */

import {
  MARKET_DATA_EVENT_AUTHORITY,
  MARKET_DATA_EVENT_SCHEMA_VERSION,
  type MarketQuoteEvent,
  type MarketTradeEvent,
  type MarketBookSnapshot,
} from '../market-data-capability/canonical-events.ts';
import type {
  HeliosNormalizedBook,
  HeliosNormalizedQuote,
  HeliosNormalizedTrade,
} from './normalized-market-data.ts';

export type VenueToMd01Context = Readonly<{
  readonly providerId: string;
  readonly sourceFeedId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly entitlementRef: string;
  readonly sourceRef: string;
  readonly sunreyReceiveTime: string;
  readonly normalizedTime: string;
  readonly knowableAt: string;
  readonly providerPublishTime?: string | null;
}>;

function baseFields(
  ctx: VenueToMd01Context,
  eventKind: MarketTradeEvent['eventKind'] | MarketQuoteEvent['eventKind'] | MarketBookSnapshot['eventKind'],
  eventId: string,
  eventTime: string,
  sourceSequence: bigint | null,
) {
  return Object.freeze({
    schemaVersion: MARKET_DATA_EVENT_SCHEMA_VERSION,
    eventKind,
    authority: MARKET_DATA_EVENT_AUTHORITY,
    grantsExecutionAuthority: false as const,
    eventId,
    instrumentId: ctx.instrumentId,
    venueId: ctx.venueId,
    providerId: ctx.providerId,
    sourceFeedId: ctx.sourceFeedId,
    sourceSequence,
    eventTime,
    exchangeTime: eventTime,
    providerPublishTime: ctx.providerPublishTime ?? null,
    sunreyReceiveTime: ctx.sunreyReceiveTime,
    normalizedTime: ctx.normalizedTime,
    knowableAt: ctx.knowableAt,
    sourceRef: ctx.sourceRef,
    entitlementRef: ctx.entitlementRef,
    qualityState: 'VALID' as const,
  });
}

export function normalizedTradeToMarketTradeEvent(
  trade: HeliosNormalizedTrade,
  ctx: VenueToMd01Context,
): MarketTradeEvent {
  const seq = trade.sequence === null ? null : BigInt(trade.sequence);
  return Object.freeze({
    ...baseFields(ctx, 'MarketTradeEvent', trade.tradeId, trade.eventTimeUtc, seq),
    eventKind: 'MarketTradeEvent',
    tradeId: trade.tradeId,
    price: trade.price,
    quantity: trade.quantity,
    aggressorSide: trade.side,
  });
}

export function normalizedQuoteToMarketQuoteEvent(
  quote: HeliosNormalizedQuote,
  ctx: VenueToMd01Context,
): MarketQuoteEvent {
  const eventId = `${quote.symbol.canonical}:${quote.eventTimeUtc}:quote`;
  const seq = quote.sequence === null ? null : BigInt(quote.sequence);
  return Object.freeze({
    ...baseFields(ctx, 'MarketQuoteEvent', eventId, quote.eventTimeUtc, seq),
    eventKind: 'MarketQuoteEvent',
    bidPrice: quote.bidPrice,
    bidQuantity: quote.bidQuantity,
    askPrice: quote.askPrice,
    askQuantity: quote.askQuantity,
  });
}

export function normalizedBookToMarketBookSnapshot(
  book: HeliosNormalizedBook,
  ctx: VenueToMd01Context,
): MarketBookSnapshot {
  const eventId = `${book.symbol.canonical}:${book.eventTimeUtc}:book`;
  const seq = book.sequence === null ? null : BigInt(book.sequence);
  return Object.freeze({
    ...baseFields(ctx, 'MarketBookSnapshot', eventId, book.eventTimeUtc, seq),
    eventKind: 'MarketBookSnapshot',
    bids: Object.freeze(book.bids.map((level) => Object.freeze({ ...level }))),
    asks: Object.freeze(book.asks.map((level) => Object.freeze({ ...level }))),
    bookSequence: seq,
  });
}
