/**
 * Wave 2 Prompt 10 — canonical market reference data types.
 *
 * Reference/research observations only. Not execution quotes, settlement
 * prices, ledger values, or issuance authority.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/types.ts';

export const MARKET_REFERENCE_SCHEMA = 'sunrey.market-reference.v1' as const;

export const MARKET_REFERENCE_AUTHORITY = 'REFERENCE_ONLY' as const;
export const EXECUTION_AUTHORITY = 'EXECUTION' as const;

export const MARKET_REFERENCE_CAPABILITIES = [
  'market_prices',
  'securities',
  'commodity_prices',
  'resource_prices',
  'asset_metadata',
  'market_history',
  'metals',
] as const;
export type MarketReferenceCapability = (typeof MARKET_REFERENCE_CAPABILITIES)[number];

export const COMMODITY_CODES = ['gold', 'silver', 'copper'] as const;
export type CommodityCode = (typeof COMMODITY_CODES)[number];

export const HISTORY_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1mo'] as const;
export type HistoryInterval = (typeof HISTORY_INTERVALS)[number];

export const PRICE_ADJUSTMENT_STATUSES = ['adjusted', 'unadjusted', 'unknown'] as const;
export type PriceAdjustmentStatus = (typeof PRICE_ADJUSTMENT_STATUSES)[number];

export type VenueIdentity = {
  readonly venueId: string;
  readonly mic: string | null;
  readonly displayName: string;
};

export type AssetIdentifier = {
  readonly assetId: string;
  readonly symbol: string;
  readonly venue: VenueIdentity | null;
  readonly ticker: string | null;
  readonly exchange: string | null;
  readonly isin: string | null;
  readonly figi: string | null;
  readonly providerNativeId: string | null;
  readonly commodityCode: CommodityCode | null;
  readonly currency: string | null;
};

export type MarketReferenceFreshness = {
  readonly status: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly ageMs: bigint;
  readonly assessedAt: UtcInstant;
};

export type MarketReferenceProvenance = {
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string | null;
  readonly observationId: string;
  readonly capability: string;
};

export type MarketReferenceQuote = {
  readonly schema: typeof MARKET_REFERENCE_SCHEMA;
  readonly authority: typeof MARKET_REFERENCE_AUTHORITY;
  readonly assetId: string;
  readonly asset: AssetIdentifier;
  readonly symbol: string;
  readonly venue: VenueIdentity | null;
  readonly priceMinorUnits: bigint;
  readonly currency: string;
  readonly priceScale: number;
  readonly bidMinorUnits: bigint | null;
  readonly askMinorUnits: bigint | null;
  readonly midMinorUnits: bigint | null;
  readonly openMinorUnits: bigint | null;
  readonly highMinorUnits: bigint | null;
  readonly lowMinorUnits: bigint | null;
  readonly closeMinorUnits: bigint | null;
  readonly volumeUnits: bigint | null;
  readonly previousCloseMinorUnits: bigint | null;
  readonly changeMinorUnits: bigint | null;
  readonly changePercentBps: bigint | null;
  readonly marketTimestamp: UtcInstant;
  readonly retrievedAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: MarketReferenceFreshness;
  readonly provenance: MarketReferenceProvenance;
};

export type MarketHistoryCandle = {
  readonly assetId: string;
  readonly interval: HistoryInterval;
  readonly timezone: string;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint | null;
  readonly currency: string;
  readonly priceScale: number;
  readonly adjustmentStatus: PriceAdjustmentStatus;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly marketTimestamp: UtcInstant;
  readonly providerId: string;
  readonly provenance: MarketReferenceProvenance;
};

export type CommodityUnit = {
  readonly unitId: string;
  readonly symbol: string;
  readonly dimension: 'MASS' | 'COUNT' | 'OTHER';
};

export type UnitTransformation = {
  readonly performed: true;
  readonly sourceUnit: CommodityUnit;
  readonly targetUnit: CommodityUnit;
  readonly methodology: string;
  readonly factorNumerator: bigint;
  readonly factorDenominator: bigint;
};

export type CommodityPriceObservation = {
  readonly schema: typeof MARKET_REFERENCE_SCHEMA;
  readonly authority: typeof MARKET_REFERENCE_AUTHORITY;
  readonly commodity: CommodityCode;
  readonly priceMinorUnits: bigint;
  readonly currency: string;
  readonly priceScale: number;
  readonly unit: CommodityUnit;
  readonly normalizedUnit: CommodityUnit | null;
  readonly normalizedPriceMinorUnits: bigint | null;
  readonly unitTransformation: UnitTransformation | null;
  readonly marketReference: string;
  readonly effectiveTime: UtcInstant;
  readonly retrievedAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: MarketReferenceFreshness;
  readonly provenance: MarketReferenceProvenance;
};

export type MarketReferenceResult<T> =
  | { readonly ok: true; readonly value: T; readonly fromCache: boolean; readonly fallbackProviderId: string | null }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly providerId: string | null };

export type AssetSearchQuery = {
  readonly query: string;
  readonly assetClass?: 'security' | 'commodity' | 'crypto' | 'index';
  readonly venueId?: string;
  readonly limit?: number;
};

export type MarketReferenceAssetMetadata = {
  readonly asset: AssetIdentifier;
  readonly displayName: string;
  readonly assetClass: string;
  readonly description: string | null;
  readonly providerId: string;
  readonly retrievedAt: UtcInstant;
};
