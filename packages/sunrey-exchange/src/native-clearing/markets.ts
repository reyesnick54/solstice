import { asExchangeMarketId, asListingId, MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID, SUNREY_MOONREY_MARKET_ID } from '../ids.ts';
import { NATIVE_FEE_POLICY, NATIVE_SETTLEMENT_POLICY, NATIVE_TICKER_STATUS, type MarketDefinition } from './types.ts';

export const NATIVE_ASSET_PRECISION = 6;
export const NATIVE_QUANTITY_INCREMENT = 1n;
export const NATIVE_PRICE_INCREMENT = 1n;
export const NATIVE_MINIMUM_QUANTITY = 1n;
export const NATIVE_MAXIMUM_QUANTITY = 10n ** 38n - 1n;

export function sunreyMoonreyMarket(): MarketDefinition {
  return Object.freeze({
    marketId: SUNREY_MOONREY_MARKET_ID,
    baseAsset: SUNREY_COIN_NATIVE_ASSET_ID,
    quoteAsset: MOONREY_COIN_NATIVE_ASSET_ID,
    quantityIncrement: NATIVE_QUANTITY_INCREMENT,
    priceIncrement: NATIVE_PRICE_INCREMENT,
    minimumQuantity: NATIVE_MINIMUM_QUANTITY,
    maximumQuantity: NATIVE_MAXIMUM_QUANTITY,
    feePolicy: NATIVE_FEE_POLICY,
    settlementPolicy: NATIVE_SETTLEMENT_POLICY,
    listingVersion: 1,
    status: 'SIMULATION_LISTED',
    tickerStatus: NATIVE_TICKER_STATUS,
  });
}

export function nativeListingIds(): { readonly base: ReturnType<typeof asListingId>; readonly quote: ReturnType<typeof asListingId> } {
  return {
    base: asListingId('listing:sunrey-coin-native'),
    quote: asListingId('listing:moonrey-coin-native'),
  };
}

export function isCanonicalNativeMarket(marketId: string): boolean {
  return marketId === SUNREY_MOONREY_MARKET_ID || marketId === asExchangeMarketId(marketId);
}

export function requireCanonicalAssetId(assetId: string): string {
  if (assetId !== SUNREY_COIN_NATIVE_ASSET_ID && assetId !== MOONREY_COIN_NATIVE_ASSET_ID) {
    throw new TypeError(`canonical native asset id required, got ${assetId}`);
  }
  return assetId;
}
