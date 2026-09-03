// @ts-nocheck
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
    intervalMs: 300_000,
    jitterMs: 30_000,
    enabled: true,
    notes: 'Current weather — 5 minute refresh.',
  }),
  Object.freeze({
    scheduleId: 'env-weather-forecast-hourly',
    providerId: 'open-meteo',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.hourlyForecast,
    intervalMs: 600_000,
    jitterMs: 60_000,
    enabled: true,
    notes: 'Hourly forecast — 10 minute refresh.',
  }),
  Object.freeze({
    scheduleId: 'env-water-gauge',
    providerId: 'usgs-water',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.waterGauge,
    intervalMs: 900_000,
    jitterMs: 60_000,
    enabled: true,
    notes: 'Water gauges — 15 minute refresh based on publication frequency.',
  }),
  Object.freeze({
    scheduleId: 'env-air-quality',
    providerId: 'openaq',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.airQuality,
    intervalMs: 600_000,
    jitterMs: 30_000,
    enabled: true,
    notes: 'Air quality — 10 minute refresh.',
  }),
  Object.freeze({
    scheduleId: 'env-seismic',
    providerId: 'usgs-earthquake',
    capability: ENVIRONMENTAL_CACHE_CAPABILITIES.seismicEvent,
    intervalMs: 3_600_000,
    jitterMs: 120_000,
    enabled: true,
    notes: 'Earthquake events — longer TTL after final update.',
  }),
]);
