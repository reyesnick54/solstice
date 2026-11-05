/**
 * VAL02 service — build probabilistic driver-based cash-flow forecasts.
 */

import { buildDriverCashFlowForecast } from './engine.ts';
import type { BuildDriverForecastInput, DriverForecastResult } from './types.ts';

export type HeliosVal02DriverForecastService = {
  readonly forecast: (input: BuildDriverForecastInput) => DriverForecastResult;
};

export function createHeliosVal02DriverForecastService(): HeliosVal02DriverForecastService {
  return Object.freeze({
    forecast: (input) => buildDriverCashFlowForecast(input),
  });
}
