/**
 * Consensus snapshot from point-in-time forecast set.
 */

import type { UtcInstant } from '@solstice/domain';
import { DEFAULT_STALE_FORECAST_AGE_DAYS } from './taxonomy.ts';
import type { AnalystForecast, ConsensusSnapshot, FiscalPeriodRef, EarningsForecastMetric } from './types.ts';
import {
  forecastRange,
  interquartileRange,
  mean,
  median,
  sampleStandardDeviation,
  trimmedMean,
} from './statistics.ts';

export function filterKnowableForecasts(
  forecasts: readonly AnalystForecast[],
  asOf: UtcInstant,
): AnalystForecast[] {
  const asOfMs = Date.parse(asOf);
  return forecasts.filter((f) => Date.parse(f.knowableAt) <= asOfMs);
}

export function latestForecastPerAnalyst(
  forecasts: readonly AnalystForecast[],
): AnalystForecast[] {
  const byKey = new Map<string, AnalystForecast>();
  for (const f of forecasts) {
    const key = f.analystId ?? f.forecastId;
    const existing = byKey.get(key);
    if (!existing || Date.parse(f.knowableAt) > Date.parse(existing.knowableAt)) {
      byKey.set(key, f);
    }
  }
  return [...byKey.values()];
}

export function isForecastStale(
  forecast: AnalystForecast,
  asOf: UtcInstant,
  staleAgeDays = DEFAULT_STALE_FORECAST_AGE_DAYS,
): boolean {
  const ageMs = Date.parse(asOf) - Date.parse(forecast.knowableAt);
  return ageMs > staleAgeDays * 86_400_000;
}

export function buildConsensusSnapshot(input: {
  readonly securityId: string;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly forecasts: readonly AnalystForecast[];
  readonly asOf: UtcInstant;
  readonly staleAgeDays?: number;
}): ConsensusSnapshot | null {
  const pit = filterKnowableForecasts(input.forecasts, input.asOf);
  const scoped = pit.filter(
    (f) =>
      f.securityId === input.securityId
      && f.metric === input.metric
      && f.fiscalPeriod.periodLabel === input.fiscalPeriod.periodLabel,
  );
  const latest = latestForecastPerAnalyst(scoped);
  if (latest.length === 0) return null;

  const values = latest.map((f) => f.value);
  const staleAgeDays = input.staleAgeDays ?? DEFAULT_STALE_FORECAST_AGE_DAYS;
  let fresh = 0;
  let stale = 0;
  for (const f of latest) {
    if (isForecastStale(f, input.asOf, staleAgeDays)) stale += 1;
    else fresh += 1;
  }

  return Object.freeze({
    securityId: input.securityId,
    fiscalPeriod: input.fiscalPeriod,
    metric: input.metric,
    asOf: input.asOf,
    consensusMean: mean(values),
    consensusMedian: median(values),
    trimmedMean: trimmedMean(values),
    forecastCount: latest.length,
    dispersion: sampleStandardDeviation(values),
    interquartileRange: interquartileRange(values),
    forecastRange: forecastRange(values),
    freshForecastCount: fresh,
    staleForecastCount: stale,
  });
}
