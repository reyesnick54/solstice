/**
 * Phase D provider-neutral market-data contract.
 *
 * Extends the canonical Exchange owner. Not a second price authority,
 * not a live vendor integration, and not packages/market-data.
 * Every price carries instrument, currency, source, timestamp,
 * freshness, provider, and quality.
 */

export const MARKET_DATA_CONTRACT_VERSION = 'sunrey-market-data-contract/1' as const;

export const MARKET_DATA_QUALITY = ['FRESH', 'STALE', 'OUTLIER', 'UNAVAILABLE', 'CONFLICTING'] as const;
export type MarketDataQuality = (typeof MARKET_DATA_QUALITY)[number];

export const MARKET_DATA_STATUSES = ['OPEN', 'CLOSED', 'HALTED', 'UNKNOWN'] as const;
export type MarketDataStatus = (typeof MARKET_DATA_STATUSES)[number];

export const MARKET_DATA_SELECTION_POLICIES = [
  'PRIMARY',
  'SECONDARY_FAILOVER',
  'CONSENSUS_IF_COMPATIBLE',
  'REJECT_INCOMPATIBLE',
] as const;
export type MarketDataSelectionPolicy = (typeof MARKET_DATA_SELECTION_POLICIES)[number];

export type MarketInstrument = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly baseAssetId: string;
  readonly quoteCurrency: string;
  readonly quoteScale: number;
};

export type MarketPriceQuote = {
  readonly instrument: MarketInstrument;
  readonly priceUnits: bigint;
  readonly currency: string;
  readonly source: string;
  readonly timestampUtc: string;
  readonly freshnessMs: bigint;
  readonly provider: string;
  readonly quality: MarketDataQuality;
  readonly status: MarketDataStatus;
  readonly staleMasqueradingAsCurrent: false;
};

export type MarketTicker = {
  readonly instrument: MarketInstrument;
  readonly last: MarketPriceQuote;
  readonly bid: MarketPriceQuote | null;
  readonly ask: MarketPriceQuote | null;
  readonly volumeUnits: bigint;
};

export type MarketCandle = {
  readonly instrument: MarketInstrument;
  readonly open: bigint;
  readonly high: bigint;
  readonly low: bigint;
  readonly close: bigint;
  readonly volumeUnits: bigint;
  readonly periodStartUtc: string;
  readonly periodEndUtc: string;
  readonly quality: MarketDataQuality;
  readonly provider: string;
};

export type MarketReferenceRate = {
  readonly instrument: MarketInstrument;
  readonly rateNumerator: bigint;
  readonly rateDenominator: bigint;
  readonly timestampUtc: string;
  readonly freshnessMs: bigint;
  readonly provider: string;
  readonly quality: MarketDataQuality;
  readonly source: string;
};

export type MarketDataProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type MarketDataProvider = {
  readonly providerId: string;
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  getInstrument(instrumentId: string): MarketDataProviderResult<MarketInstrument>;
  getSpotPrice(instrumentId: string, nowUtc: string): MarketDataProviderResult<MarketPriceQuote>;
  getTicker(instrumentId: string, nowUtc: string): MarketDataProviderResult<MarketTicker>;
  getCandles(instrumentId: string, nowUtc: string): MarketDataProviderResult<readonly MarketCandle[]>;
  getHistorical(instrumentId: string, nowUtc: string): MarketDataProviderResult<readonly MarketCandle[]>;
  getReferenceRate(instrumentId: string, nowUtc: string): MarketDataProviderResult<MarketReferenceRate>;
  getMarketStatus(instrumentId: string): MarketDataProviderResult<MarketDataStatus>;
};
