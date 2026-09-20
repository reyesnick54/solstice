export {
  CAPITAL_MARKET_PROVIDER_ID,
  createCapitalMarketProvider,
  createFinnhubCapitalMarketAdapter,
  FinnhubCapitalMarketAdapter,
  FINNHUB_CREDENTIAL_ENV_VAR,
} from './adapters/index.ts';
export { resolveCapitalMarketEntitlement, entitlementBlocksRealtimePresentation } from './entitlement.ts';
export { CapitalMarketHttpClient } from './http/client.ts';
export { FINNHUB_ENDPOINT } from './http/endpoints.ts';
export {
  canonicalInstrumentId,
  REGISTERED_CAPITAL_MARKET_INSTRUMENTS,
  resolveCapitalMarketInstrument,
  resolveCapitalMarketInstrumentByProviderSymbol,
  resolveCapitalMarketInstrumentByTickerVenue,
  searchCapitalMarketInstruments,
} from './instrument-registry.ts';
export type { CapitalMarketProvider } from './provider.ts';
export {
  CapitalMarketService,
  createCapitalMarketService,
  defaultQualificationInstrumentId,
  qualificationNowUtc,
  type CapitalMarketQualificationResult,
  type CapitalMarketServiceOptions,
} from './service.ts';
export {
  CAPITAL_MARKET_ASSET_CLASSES,
  CAPITAL_MARKET_AUTHORITY,
  CAPITAL_MARKET_ENTITLEMENT_CLASSES,
  CAPITAL_MARKET_FEED_TIERS,
  CAPITAL_MARKET_OBSERVATION_TYPES,
  CAPITAL_MARKET_ROUTE_STATUSES,
  CAPITAL_MARKET_SCHEMA,
  CAPITAL_MARKET_SESSION_STATUSES,
  type CapitalMarketAssetClass,
  type CapitalMarketEntitlement,
  type CapitalMarketEntitlementClass,
  type CapitalMarketFeedTier,
  type CapitalMarketInstrument,
  type CapitalMarketObservation,
  type CapitalMarketObservationType,
  type CapitalMarketProviderHealth,
  type CapitalMarketResult,
  type CapitalMarketRouteDiagnostics,
  type CapitalMarketRouteStatus,
  type CapitalMarketSessionStatus,
  type CapitalMarketVenue,
} from './types.ts';
export { quarantineIfInvalid, validateCapitalMarketObservation } from './validation.ts';
export {
  createHeliosMarketDataRoute,
  HeliosMarketDataRoute,
  heliosMarketDataNowUtc,
  type HeliosMarketDataFetchResult,
  type HeliosMarketDataObservation,
  type HeliosMarketDataRouteOptions,
  type HeliosMarketDataRouteSnapshot,
  type HeliosMarketDataRouteStatus,
} from './integrations/helios.ts';
export {
  createHeliosGoldMarketRoute,
  HeliosGoldMarketRoute,
  heliosGoldMarketNowUtc,
  type HeliosGoldMarketRouteSnapshot,
  type HeliosGoldQuoteResult,
} from './integrations/helios-gold.ts';
export * from './futures/index.ts';
export * from './gold/index.ts';
