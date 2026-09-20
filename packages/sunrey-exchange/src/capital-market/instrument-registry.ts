/**
 * Canonical capital-market instrument registry.
 *
 * Ticker alone is never canonical identity. Instruments are keyed by
 * jurisdiction, venue, and product class to prevent cross-venue collisions.
 *
 * Backed by the HELIOS M01 multi-asset instrument domain.
 */

import {
  buildMultiAssetInstrumentId,
  providerSymbolsRecord,
  REGISTERED_MULTI_ASSET_INSTRUMENTS,
  resolveMultiAssetInstrument,
  resolveMultiAssetInstrumentByTickerVenue,
  resolveMultiAssetProviderMapping,
  searchMultiAssetInstruments,
  toCapitalMarketAssetClass,
} from './multi-asset/index.ts';
import type { CapitalMarketAssetClass, CapitalMarketInstrument } from './types.ts';
import type { CanonicalMultiAssetInstrument } from './multi-asset/types.ts';

export const CAPITAL_MARKET_INSTRUMENT_REGISTRY_ID = 'sunrey.capital-market.instruments.v1' as const;

export type RegisteredCapitalMarketInstrument = CapitalMarketInstrument & {
  readonly displayName: string;
  readonly providerSymbols: Readonly<Record<string, string>>;
};

function toRegisteredCapitalMarketInstrument(
  record: CanonicalMultiAssetInstrument,
): RegisteredCapitalMarketInstrument {
  const providerSymbols = providerSymbolsRecord(record.providerMappings);
  const primaryProvider = record.providerMappings[0];
  return Object.freeze({
    instrumentId: record.instrumentId,
    symbol: record.symbol,
    vendorSymbol: primaryProvider?.symbol ?? record.symbol,
    assetClass: toCapitalMarketAssetClass(record.assetClass),
    venue: record.venue,
    currency: record.tradingCurrency,
    isin: record.isin,
    figi: record.figi,
    providerNativeId: primaryProvider?.nativeId ?? primaryProvider?.symbol ?? record.symbol,
    displayName: record.displayName,
    providerSymbols,
  });
}

export const M05_EQUITY_INDEX_UNIVERSE = Object.freeze([
  'SECURITY:US:SPY:ARCX',
  'SECURITY:US:QQQ:XNAS',
  'SECURITY:US:AAPL:XNAS',
  'SECURITY:US:MSFT:XNAS',
  'SECURITY:US:NVDA:XNAS',
] as const);

export const REGISTERED_CAPITAL_MARKET_INSTRUMENTS: readonly RegisteredCapitalMarketInstrument[] = Object.freeze(
  REGISTERED_MULTI_ASSET_INSTRUMENTS.filter((row) => row.status === 'ACTIVE').map(toRegisteredCapitalMarketInstrument),
);

export function resolveCapitalMarketInstrument(instrumentId: string): RegisteredCapitalMarketInstrument | undefined {
  const record = resolveMultiAssetInstrument(instrumentId);
  if (!record || record.status === 'INACTIVE') {
    return undefined;
  }
  return toRegisteredCapitalMarketInstrument(record);
}

export function resolveCapitalMarketInstrumentByTickerVenue(
  ticker: string,
  venueId: string,
): RegisteredCapitalMarketInstrument | undefined {
  const record = resolveMultiAssetInstrumentByTickerVenue(ticker, venueId);
  if (!record || record.status === 'INACTIVE') {
    return undefined;
  }
  return toRegisteredCapitalMarketInstrument(record);
}

export function resolveCapitalMarketInstrumentByProviderSymbol(
  providerId: string,
  providerSymbol: string,
): RegisteredCapitalMarketInstrument | undefined {
  const record = resolveMultiAssetProviderMapping(providerId, providerSymbol);
  if (!record || record.status === 'INACTIVE') {
    return undefined;
  }
  return toRegisteredCapitalMarketInstrument(record);
}

export function canonicalInstrumentId(
  jurisdiction: string,
  ticker: string,
  venueId: string,
  assetClass: CapitalMarketAssetClass,
): string {
  return buildMultiAssetInstrumentId({
    assetClass: capitalMarketAssetClassToMultiAsset(assetClass),
    jurisdiction,
    symbol: ticker,
    venueId,
  });
}

export function searchCapitalMarketInstruments(query: string, limit = 20): readonly RegisteredCapitalMarketInstrument[] {
  return Object.freeze(
    searchMultiAssetInstruments({ query, status: 'ACTIVE', limit }).map(toRegisteredCapitalMarketInstrument),
  );
}

function capitalMarketAssetClassToMultiAsset(assetClass: CapitalMarketAssetClass) {
  switch (assetClass) {
    case 'equity':
      return 'EQUITY' as const;
    case 'etf':
      return 'ETF' as const;
    case 'index':
      return 'INDEX' as const;
    case 'commodity':
      return 'COMMODITY' as const;
    case 'crypto':
      return 'CRYPTO_SPOT' as const;
    case 'future':
      return 'FUTURE' as const;
    case 'fx':
      return 'FX_SPOT' as const;
    default:
      return 'EQUITY' as const;
  }
}
