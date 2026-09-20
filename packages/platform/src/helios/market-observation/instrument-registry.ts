/**
 * M02 multi-asset canonical instrument registry.
 *
 * Aligns with HELIOS M01 multi-asset instrument IDs from capital-market.
 * Ticker alone is never canonical identity.
 */

import type { MarketAssetClass, MarketInstrument, MarketVenue } from './types.ts';

export const HELIOS_MARKET_INSTRUMENT_REGISTRY_ID = 'sunrey.helios.market-instruments.v1' as const;

/** M01-aligned canonical instrument IDs used by M02 time-series fabric. */
export const M02_REFERENCE_INSTRUMENT_IDS = Object.freeze({
  SPY: 'SECURITY:US:SPY:ARCX',
  BTC: 'CRYPTO:GLOBAL:BTC:USD:SIM',
  GOLD: 'COMMODITY:GLOBAL:GOLD:XCEC',
});

export type RegisteredMarketInstrument = MarketInstrument & {
  readonly displayName: string;
  readonly providerSymbols: Readonly<Record<string, string>>;
  readonly orderBookSupported: boolean;
};

const VENUE_ARCA: MarketVenue = Object.freeze({
  venueId: 'ARCX',
  mic: 'ARCX',
  displayName: 'NYSE Arca',
  exchange: 'ARCA',
});

const VENUE_SIM: MarketVenue = Object.freeze({
  venueId: 'SIM',
  mic: 'XSIM',
  displayName: 'SunRey Simulation Global',
  exchange: 'SIM',
});

const VENUE_COMEX: MarketVenue = Object.freeze({
  venueId: 'XCEC',
  mic: 'XCEC',
  displayName: 'COMEX (reference)',
  exchange: 'COMEX',
});

function instrument(input: RegisteredMarketInstrument): RegisteredMarketInstrument {
  return Object.freeze(input);
}

export const REGISTERED_MARKET_INSTRUMENTS: readonly RegisteredMarketInstrument[] = Object.freeze([
  instrument({
    instrumentId: M02_REFERENCE_INSTRUMENT_IDS.SPY,
    symbol: 'SPY',
    assetClass: 'etf',
    venue: VENUE_ARCA,
    currency: 'USD',
    providerNativeId: 'SPY',
    displayName: 'SPDR S&P 500 ETF Trust',
    providerSymbols: Object.freeze({ finnhub: 'SPY', fixture: 'SPY' }),
    orderBookSupported: false,
  }),
  instrument({
    instrumentId: M02_REFERENCE_INSTRUMENT_IDS.BTC,
    symbol: 'BTCUSD',
    assetClass: 'crypto',
    venue: VENUE_SIM,
    currency: 'USD',
    providerNativeId: 'sandbox:btc-usd',
    displayName: 'Bitcoin / US Dollar (reference)',
    providerSymbols: Object.freeze({ sandbox: 'BTC/USD', fixture: 'BTCUSD' }),
    orderBookSupported: true,
  }),
  instrument({
    instrumentId: M02_REFERENCE_INSTRUMENT_IDS.GOLD,
    symbol: 'GOLD',
    assetClass: 'commodity',
    venue: VENUE_COMEX,
    currency: 'USD',
    providerNativeId: 'sandbox:gold-ref',
    displayName: 'Gold (reference)',
    providerSymbols: Object.freeze({ sandbox: 'XAUUSD', fixture: 'GOLD' }),
    orderBookSupported: false,
  }),
]);

const byId = new Map(REGISTERED_MARKET_INSTRUMENTS.map((row) => [row.instrumentId, row]));
const byProviderSymbol = new Map(
  REGISTERED_MARKET_INSTRUMENTS.flatMap((row) =>
    Object.entries(row.providerSymbols).map(([providerId, symbol]) => [`${providerId}:${symbol}`, row]),
  ),
);

export function resolveMarketInstrument(instrumentId: string): RegisteredMarketInstrument | undefined {
  return byId.get(instrumentId);
}

export function resolveMarketInstrumentByProviderSymbol(
  providerId: string,
  providerSymbol: string,
): RegisteredMarketInstrument | undefined {
  return byProviderSymbol.get(`${providerId}:${providerSymbol}`);
}

export function canonicalMarketInstrumentId(
  assetClass: MarketAssetClass,
  jurisdiction: string,
  symbol: string,
  venueId: string,
): string {
  const prefix =
    assetClass === 'crypto'
      ? 'CRYPTO'
      : assetClass === 'commodity'
        ? 'COMMODITY'
        : assetClass === 'fx'
          ? 'FX'
          : assetClass === 'future'
            ? 'FUTURE'
            : assetClass === 'index'
              ? 'INDEX'
              : 'SECURITY';
  if (assetClass === 'crypto') {
    return `${prefix}:${jurisdiction}:${symbol.slice(0, 3)}:USD:${venueId}`;
  }
  return `${prefix}:${jurisdiction}:${symbol}:${venueId}`;
}

export function providerSupportsOrderBook(instrumentId: string): boolean {
  return resolveMarketInstrument(instrumentId)?.orderBookSupported ?? false;
}
