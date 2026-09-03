/**
 * Environmental oracle refresh schedules.
 */

import type { RefreshScheduleEntry } from '../provider-runtime/data-delivery/types.ts';
import { ENVIRONMENTAL_CACHE_CAPABILITIES } from './cache-policies.ts';

export const ENVIRONMENTAL_REFRESH_SCHEDULES: readonly RefreshScheduleEntry[] = Object.freeze([
  Object.freeze({
    scheduleId: 'env-weather-current',
    providerId: 'open-meteo',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.currentWeather,
    resourceId: 'current',
    intervalMs: 300_000,
    jitterMs: 30_000,
    priority: 10,
    enabled: true,
    maxRuntimeMs: 60_000,
  }),
  Object.freeze({
    scheduleId: 'env-weather-forecast-hourly',
    providerId: 'open-meteo',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.hourlyForecast,
    resourceId: 'hourly',
    intervalMs: 600_000,
    jitterMs: 60_000,
    priority: 12,
    enabled: true,
    maxRuntimeMs: 90_000,
  }),
  Object.freeze({
    scheduleId: 'env-water-gauge',
    providerId: 'usgs-water',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.waterGauge,
    resourceId: 'gauge',
    intervalMs: 900_000,
    jitterMs: 60_000,
    priority: 8,
    enabled: true,
    maxRuntimeMs: 120_000,
  }),
  Object.freeze({
    scheduleId: 'env-air-quality',
    providerId: 'openaq',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.airQuality,
    resourceId: 'current',
    intervalMs: 600_000,
    jitterMs: 30_000,
    priority: 9,
    enabled: true,
    maxRuntimeMs: 90_000,
  }),
  Object.freeze({
    scheduleId: 'env-seismic',
    providerId: 'usgs-earthquake',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.seismicEvent,
    resourceId: 'events',
    intervalMs: 3_600_000,
    jitterMs: 120_000,
    priority: 6,
    enabled: true,
    maxRuntimeMs: 180_000,
  }),
]);
