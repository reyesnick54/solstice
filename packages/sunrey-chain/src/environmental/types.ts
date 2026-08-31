/**
 * Wave 5 Prompt 19 — environmental oracle observation types.
 *
 * Reference / evidence only. Does not mutate financial positions, MoonRey
 * issuance, insurance decisions, or asset valuations.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/types.ts';
import type { EnvironmentalLocation } from './location.ts';

export const ENVIRONMENTAL_ORACLE_SCHEMA = 'sunrey.environmental-oracle.v1' as const;
export const ENVIRONMENTAL_ORACLE_AUTHORITY = 'OBSERVATION_ONLY' as const;

export const TEMPERATURE_UNITS = ['celsius', 'fahrenheit', 'kelvin'] as const;
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

export const WIND_SPEED_UNITS = ['m/s', 'km/h', 'mph', 'knots'] as const;
export type WindSpeedUnit = (typeof WIND_SPEED_UNITS)[number];

export const PRECIPITATION_UNITS = ['mm', 'in', 'cm'] as const;
export type PrecipitationUnit = (typeof PRECIPITATION_UNITS)[number];

export const PRESSURE_UNITS = ['hPa', 'inHg', 'mb'] as const;
export type PressureUnit = (typeof PRESSURE_UNITS)[number];

export const FORECAST_RESOLUTIONS = ['hourly', 'daily'] as const;
export type ForecastResolution = (typeof FORECAST_RESOLUTIONS)[number];

export const PHYSICAL_RISK_TYPES = [
  'FLOOD',
  'DROUGHT',
  'WILDFIRE',
  'EARTHQUAKE',
  'EXTREME_HEAT',
  'EXTREME_COLD',
  'HIGH_WIND',
  'POOR_AIR_QUALITY',
  'WATER_STRESS',
] as const;
export type PhysicalRiskType = (typeof PHYSICAL_RISK_TYPES)[number];

export type EnvironmentalFreshness = {
  readonly status: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly ageMs: bigint;
  readonly assessedAt: UtcInstant;
};

export type EnvironmentalProvenance = {
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string | null;
  readonly observationId: string;
  readonly capability: string;
};

export type WeatherObservation = {
  readonly schema: 'sunrey.weather-observation.v1';
  readonly kind: 'observation';
  readonly location: EnvironmentalLocation;
  readonly temperature: { readonly value: number; readonly unit: TemperatureUnit } | null;
  readonly feelsLike: { readonly value: number; readonly unit: TemperatureUnit } | null;
  readonly humidity: { readonly value: number; readonly unit: 'percent' } | null;
  readonly pressure: { readonly value: number; readonly unit: PressureUnit } | null;
  readonly windSpeed: { readonly value: number; readonly unit: WindSpeedUnit } | null;
  readonly windDirection: { readonly value: number; readonly unit: 'degrees' } | null;
  readonly precipitation: { readonly value: number; readonly unit: PrecipitationUnit } | null;
  readonly cloudCover: { readonly value: number; readonly unit: 'percent' } | null;
  readonly visibility: { readonly value: number; readonly unit: 'm' | 'km' | 'mi' } | null;
  readonly weatherCondition: string | null;
  readonly snow: { readonly value: number; readonly unit: PrecipitationUnit } | null;
  readonly uvIndex: number | null;
  readonly observationTime: UtcInstant;
  readonly providerId: string;
  readonly freshness: EnvironmentalFreshness;
  readonly provenance: EnvironmentalProvenance;
  readonly retrievedAt: UtcInstant;
};

export type ForecastVariable = {
  readonly name: string;
  readonly value: number | string | null;
  readonly unit: string | null;
};

export type WeatherForecastPeriod = {
  readonly validFrom: UtcInstant;
  readonly validTo: UtcInstant;
  readonly resolution: ForecastResolution;
  readonly variables: readonly ForecastVariable[];
  readonly weatherCondition: string | null;
  readonly modelId: string | null;
  readonly modelRun: string | null;
  readonly confidence: number | null;
};

export type WeatherForecast = {
  readonly schema: 'sunrey.weather-forecast.v1';
  readonly kind: 'forecast';
  readonly location: EnvironmentalLocation;
  readonly generatedAt: UtcInstant;
  readonly validFrom: UtcInstant;
  readonly validTo: UtcInstant;
  readonly horizonHours: number;
  readonly resolution: ForecastResolution;
  readonly periods: readonly WeatherForecastPeriod[];
  readonly modelSource: string | null;
  readonly providerId: string;
  readonly freshness: EnvironmentalFreshness;
  readonly provenance: EnvironmentalProvenance;
  readonly retrievedAt: UtcInstant;
  readonly expired: boolean;
};

export type WaterMeasurementType =
  | 'streamflow'
  | 'water_level'
  | 'groundwater'
  | 'reservoir_level'
  | 'water_temperature'
  | 'water_quality'
  | 'availability'
  | 'usage'
  | 'drought_indicator';

export type WaterObservation = {
  readonly schema: 'sunrey.water-observation.v1';
  readonly measurementType: WaterMeasurementType;
  readonly value: number;
  readonly unit: string;
  readonly stationId: string | null;
  readonly waterBody: string | null;
  readonly location: EnvironmentalLocation;
  readonly effectiveAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: EnvironmentalFreshness;
  readonly provenance: EnvironmentalProvenance;
  readonly retrievedAt: UtcInstant;
  readonly geographicScopeNote: string | null;
};

export type AirQualityMetric = {
  readonly pollutant: 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3' | 'AQI';
  readonly value: number;
  readonly unit: string;
  readonly aqiStandard: string | null;
};

export type AirQualityObservation = {
  readonly schema: 'sunrey.air-quality-observation.v1';
  readonly location: EnvironmentalLocation;
  readonly metrics: readonly AirQualityMetric[];
  readonly stationId: string | null;
  readonly observedAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: EnvironmentalFreshness;
  readonly provenance: EnvironmentalProvenance;
  readonly retrievedAt: UtcInstant;
};

export type SeismicObservation = {
  readonly schema: 'sunrey.seismic-observation.v1';
  readonly eventId: string;
  readonly magnitude: number;
  readonly magnitudeType: string;
  readonly depth: { readonly value: number; readonly unit: 'km' };
  readonly latitude: number;
  readonly longitude: number;
  readonly place: string;
  readonly eventTime: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly providerId: string;
  readonly provenance: EnvironmentalProvenance;
  readonly retrievedAt: UtcInstant;
};

export type WildfireObservation = {
  readonly schema: 'sunrey.wildfire-observation.v1';
  readonly eventId: string;
  readonly location: EnvironmentalLocation;
  readonly detectionTime: UtcInstant;
  readonly status: string;
  readonly confidence: number | null;
  readonly affectedArea: { readonly value: number; readonly unit: 'acres' | 'hectares' | 'km2' } | null;
  readonly satelliteSource: string | null;
  readonly providerId: string;
  readonly provenance: EnvironmentalProvenance;
  readonly retrievedAt: UtcInstant;
};

export type PhysicalRiskObservation = {
  readonly schema: 'sunrey.physical-risk-observation.v1';
  readonly riskType: PhysicalRiskType;
  readonly severity: 'low' | 'moderate' | 'high' | 'severe' | 'unknown';
  readonly location: EnvironmentalLocation;
  readonly observedSignal: string;
  readonly derivedFrom: 'weather' | 'water' | 'air_quality' | 'seismic' | 'wildfire' | 'provider_alert';
  readonly sourceProviderId: string;
  readonly effectiveAt: UtcInstant;
  readonly retrievedAt: UtcInstant;
  readonly prediction: false;
};

export type EnvironmentalSnapshot = {
  readonly schema: 'sunrey.environmental-snapshot.v1';
  readonly location: EnvironmentalLocation;
  readonly generatedAt: UtcInstant;
  readonly weather: readonly WeatherObservation[];
  readonly forecasts: readonly WeatherForecast[];
  readonly water: readonly WaterObservation[];
  readonly airQuality: readonly AirQualityObservation[];
  readonly seismic: readonly SeismicObservation[];
  readonly wildfires: readonly WildfireObservation[];
  readonly physicalRisks: readonly PhysicalRiskObservation[];
  readonly providerDisagreements: readonly ProviderDisagreementEvent[];
};

export type EnvironmentalOracleResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly fromCache: boolean;
      readonly fallbackProviderId: string | null;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly providerId: string | null;
    };

export type ProviderDisagreementEvent = {
  readonly capability: string;
  readonly locationKey: string;
  readonly providers: readonly { readonly providerId: string; readonly summary: string }[];
  readonly detectedAt: UtcInstant;
};

export type ForecastRange = {
  readonly from: UtcInstant;
  readonly to: UtcInstant;
  readonly resolution?: ForecastResolution;
};

export type SeismicArea = {
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm: number;
};
