/**
 * Wave 8 — market price boundary proofs.
 *
 * Exchange market price is simulation-only and must not be confused with
 * PEVE (SunRey issuance valuation) or GPUV (MoonRey productive value).
 * Market clearing cannot alter canonical native supply.
 */

import { PRICE_LABEL } from './taxonomy.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
} from './ids.ts';

export const MARKET_PRICE_AUTHORITY = 'EXCHANGE_SIMULATION_MARKET' as const;
export const PEVE_AUTHORITY = 'HUMAN_ECONOMIC_CONTRIBUTION_VALUATION' as const;
export const GPUV_AUTHORITY = 'PRODUCTIVE_VALUE_GOVERNANCE' as const;
export const NATIVE_SUPPLY_AUTHORITY = 'NATIVE_BLOCKCHAIN_AUTHORITY' as const;

export type MarketPriceBoundaryProof = {
  readonly schema: 'sunrey.market-price-boundary.v1';
  readonly sunreyMarketPriceLabel: typeof PRICE_LABEL;
  readonly moonreyMarketPriceLabel: typeof PRICE_LABEL;
  readonly sunreyMarketPriceIsPeve: false;
  readonly moonreyMarketPriceIsGpuv: false;
  readonly exchangePriceMutatesNativeSupply: false;
  readonly peveAuthority: typeof PEVE_AUTHORITY;
  readonly gpuvAuthority: typeof GPUV_AUTHORITY;
  readonly nativeSupplyAuthority: typeof NATIVE_SUPPLY_AUTHORITY;
};

export function marketPriceBoundaryProof(): MarketPriceBoundaryProof {
  return Object.freeze({
    schema: 'sunrey.market-price-boundary.v1',
    sunreyMarketPriceLabel: PRICE_LABEL,
    moonreyMarketPriceLabel: PRICE_LABEL,
    sunreyMarketPriceIsPeve: false,
    moonreyMarketPriceIsGpuv: false,
    exchangePriceMutatesNativeSupply: false,
    peveAuthority: PEVE_AUTHORITY,
    gpuvAuthority: GPUV_AUTHORITY,
    nativeSupplyAuthority: NATIVE_SUPPLY_AUTHORITY,
  });
}

export function assertMarketPriceDoesNotAlterSupply(input: {
  readonly assetId: string;
  readonly supplyBefore: bigint;
  readonly supplyAfter: bigint;
  readonly tradeExecuted: boolean;
}): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (![SUNREY_COIN_NATIVE_ASSET_ID, MOONREY_COIN_NATIVE_ASSET_ID].includes(input.assetId)) {
    return { ok: false, reason: 'asset is not a canonical native coin' };
  }
  if (input.tradeExecuted && input.supplyBefore !== input.supplyAfter) {
    return { ok: false, reason: 'exchange trade must not mint or burn native supply' };
  }
  return { ok: true };
}

export function sunreyTickerIsDistinctFromMoonrey(): boolean {
  return SUNREY_COIN_NATIVE_ASSET_ID !== MOONREY_COIN_NATIVE_ASSET_ID;
}
