/**
 * Wave 3 Prompt 12 — canonical crypto market reference types.
 *
 * Reference/research observations only. Not execution quotes, settlement
 * prices, ledger values, custody balances, or issuance authority.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/types.ts';

export const CRYPTO_MARKET_REFERENCE_SCHEMA = 'sunrey.crypto-market-reference.v1' as const;
export const CRYPTO_MARKET_REFERENCE_AUTHORITY = 'REFERENCE_ONLY' as const;

export const CRYPTO_MARKET_CAPABILITIES = [
  'crypto_prices',
  'crypto_market_data',
  'crypto_assets',
  'crypto_market_history',
  'crypto_market_cap',
  'crypto_exchange_reference',
  'crypto_metadata',
] as const;
export type CryptoMarketCapability = (typeof CRYPTO_MARKET_CAPABILITIES)[number];

export const CRYPTO_PRICE_SOURCE_TYPES = ['GLOBAL_AGGREGATE', 'EXCHANGE_SPECIFIC'] as const;
export type CryptoPriceSourceType = (typeof CRYPTO_PRICE_SOURCE_TYPES)[number];

export const CRYPTO_HISTORY_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type CryptoHistoryInterval = (typeof CRYPTO_HISTORY_INTERVALS)[number];

export const CRYPTO_ASSET_TYPES = ['native', 'token', 'stablecoin', 'wrapped'] as const;
export type CryptoAssetType = (typeof CRYPTO_ASSET_TYPES)[number];

export type CryptoAssetIdentity = {
  readonly assetId: string;
  readonly canonicalExternalId: string;
  readonly name: string;
  readonly symbol: string;
  readonly assetType: CryptoAssetType;
  readonly network: string;
  readonly contractAddress: string | null;
  readonly providerIds: Readonly<Record<string, string>>;
};

export type CryptoMarketPair = {
  readonly pairId: string;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly baseSymbol: string;
  readonly quoteSymbol: string;
  readonly venue: string | null;
  readonly providerId: string;
};

export type CryptoMarketReferenceFreshness = {
  readonly status: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly ageMs: bigint;
  readonly assessedAt: UtcInstant;
};

export type CryptoMarketReferenceProvenance = {
  readonly providerId: string;
  readonly providerAssetId: string | null;
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string | null;
  readonly observationId: string;
  readonly capability: string;
  readonly priceSourceType: CryptoPriceSourceType;
};

export type CryptoMarketReferenceQuote = {
  readonly schema: typeof CRYPTO_MARKET_REFERENCE_SCHEMA;
  readonly authority: typeof CRYPTO_MARKET_REFERENCE_AUTHORITY;
  readonly assetId: string;
  readonly asset: CryptoAssetIdentity;
  readonly symbol: string;
  readonly pair: CryptoMarketPair | null;
  readonly priceMinorUnits: bigint;
  readonly quoteCurrency: string;
  readonly priceScale: number;
  readonly marketCapMinorUnits: bigint | null;
  readonly circulatingSupplyMinorUnits: bigint | null;
  readonly totalSupplyMinorUnits: bigint | null;
  readonly maxSupplyMinorUnits: bigint | null;
  readonly volume24hMinorUnits: bigint | null;
  readonly change1hBps: bigint | null;
  readonly change24hBps: bigint | null;
  readonly change7dBps: bigint | null;
  readonly high24hMinorUnits: bigint | null;
  readonly low24hMinorUnits: bigint | null;
  readonly marketTimestamp: UtcInstant;
  readonly retrievedAt: UtcInstant;
  readonly providerId: string;
  readonly providerAssetId: string | null;
  readonly freshness: CryptoMarketReferenceFreshness;
  readonly provenance: CryptoMarketReferenceProvenance;
  readonly observationId: string;
};

export type CryptoMarketHistoryCandle = {
  readonly assetId: string;
  readonly interval: CryptoHistoryInterval;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeMinorUnits: bigint | null;
  readonly marketCapMinorUnits: bigint | null;
  readonly quoteCurrency: string;
  readonly priceScale: number;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly marketTimestamp: UtcInstant;
  readonly providerId: string;
  readonly provenance: CryptoMarketReferenceProvenance;
};

export type CryptoMarketAssetMetadata = {
  readonly asset: CryptoAssetIdentity;
  readonly displayName: string;
  readonly description: string | null;
  readonly providerId: string;
  readonly retrievedAt: UtcInstant;
};

export type CryptoMarketReferenceResult<T> =
  | { readonly ok: true; readonly value: T; readonly fromCache: boolean; readonly fallbackProviderId: string | null }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly providerId: string | null };

export type CryptoAssetSearchQuery = {
  readonly query: string;
  readonly network?: string;
  readonly limit?: number;
};
