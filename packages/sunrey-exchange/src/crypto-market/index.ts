export {
  CRYPTO_MARKET_REFERENCE_SCHEMA,
  CRYPTO_MARKET_REFERENCE_AUTHORITY,
  CRYPTO_MARKET_CAPABILITIES,
  CRYPTO_PRICE_SOURCE_TYPES,
  CRYPTO_HISTORY_INTERVALS,
  CRYPTO_ASSET_TYPES,
} from './types.ts';
export type {
  CryptoAssetIdentity,
  CryptoAssetSearchQuery,
  CryptoAssetType,
  CryptoHistoryInterval,
  CryptoMarketAssetMetadata,
  CryptoMarketCapability,
  CryptoMarketHistoryCandle,
  CryptoMarketPair,
  CryptoMarketReferenceFreshness,
  CryptoMarketReferenceProvenance,
  CryptoMarketReferenceQuote,
  CryptoMarketReferenceResult,
  CryptoPriceSourceType,
} from './types.ts';

export {
  CRYPTO_ASSET_REGISTRY_ID,
  NATIVE_SUNREY_ASSET_IDS,
  REGISTERED_CRYPTO_ASSETS,
  disambiguateSymbolCollision,
  isNativeSunReyAsset,
  providerNativeId,
  resolveCryptoAsset,
  resolveCryptoAssetBySymbolNetwork,
  searchRegisteredCryptoAssets,
} from './assets.ts';
export type { RegisteredCryptoAsset } from './assets.ts';

export {
  CRYPTO_MARKET_CATALOG_ENTRIES,
  CRYPTO_MARKET_CATALOG_PROVIDER_IDS,
} from './catalog-entries.ts';
export type { CryptoMarketCatalogProviderId } from './catalog-entries.ts';

export {
  CRYPTO_MARKET_SCOPE_CAPABILITIES,
  isBlockedProvider,
  isCryptoMarketCategory,
  isKnownCryptoProviderId,
  isProductionCandidate,
  listEligibleCryptoMarketProviders,
  loadCryptoMarketCatalog,
  providerPriorityOf,
} from './registry.ts';
export type { CryptoMarketCatalogMatch } from './registry.ts';

export type { CryptoMarketProviderHealth, CryptoMarketReferenceProvider } from './provider.ts';

export {
  CRYPTO_MARKET_CACHE_CAPABILITIES,
  KEY_CRYPTO_ASSET_IDS,
  cryptoHistoryCacheCapability,
  cryptoMarketCachePolicy,
} from './cache-policies.ts';

export {
  defaultCryptoMarketNow,
  detectPriceOutlier,
  parseDecimalToMinorUnits,
  validateMarketCapMinorUnits,
  validatePriceMinorUnits,
  validateQuote,
  validateSupplyMinorUnits,
  validateTimestamp,
} from './validation.ts';

export {
  ALL_CRYPTO_MARKET_ADAPTERS,
  COINCAP_ADAPTER,
  COINGECKO_ADAPTER,
  COINLORE_ADAPTER,
  COINMARKETCAP_ADAPTER,
  COINPAPRIKA_ADAPTER,
  CRYPTOCOMPARE_ADAPTER,
  createCircuitOpenCryptoAdapter,
  createFailingCryptoAdapter,
  createFixtureCryptoMarketAdapter,
  createRateLimitedCryptoAdapter,
  createStaleCryptoAdapter,
} from './adapters/index.ts';

export {
  CryptoMarketReferenceService,
  createCryptoMarketReferenceService,
} from './service.ts';
export type { CryptoMarketReferenceServiceOptions } from './service.ts';

export {
  buildBffCryptoHistory,
  buildBffCryptoQuote,
  DEFAULT_CRYPTO_NOW,
  DEFAULT_CRYPTO_PROVIDER_ID,
} from './bff-builders.ts';

export * as integrations from './integrations/index.ts';
