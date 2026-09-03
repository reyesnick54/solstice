// @ts-nocheck
/**
 * Environmental oracle cache policies — capability-specific TTLs.
 */

import type { CachePolicy } from '../provider-runtime/data-delivery/types.ts';

export const ENVIRONMENTAL_CACHE_CAPABILITIES = Object.freeze({
  currentWeather: 'weather.current',
  hourlyForecast: 'weather.forecast.hourly',
  dailyForecast: 'weather.forecast.daily',
  waterGauge: 'water.gauge',
  airQuality: 'air_quality.current',
  seismicEvent: 'seismic.event',
  wildfireEvent: 'wildfire.event',
  environmentalSnapshot: 'environmental.snapshot',
});

const POLICIES: Readonly<Record<string, CachePolicy>> = Object.freeze({
  [ENVIRONMENTAL_CACHE_CAPABILITIES.currentWeather]: Object.freeze({
    freshTtlMs: 300_000,
    staleWindowMs: 900_000,
    hardExpireMs: 3_600_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 24,
    maxRawPayloadBytes: 16_384,
  }),
  [ENVIRONMENTAL_CACHE_CAPABILITIES.hourlyForecast]: Object.freeze({
    freshTtlMs: 600_000,
    staleWindowMs: 1_800_000,
    hardExpireMs: 7_200_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 12,
    maxRawPayloadBytes: 32_768,
  }),
  [ENVIRONMENTAL_CACHE_CAPABILITIES.dailyForecast]: Object.freeze({
    freshTtlMs: 1_800_000,
    staleWindowMs: 3_600_000,
    hardExpireMs: 86_400_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 8,
    maxRawPayloadBytes: 32_768,
  }),
  [ENVIRONMENTAL_CACHE_CAPABILITIES.waterGauge]: Object.freeze({
    freshTtlMs: 900_000,
    staleWindowMs: 1_800_000,
    hardExpireMs: 7_200_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 48,
    maxRawPayloadBytes: 16_384,
  }),
  [ENVIRONMENTAL_CACHE_CAPABILITIES.airQuality]: Object.freeze({
    freshTtlMs: 600_000,
    staleWindowMs: 1_800_000,
    hardExpireMs: 7_200_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 24,
    maxRawPayloadBytes: 16_384,
  }),
  [ENVIRONMENTAL_CACHE_CAPABILITIES.seismicEvent]: Object.freeze({
    freshTtlMs: 3_600_000,
    staleWindowMs: 86_400_000,
    hardExpireMs: 604_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 120,
    maxRawPayloadBytes: 16_384,
  }),
  [ENVIRONMENTAL_CACHE_CAPABILITIES.wildfireEvent]: Object.freeze({
    freshTtlMs: 1_800_000,
    staleWindowMs: 3_600_000,
    hardExpireMs: 86_400_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 48,
    maxRawPayloadBytes: 16_384,
  }),
  [ENVIRONMENTAL_CACHE_CAPABILITIES.environmentalSnapshot]: Object.freeze({
    freshTtlMs: 300_000,
    staleWindowMs: 900_000,
    hardExpireMs: 3_600_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 8,
    maxRawPayloadBytes: 64_000,
  }),
});

export function environmentalCachePolicy(capability: string): CachePolicy {
  return POLICIES[capability] ?? POLICIES[ENVIRONMENTAL_CACHE_CAPABILITIES.currentWeather];
}
