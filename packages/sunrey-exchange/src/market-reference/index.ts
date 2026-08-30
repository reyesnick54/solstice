export {
  MARKET_REFERENCE_SCHEMA,
  MARKET_REFERENCE_AUTHORITY,
  EXECUTION_AUTHORITY,
  MARKET_REFERENCE_CAPABILITIES,
  COMMODITY_CODES,
  HISTORY_INTERVALS,
  PRICE_ADJUSTMENT_STATUSES,
} from './types.ts';
export type {
  AssetIdentifier,
  AssetSearchQuery,
  CommodityCode,
  CommodityPriceObservation,
  CommodityUnit,
  HistoryInterval,
  MarketHistoryCandle,
  MarketReferenceAssetMetadata,
  MarketReferenceCapability,
  MarketReferenceFreshness,
  MarketReferenceProvenance,
  MarketReferenceQuote,
  MarketReferenceResult,
  PriceAdjustmentStatus,
  UnitTransformation,
  VenueIdentity,
} from './types.ts';

export {
  MARKET_REFERENCE_ASSET_REGISTRY_ID,
  REGISTERED_MARKET_ASSETS,
  commodityAssetId,
  resolveMarketAsset,
  resolveMarketAssetByTickerVenue,
  searchRegisteredAssets,
} from './assets.ts';
export type { RegisteredMarketAsset } from './assets.ts';

export {
  TROY_OZ,
  KILOGRAM,
  POUND,
  GRAM,
  convertMassPrice,
  defaultCommodityUnit,
  lookupCommodityUnit,
  validatePriceMinorUnits,
} from './units.ts';

export type { MarketReferenceProvider, MarketReferenceProviderHealth } from './provider.ts';

export {
  MARKET_REFERENCE_CATEGORIES,
  MARKET_REFERENCE_SCOPE_CAPABILITIES,
  isMarketReferenceCategory,
  listEligibleMarketReferenceProviders,
  loadMarketReferenceCatalog,
  marketReferenceCapabilitiesOf,
  providerPriorityOf,
} from './registry.ts';
export type { MarketReferenceCatalogMatch } from './registry.ts';

export {
  MARKET_REFERENCE_CACHE_CAPABILITIES,
  historyCacheCapability,
  marketReferenceCachePolicy,
} from './cache-policies.ts';

export { SimulationMarketReferenceAdapter, createSimulationMarketReferenceAdapter } from './adapters/simulation.ts';
export type { SimulationScenario } from './adapters/simulation.ts';
export { createMarketReferenceAdapterFactory } from './adapters/factory.ts';
export type { MarketReferenceAdapterFactory } from './adapters/factory.ts';

export {
  MarketReferenceService,
  createMarketReferenceService,
  defaultMarketReferenceNow,
} from './service.ts';
export type { MarketReferenceServiceOptions } from './service.ts';

export {
  SANDBOX_PROVIDER_ID,
  DEFAULT_MARKET_REFERENCE_NOW,
  buildSandboxAssetMetadata,
  buildSandboxCommodityObservation,
  buildSandboxHistory,
  buildSandboxQuote,
  syncExecutionSeparationProof,
} from './sandbox-builders.ts';

export * as integrations from './integrations/index.ts';
