/**
 * BYTEX Databento adapter → HELIOS historical read-model mapping (read-only, fixture posture).
 *
 * Reference: Bytex.Adapters.Databento — no live Databento credentials in NATIVE05.
 */

import type { HeliosNormalizedCandle, HeliosNormalizedTrade } from '@solstice/provider-sdk';
import { HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION } from '@solstice/provider-sdk';

export type DatabentoHistoricalRecord = Readonly<{
  readonly publisherId: number;
  readonly instrumentId: number;
  readonly rawSymbol: string;
  readonly tsEventNs: string;
  readonly price: string;
  readonly size: string;
  readonly side: 'A' | 'B' | 'N';
}>;

export function mapDatabentoTradeToHelios(input: {
  readonly venueId: 'binance' | 'bybit' | 'okx' | 'kraken';
  readonly canonicalSymbol: string;
  readonly raw: DatabentoHistoricalRecord;
}): HeliosNormalizedTrade {
  return Object.freeze({
    schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
    venueId: input.venueId,
    symbol: Object.freeze({
      canonical: input.canonicalSymbol,
      raw: input.raw.rawSymbol,
      venueId: input.venueId,
      baseAsset: input.canonicalSymbol.split('/')[0] ?? 'UNKNOWN',
      quoteAsset: input.canonicalSymbol.split('/')[1] ?? 'USD',
      instrumentClass: 'spot',
    }),
    tradeId: `${input.raw.publisherId}:${input.raw.instrumentId}:${input.raw.tsEventNs}`,
    price: input.raw.price,
    quantity: input.raw.size,
    side: input.raw.side === 'B' ? 'buy' : input.raw.side === 'A' ? 'sell' : 'unknown',
    eventTimeUtc: new Date(Number(input.raw.tsEventNs) / 1_000_000).toISOString(),
    sequence: null,
  });
}

export function mapDatabentoOhlcvToHelios(input: {
  readonly venueId: 'binance' | 'bybit' | 'okx' | 'kraken';
  readonly canonicalSymbol: string;
  readonly rawSymbol: string;
  readonly openTimeUtc: string;
  readonly closeTimeUtc: string;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly volume: string;
  readonly interval: string;
}): HeliosNormalizedCandle {
  return Object.freeze({
    schemaVersion: HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
    venueId: input.venueId,
    symbol: Object.freeze({
      canonical: input.canonicalSymbol,
      raw: input.rawSymbol,
      venueId: input.venueId,
      baseAsset: input.canonicalSymbol.split('/')[0] ?? 'UNKNOWN',
      quoteAsset: input.canonicalSymbol.split('/')[1] ?? 'USD',
      instrumentClass: 'spot',
    }),
    openTimeUtc: input.openTimeUtc,
    closeTimeUtc: input.closeTimeUtc,
    open: input.open,
    high: input.high,
    low: input.low,
    close: input.close,
    volume: input.volume,
    interval: input.interval,
  });
}
