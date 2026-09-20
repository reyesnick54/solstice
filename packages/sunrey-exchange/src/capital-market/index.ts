export {
  CAPITAL_MARKET_PROVIDER_ID,
  createCapitalMarketProvider,
  createFinnhubCapitalMarketAdapter,
  FinnhubCapitalMarketAdapter,
  FINNHUB_CREDENTIAL_ENV_VAR,
} from './adapters/index.ts';
export {
  barsInRange,
  createCapitalMarketBarStore,
  latestBarForInstrument,
  sortBarsByPeriodStart,
  type CapitalMarketBarStore,
  type CapitalMarketBarStoreSnapshot,
} from './bar-store.ts';
export { resolveCapitalMarketEntitlement, entitlementBlocksRealtimePresentation } from './entitlement.ts';
export {
  CapitalMarketHistoricalIngestor,
  createCapitalMarketHistoricalIngestor,
  detectGaps,
  estimateExpectedBars,
  type CapitalMarketHistoricalIngestRequest,
  type CapitalMarketHistoricalIngestResult,
} from './historical-ingestion.ts';
export { CapitalMarketHttpClient } from './http/client.ts';
export { FINNHUB_ENDPOINT } from './http/endpoints.ts';
export {
  canonicalInstrumentId,
  M05_EQUITY_INDEX_UNIVERSE,
  REGISTERED_CAPITAL_MARKET_INSTRUMENTS,
  resolveCapitalMarketInstrument,
  resolveCapitalMarketInstrumentByProviderSymbol,
  resolveCapitalMarketInstrumentByTickerVenue,
  searchCapitalMarketInstruments,
} from './instrument-registry.ts';
export { buildHeliosEquityIndexMarketState } from './market-state.ts';
export type { CapitalMarketProvider } from './provider.ts';
export {
  HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_BLOCKED,
  HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED,
  defaultM05QualificationRange,
  defaultM05QualificationTimeframe,
  runM05EquityIndexQualification,
  type M05QualificationCheck,
  type M05QualificationResult,
} from './qualification.ts';
export {
  CapitalMarketService,
  createCapitalMarketService,
  defaultQualificationInstrumentId,
  qualificationNowUtc,
  type CapitalMarketQualificationResult,
  type CapitalMarketServiceOptions,
} from './service.ts';
export {
  CAPITAL_MARKET_TIMEFRAMES,
  FINNHUB_TIMEFRAME_RESOLUTIONS,
  finnhubResolutionForTimeframe,
  isCapitalMarketTimeframe,
  periodEndForBar,
  timeframeDurationSeconds,
  validateHistoricalRange,
  type CapitalMarketHistoricalRange,
  type CapitalMarketTimeframe,
} from './timeframes.ts';
export {
  CAPITAL_MARKET_ASSET_CLASSES,
  CAPITAL_MARKET_AUTHORITY,
  CAPITAL_MARKET_CAPABILITIES,
  CAPITAL_MARKET_CAPABILITY_STATUSES,
  CAPITAL_MARKET_ENTITLEMENT_CLASSES,
  CAPITAL_MARKET_FEED_TIERS,
  CAPITAL_MARKET_OBSERVATION_TYPES,
  CAPITAL_MARKET_ROUTE_STATUSES,
  CAPITAL_MARKET_SCHEMA,
  CAPITAL_MARKET_SESSION_STATUSES,
  type CapitalMarketAssetClass,
  type CapitalMarketBar,
  type CapitalMarketCapability,
  type CapitalMarketCapabilityReport,
  type CapitalMarketCapabilityStatus,
  type CapitalMarketEntitlement,
  type CapitalMarketEntitlementClass,
  type CapitalMarketFeedTier,
  type CapitalMarketIngestQualityReport,
  type CapitalMarketInstrument,
  type CapitalMarketObservation,
  type CapitalMarketObservationType,
  type CapitalMarketProviderHealth,
  type CapitalMarketResult,
  type CapitalMarketRouteDiagnostics,
  type CapitalMarketRouteStatus,
  type CapitalMarketSessionObservation,
  type CapitalMarketSessionStatus,
  type CapitalMarketVenue,
  type HeliosEquityIndexMarketState,
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
