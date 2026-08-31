/**
 * EnvironmentalOracleProvider — domain port for environmental observations.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EnvironmentalLocation } from './location.ts';
import type {
  AirQualityObservation,
  EnvironmentalOracleResult,
  ForecastRange,
  SeismicArea,
  SeismicObservation,
  WaterObservation,
  WeatherForecast,
  WeatherObservation,
  WildfireObservation,
} from './types.ts';

export type EnvironmentalCapability =
  | 'weather'
  | 'precipitation'
  | 'water_data'
  | 'air_quality'
  | 'earthquake'
  | 'wildfire'
  | 'environmental'
  | 'environmental_risk'
  | 'climate';

export type EnvironmentalProviderHealth = {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly rateLimited: boolean;
  readonly lastSuccessAt: UtcInstant | null;
  readonly message: string | null;
};

export type EnvironmentalOracleProvider = {
  readonly providerId: string;
  readonly capabilities: readonly EnvironmentalCapability[];
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly geographicScope: readonly string[];
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  health(nowUtc: UtcInstant): EnvironmentalProviderHealth;
  supportsCapability(capability: EnvironmentalCapability): boolean;
  getCurrentWeather(
    location: EnvironmentalLocation,
    nowUtc: UtcInstant,
  ): Promise<EnvironmentalOracleResult<WeatherObservation>>;
  getForecast?(
    location: EnvironmentalLocation,
    range: ForecastRange,
    nowUtc: UtcInstant,
  ): Promise<EnvironmentalOracleResult<WeatherForecast>>;
  getWaterState?(
    location: EnvironmentalLocation,
    nowUtc: UtcInstant,
  ): Promise<EnvironmentalOracleResult<readonly WaterObservation[]>>;
  getAirQuality?(
    location: EnvironmentalLocation,
    nowUtc: UtcInstant,
  ): Promise<EnvironmentalOracleResult<AirQualityObservation>>;
  getSeismicEvents?(
    area: SeismicArea,
    range: ForecastRange,
    nowUtc: UtcInstant,
  ): Promise<EnvironmentalOracleResult<readonly SeismicObservation[]>>;
  getWildfireEvents?(
    location: EnvironmentalLocation,
    nowUtc: UtcInstant,
  ): Promise<EnvironmentalOracleResult<readonly WildfireObservation[]>>;
};
