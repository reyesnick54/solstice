/**
 * BYTEX Tardis adapter → HELIOS historical read-model mapping (read-only, fixture posture).
 *
 * Reference: Bytex.Adapters.Tardis — normalized CSV/JSON replay shapes only.
 */

import type { HeliosNormalizedBook, HeliosNormalizedQuote } from '@solstice/provider-sdk';
import { HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION } from '@solstice/provider-sdk';

export type TardisQuoteRow = Readonly<{
  readonly exchange: string;
  readonly symbol: string;
  readonly timestamp: number;
  readonly localTimestamp: number;
  readonly askAmount: number;
  readonly askPrice: number;
  readonly bidPrice: number;
  readonly bidAmount: number;
}>;

export type TardisBookChangeRow = Readonly<{
  readonly exchange: string;
  readonly symbol: string;
  readonly timestamp: number;
  readonly isSnapshot: boolean;
  readonly side: 'ask' | 'bid';
  readonly price: number;
  readonly amount: number;
}>;

export function mapTardisQuoteToHelios(input: {
  readonly venueId: 'binance' | 'bybit' | 'okx' | 'kraken' | 'bitget' | 'gate' | 'kucoin';
  readonly canonicalSymbol: string;
  readonly row: TardisQuoteRow;
}): HeliosNormalizedQuote {
  return Object.freeze({
    schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
    venueId: input.venueId,
    symbol: Object.freeze({
      canonical: input.canonicalSymbol,
      raw: input.row.symbol,
      venueId: input.venueId,
      baseAsset: input.canonicalSymbol.split('/')[0] ?? 'UNKNOWN',
      quoteAsset: input.canonicalSymbol.split('/')[1] ?? 'USD',
      instrumentClass: 'spot',
    }),
    bidPrice: String(input.row.bidPrice),
    bidQuantity: String(input.row.bidAmount),
    askPrice: String(input.row.askPrice),
    askQuantity: String(input.row.askAmount),
    eventTimeUtc: new Date(input.row.timestamp / 1000).toISOString(),
    sequence: null,
  });
}

export function mapTardisBookChangeToHelios(input: {
  readonly venueId: 'binance' | 'bybit' | 'okx' | 'kraken';
  readonly canonicalSymbol: string;
  readonly bids: readonly { price: string; quantity: string }[];
  readonly asks: readonly { price: string; quantity: string }[];
  readonly eventTimeUtc: string;
  readonly isSnapshot: boolean;
}): HeliosNormalizedBook {
  return Object.freeze({
    schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
    venueId: input.venueId,
    symbol: Object.freeze({
      canonical: input.canonicalSymbol,
      raw: input.canonicalSymbol,
      venueId: input.venueId,
      baseAsset: input.canonicalSymbol.split('/')[0] ?? 'UNKNOWN',
      quoteAsset: input.canonicalSymbol.split('/')[1] ?? 'USD',
      instrumentClass: 'spot',
    }),
    bids: Object.freeze(input.bids),
    asks: Object.freeze(input.asks),
    eventTimeUtc: input.eventTimeUtc,
    sequence: null,
    isSnapshot: input.isSnapshot,
  });
}
