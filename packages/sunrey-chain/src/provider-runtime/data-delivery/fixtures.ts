/**
 * Mock refresh schedules for simulation. No live 126-provider wiring.
 */

import type { RefreshScheduleEntry } from './types.ts';

export const MOCK_REFRESH_SCHEDULES: readonly RefreshScheduleEntry[] = Object.freeze([
  Object.freeze({
    scheduleId: 'mock-macro-daily',
    providerId: 'mock-fred',
    capability: 'macro.gdp',
    resourceId: 'US.GDP',
    intervalMs: 86_400_000,
    jitterMs: 120_000,
    priority: 10,
    enabled: true,
    maxRuntimeMs: 120_000,
  }),
  Object.freeze({
    scheduleId: 'mock-weather-10m',
    providerId: 'mock-openweather',
    capability: 'weather.current',
    resourceId: 'nyc-current',
    intervalMs: 600_000,
    jitterMs: 90_000,
    priority: 20,
    enabled: true,
    maxRuntimeMs: 60_000,
  }),
  Object.freeze({
    scheduleId: 'mock-energy-5m',
    providerId: 'mock-eia',
    capability: 'energy.price',
    resourceId: 'WTI',
    intervalMs: 300_000,
    jitterMs: 60_000,
    priority: 15,
    enabled: true,
    maxRuntimeMs: 90_000,
  }),
  Object.freeze({
    scheduleId: 'mock-fx-hourly',
    providerId: 'mock-ecb',
    capability: 'fx.reference',
    resourceId: 'EURUSD',
    intervalMs: 3_600_000,
    jitterMs: 120_000,
    priority: 5,
    enabled: true,
    maxRuntimeMs: 45_000,
  }),
  Object.freeze({
    scheduleId: 'mock-aviation-positions',
    providerId: 'mock-opensky',
    capability: 'aviation.position',
    resourceId: 'JFK',
    intervalMs: 60_000,
    jitterMs: 30_000,
    priority: 25,
    enabled: false,
    maxRuntimeMs: 30_000,
  }),
]);
