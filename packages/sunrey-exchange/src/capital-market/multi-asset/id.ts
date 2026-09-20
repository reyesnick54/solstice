/**
 * Stable SunRey instrument ID construction.
 *
 * Ticker alone is never canonical identity. IDs encode asset class, jurisdiction,
 * venue, and pair components where applicable.
 */

import type { MultiAssetClass } from './types.ts';

export function buildCanonicalInstrumentId(input: {
  readonly assetClass: MultiAssetClass;
  readonly jurisdiction: string;
  readonly symbol: string;
  readonly venueId: string;
  readonly baseAsset?: string | null;
  readonly quoteAsset?: string | null;
  readonly contractMonth?: string | null;
}): string {
  const jurisdiction = input.jurisdiction.toUpperCase();
  const venueId = input.venueId.toUpperCase();
  const symbol = input.symbol.toUpperCase();

  switch (input.assetClass) {
    case 'EQUITY':
    case 'ETF':
      return `SECURITY:${jurisdiction}:${symbol}:${venueId}`;
    case 'INDEX':
      return `INDEX:${jurisdiction}:${symbol}:${venueId}`;
    case 'FUTURE': {
      const month = input.contractMonth?.toUpperCase() ?? 'UNKNOWN';
      return `FUTURE:${jurisdiction}:${symbol}:${venueId}:${month}`;
    }
    case 'COMMODITY':
      return `COMMODITY:${jurisdiction}:${symbol}:${venueId}`;
    case 'CRYPTO_SPOT': {
      const base = input.baseAsset?.toUpperCase() ?? symbol;
      const quote = input.quoteAsset?.toUpperCase() ?? 'USD';
      return `CRYPTO:${jurisdiction}:${base}:${quote}:${venueId}`;
    }
    case 'FX_SPOT': {
      const base = input.baseAsset?.toUpperCase() ?? symbol.slice(0, 3);
      const quote = input.quoteAsset?.toUpperCase() ?? symbol.slice(3, 6);
      return `FX:${jurisdiction}:${base}:${quote}:${venueId}`;
    }
    case 'CASH':
      return `CASH:${jurisdiction}:${symbol}:${venueId}`;
    default:
      return `INSTRUMENT:${jurisdiction}:${symbol}:${venueId}`;
  }
}
