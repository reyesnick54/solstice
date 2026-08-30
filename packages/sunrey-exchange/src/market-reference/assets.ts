/**
 * Canonical asset identity for market reference data.
 *
 * Reuses SunRey instrument/asset identifiers. Ticker alone is never assumed
 * globally unique — venue identity is required when disambiguation matters.
 */

import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../ids.ts';
import type { AssetIdentifier, CommodityCode, VenueIdentity } from './types.ts';

export const MARKET_REFERENCE_ASSET_REGISTRY_ID = 'sunrey.market-reference.assets.v1' as const;

const VENUE_SIM_US: VenueIdentity = Object.freeze({
  venueId: 'SIM-US',
  mic: 'XSIM',
  displayName: 'SunRey Simulation US',
});

const VENUE_LME: VenueIdentity = Object.freeze({
  venueId: 'LME',
  mic: 'XLME',
  displayName: 'London Metal Exchange (reference)',
});

const VENUE_COMEX: VenueIdentity = Object.freeze({
  venueId: 'COMEX',
  mic: 'XCEC',
  displayName: 'COMEX (reference)',
});

export type RegisteredMarketAsset = AssetIdentifier & {
  readonly displayName: string;
  readonly assetClass: 'security' | 'commodity' | 'crypto' | 'index' | 'native';
};

function asset(input: RegisteredMarketAsset): RegisteredMarketAsset {
  return Object.freeze(input);
}

export const REGISTERED_MARKET_ASSETS: readonly RegisteredMarketAsset[] = Object.freeze([
  asset({
    assetId: SUNREY_COIN_NATIVE_ASSET_ID,
    symbol: 'SUNREY',
    venue: null,
    ticker: 'SUNREY',
    exchange: null,
    isin: null,
    figi: null,
    providerNativeId: null,
    commodityCode: null,
    currency: 'USD',
    displayName: 'SunRey Coin',
    assetClass: 'native',
  }),
  asset({
    assetId: MOONREY_COIN_NATIVE_ASSET_ID,
    symbol: 'MOONREY',
    venue: null,
    ticker: 'MOONREY',
    exchange: null,
    isin: null,
    figi: null,
    providerNativeId: null,
    commodityCode: null,
    currency: 'USD',
    displayName: 'MoonRey Coin',
    assetClass: 'native',
  }),
  asset({
    assetId: 'SIM-ETF-1',
    symbol: 'SIMETF',
    venue: VENUE_SIM_US,
    ticker: 'SIMETF',
    exchange: 'SIM-US',
    isin: 'US000SIMETF01',
    figi: null,
    providerNativeId: 'sim-etf-1',
    commodityCode: null,
    currency: 'USD',
    displayName: 'Simulated Broad Market ETF',
    assetClass: 'security',
  }),
  asset({
    assetId: 'COMMODITY:gold:USD:troy_oz',
    symbol: 'XAU',
    venue: VENUE_COMEX,
    ticker: 'GC',
    exchange: 'COMEX',
    isin: null,
    figi: null,
    providerNativeId: 'gold',
    commodityCode: 'gold',
    currency: 'USD',
    displayName: 'Gold (reference)',
    assetClass: 'commodity',
  }),
  asset({
    assetId: 'COMMODITY:silver:USD:troy_oz',
    symbol: 'XAG',
    venue: VENUE_COMEX,
    ticker: 'SI',
    exchange: 'COMEX',
    isin: null,
    figi: null,
    providerNativeId: 'silver',
    commodityCode: 'silver',
    currency: 'USD',
    displayName: 'Silver (reference)',
    assetClass: 'commodity',
  }),
  asset({
    assetId: 'COMMODITY:copper:USD:lb',
    symbol: 'HG',
    venue: VENUE_LME,
    ticker: 'HG',
    exchange: 'LME',
    isin: null,
    figi: null,
    providerNativeId: 'copper',
    commodityCode: 'copper',
    currency: 'USD',
    displayName: 'Copper (reference)',
    assetClass: 'commodity',
  }),
]);

const byId = new Map(REGISTERED_MARKET_ASSETS.map((row) => [row.assetId, row]));
const byTickerVenue = new Map(
  REGISTERED_MARKET_ASSETS.filter((row) => row.ticker && row.venue).map((row) => [
    `${row.ticker}@${row.venue!.venueId}`,
    row,
  ]),
);

export function resolveMarketAsset(assetId: string): RegisteredMarketAsset | undefined {
  return byId.get(assetId);
}

export function resolveMarketAssetByTickerVenue(ticker: string, venueId: string): RegisteredMarketAsset | undefined {
  return byTickerVenue.get(`${ticker}@${venueId}`);
}

export function commodityAssetId(commodity: CommodityCode): string | undefined {
  const row = REGISTERED_MARKET_ASSETS.find((asset) => asset.commodityCode === commodity);
  return row?.assetId;
}

export function searchRegisteredAssets(query: string, limit = 20): readonly RegisteredMarketAsset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return Object.freeze(REGISTERED_MARKET_ASSETS.slice(0, limit));
  }
  return Object.freeze(
    REGISTERED_MARKET_ASSETS.filter(
      (row) =>
        row.assetId.toLowerCase().includes(normalized) ||
        row.symbol.toLowerCase().includes(normalized) ||
        row.displayName.toLowerCase().includes(normalized) ||
        (row.ticker?.toLowerCase().includes(normalized) ?? false) ||
        (row.commodityCode?.includes(normalized as CommodityCode) ?? false),
    ).slice(0, limit),
  );
}
