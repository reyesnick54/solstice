/**
 * Wave 5 Prompt 19 — Environmental Oracle public exports.
 */

export {
  ENVIRONMENTAL_ORACLE_SCHEMA,
  ENVIRONMENTAL_ORACLE_AUTHORITY,
  TEMPERATURE_UNITS,
  WIND_SPEED_UNITS,
  PRECIPITATION_UNITS,
  PRESSURE_UNITS,
  FORECAST_RESOLUTIONS,
  PHYSICAL_RISK_TYPES,
} from './types.ts';
export type {
  TemperatureUnit,
  WindSpeedUnit,
  PrecipitationUnit,
  PressureUnit,
  ForecastResolution,
  PhysicalRiskType,
  EnvironmentalFreshness,
  EnvironmentalProvenance,
  WeatherObservation,
  WeatherForecast,
  WeatherForecastPeriod,
  ForecastVariable,
  WaterObservation,
  WaterMeasurementType,
  AirQualityObservation,
  AirQualityMetric,
  SeismicObservation,
  WildfireObservation,
  PhysicalRiskObservation,
  EnvironmentalSnapshot,
  EnvironmentalOracleResult,
  ProviderDisagreementEvent,
  ForecastRange,
  SeismicArea,
} from './types.ts';

export {
  normalizeEnvironmentalLocation,
  locationKey,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  convertTemperature,
  convertWindSpeed,
} from './location.ts';
export type { EnvironmentalLocation, LocationInput } from './location.ts';

export {
  ENVIRONMENTAL_CATALOG_ENTRIES,
  ENVIRONMENTAL_CATALOG_PROVIDER_IDS,
  type EnvironmentalCatalogProviderId,
} from './catalog-entries.ts';

export {
  ENVIRONMENTAL_CACHE_CAPABILITIES,
  environmentalCachePolicy,
} from './cache-policies.ts';

export { ENVIRONMENTAL_REFRESH_SCHEDULES } from './refresh-schedules.ts';

export { environmentalSeparationProof, type EnvironmentalSeparationProof } from './separation.ts';

export { derivePhysicalRisks } from './physical-risk.ts';

export type {
  EnvironmentalCapability,
  EnvironmentalProviderHealth,
  EnvironmentalOracleProvider,
} from './provider.ts';

export {
  ENVIRONMENTAL_CATEGORIES,
  ENVIRONMENTAL_CAPABILITIES,
  isEnvironmentalCategory,
  environmentalCapabilitiesOf,
  listEligibleEnvironmentalProviders,
  loadEnvironmentalCatalog,
  providerPriorityOf,
  createEnvironmentalAdapterFactory,
  type EnvironmentalCatalogMatch,
  type EnvironmentalAdapterFactory,
} from './registry.ts';

export {
  ENVIRONMENTAL_ADAPTER_IDS,
  createEnvironmentalAdapter,
  createAllEnvironmentalAdapters,
  setAdapterScenario,
  OpenMeteoAdapter,
  OpenMeteoEnsembleAdapter,
  NwsAdapter,
  AviationWeatherAdapter,
  PirateWeatherAdapter,
  MetNorwayAdapter,
  MeltemaAdapter,
  UsgsWaterAdapter,
  EpaAdapter,
  KanariAdapter,
  OpenAqAdapter,
  PurpleAirAdapter,
  UsgsEarthquakeAdapter,
  type EnvironmentalAdapterId,
} from './adapters/index.ts';

export {
  EnvironmentalOracleService,
  createEnvironmentalOracleService,
  defaultEnvironmentalNow,
  type EnvironmentalOracleServiceOptions,
} from './service.ts';

export { buildEnvironmentalAgentEvidence, type EnvironmentalAgentEvidence } from './agent-evidence.ts';

export { buildWorldEnvironmentalSnapshot, type WorldEnvironmentalSnapshot } from './integrations/world.ts';
export { buildGrowEnvironmentalContext, type GrowEnvironmentalContext } from './integrations/grow.ts';
export { buildMoonReyEnvironmentalContext, type MoonReyEnvironmentalContext } from './integrations/moonrey.ts';
export { buildTravelEnvironmentalContext, type TravelEnvironmentalContext } from './integrations/travel.ts';
export {
  buildRealEstateEnvironmentalContext,
  type RealEstateEnvironmentalContext,
} from './integrations/real-estate.ts';
