/**
 * Canonical capital-market instrument registry.
 *
 * Ticker alone is never canonical identity. Instruments are keyed by
 * jurisdiction, venue, and product class to prevent cross-venue collisions.
 */

import type { CapitalMarketAssetClass, CapitalMarketInstrument, CapitalMarketVenue } from './types.ts';

export const CAPITAL_MARKET_INSTRUMENT_REGISTRY_ID = 'sunrey.capital-market.instruments.v1' as const;

const VENUE_NASDAQ: CapitalMarketVenue = Object.freeze({
  venueId: 'XNAS',
  mic: 'XNAS',
  displayName: 'NASDAQ',
  exchange: 'NASDAQ',
});

const VENUE_ARCA: CapitalMarketVenue = Object.freeze({
  venueId: 'ARCX',
  mic: 'ARCX',
  displayName: 'NYSE Arca',
  exchange: 'ARCA',
});

export type RegisteredCapitalMarketInstrument = CapitalMarketInstrument & {
  readonly displayName: string;
  readonly providerSymbols: Readonly<Record<string, string>>;
};

function instrument(input: RegisteredCapitalMarketInstrument): RegisteredCapitalMarketInstrument {
  return Object.freeze(input);
}

export const REGISTERED_CAPITAL_MARKET_INSTRUMENTS: readonly RegisteredCapitalMarketInstrument[] = Object.freeze([
  instrument({
    instrumentId: 'SECURITY:US:AAPL:XNAS',
    symbol: 'AAPL',
    vendorSymbol: 'AAPL',
    assetClass: 'equity',
    venue: VENUE_NASDAQ,
    currency: 'USD',
    isin: 'US0378331005',
    figi: null,
    providerNativeId: 'AAPL',
    displayName: 'Apple Inc.',
    providerSymbols: Object.freeze({ finnhub: 'AAPL' }),
  }),
  instrument({
    instrumentId: 'SECURITY:US:SPY:ARCX',
    symbol: 'SPY',
    vendorSymbol: 'SPY',
    assetClass: 'etf',
    venue: VENUE_ARCA,
    currency: 'USD',
    isin: 'US78462F1030',
    figi: null,
    providerNativeId: 'SPY',
    displayName: 'SPDR S&P 500 ETF Trust',
    providerSymbols: Object.freeze({ finnhub: 'SPY' }),
  }),
  instrument({
    instrumentId: 'SECURITY:US:GLD:ARCX',
    symbol: 'GLD',
    vendorSymbol: 'GLD',
    assetClass: 'etf',
    venue: VENUE_ARCA,
    currency: 'USD',
    isin: 'US78463V1070',
    figi: null,
    providerNativeId: 'GLD',
    displayName: 'SPDR Gold Shares',
    providerSymbols: Object.freeze({ finnhub: 'GLD' }),
  }),
]);

const byId = new Map(REGISTERED_CAPITAL_MARKET_INSTRUMENTS.map((row) => [row.instrumentId, row]));
const byTickerVenue = new Map(
  REGISTERED_CAPITAL_MARKET_INSTRUMENTS.map((row) => [`${row.symbol}@${row.venue.venueId}`, row]),
);
const byProviderSymbol = new Map(
  REGISTERED_CAPITAL_MARKET_INSTRUMENTS.flatMap((row) =>
    Object.entries(row.providerSymbols).map(([providerId, symbol]) => [`${providerId}:${symbol}`, row]),
  ),
);

export function resolveCapitalMarketInstrument(instrumentId: string): RegisteredCapitalMarketInstrument | undefined {
  return byId.get(instrumentId);
}

export function resolveCapitalMarketInstrumentByTickerVenue(
  ticker: string,
  venueId: string,
): RegisteredCapitalMarketInstrument | undefined {
  return byTickerVenue.get(`${ticker}@${venueId}`);
}

export function resolveCapitalMarketInstrumentByProviderSymbol(
  providerId: string,
  providerSymbol: string,
): RegisteredCapitalMarketInstrument | undefined {
  return byProviderSymbol.get(`${providerId}:${providerSymbol}`);
}

export function canonicalInstrumentId(
  jurisdiction: string,
  ticker: string,
  venueId: string,
  assetClass: CapitalMarketAssetClass,
): string {
  return `SECURITY:${jurisdiction}:${ticker}:${venueId}`;
}

export function searchCapitalMarketInstruments(query: string, limit = 20): readonly RegisteredCapitalMarketInstrument[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return Object.freeze(REGISTERED_CAPITAL_MARKET_INSTRUMENTS.slice(0, limit));
  }
  return Object.freeze(
    REGISTERED_CAPITAL_MARKET_INSTRUMENTS.filter(
      (row) =>
        row.instrumentId.toLowerCase().includes(normalized) ||
        row.symbol.toLowerCase().includes(normalized) ||
        row.displayName.toLowerCase().includes(normalized) ||
        row.venue.venueId.toLowerCase().includes(normalized),
    ).slice(0, limit),
  );
}
