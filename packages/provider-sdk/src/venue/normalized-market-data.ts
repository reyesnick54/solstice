/**
 * HELIOS NATIVE05 — canonical normalized market-data shapes for venue adapters.
 *
 * All prices and quantities are decimal strings (never floating-point).
 */

import type { HeliosOs04VenueId } from './taxonomy.ts';

export const HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION = 'helios.venue-normalization.v1' as const;

export type HeliosCanonicalSymbol = Readonly<{
  readonly canonical: string;
  readonly raw: string;
  readonly venueId: HeliosOs04VenueId;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly instrumentClass: 'spot' | 'perpetual' | 'future' | 'option' | 'unknown';
}>;

export type HeliosInstrumentMetadata = Readonly<{
  readonly symbol: HeliosCanonicalSymbol;
  readonly priceDecimals: number;
  readonly quantityDecimals: number;
  readonly minQuantity: string;
  readonly minNotionalMinor: string;
  readonly quoteCurrency: string;
  readonly tickSize: string;
  readonly stepSize: string;
  readonly status: 'tradable' | 'halted' | 'delisting' | 'unknown';
}>;

export type HeliosNormalizedQuote = Readonly<{
  readonly schemaVersion: typeof HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION;
  readonly venueId: HeliosOs04VenueId;
  readonly symbol: HeliosCanonicalSymbol;
  readonly bidPrice: string;
  readonly bidQuantity: string;
  readonly askPrice: string;
  readonly askQuantity: string;
  readonly eventTimeUtc: string;
  readonly sequence: number | null;
}>;

export type HeliosNormalizedTrade = Readonly<{
  readonly schemaVersion: typeof HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION;
  readonly venueId: HeliosOs04VenueId;
  readonly symbol: HeliosCanonicalSymbol;
  readonly tradeId: string;
  readonly price: string;
  readonly quantity: string;
  readonly side: 'buy' | 'sell' | 'unknown';
  readonly eventTimeUtc: string;
  readonly sequence: number | null;
}>;

export type HeliosNormalizedBookLevel = Readonly<{
  readonly price: string;
  readonly quantity: string;
}>;

export type HeliosNormalizedBook = Readonly<{
  readonly schemaVersion: typeof HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION;
  readonly venueId: HeliosOs04VenueId;
  readonly symbol: HeliosCanonicalSymbol;
  readonly bids: readonly HeliosNormalizedBookLevel[];
  readonly asks: readonly HeliosNormalizedBookLevel[];
  readonly eventTimeUtc: string;
  readonly sequence: number | null;
  readonly isSnapshot: boolean;
}>;

export type HeliosNormalizedCandle = Readonly<{
  readonly schemaVersion: typeof HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION;
  readonly venueId: HeliosOs04VenueId;
  readonly symbol: HeliosCanonicalSymbol;
  readonly openTimeUtc: string;
  readonly closeTimeUtc: string;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly volume: string;
  readonly interval: string;
}>;
