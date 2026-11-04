/**
 * Robust latent street expectation estimator (DynamicConsensusFilter).
 */

import type { UtcInstant } from '@solstice/domain';
import { DEFAULT_HUBER_DELTA_MAD_MULTIPLIER, DEFAULT_STALE_FORECAST_AGE_DAYS } from './taxonomy.ts';
import type {
  AnalystForecast,
  AnalystTrackRecord,
  ConsensusRevisionState,
  StreetExpectationDistribution,
} from './types.ts';
import { filterKnowableForecasts, isForecastStale, latestForecastPerAnalyst } from './consensus.ts';
import {
  huberWeight,
  median,
  medianAbsoluteDeviation,
  quantile,
  sampleStandardDeviation,
  studentTLogLikelihood,
  trimmedMean,
} from './statistics.ts';

export type DynamicConsensusFilterOptions = {
  readonly residualMode?: 'huber' | 'student_t';
  readonly huberDeltaMadMultiplier?: number;
  readonly kalmanProcessNoise?: number;
  readonly kalmanMeasurementNoise?: number;
  readonly shrinkageToRobustConsensus?: number;
  readonly staleAgeDays?: number;
  readonly confidenceLevel?: number;
};

export type DynamicConsensusFilterInput = {
  readonly forecasts: readonly AnalystForecast[];
  readonly trackRecords: ReadonlyMap<string, AnalystTrackRecord>;
  readonly asOf: UtcInstant;
  readonly revisionState: ConsensusRevisionState;
  readonly priorLatent?: number | null;
};

export type DynamicConsensusFilter = {
  readonly update: (input: DynamicConsensusFilterInput) => StreetExpectationDistribution | null;
};

function reliabilityWeight(record: AnalystTrackRecord | undefined): number {
  if (!record || record.sampleCount === 0) return 0.35;
  const accuracy = record.recencyWeightedAccuracy || record.pastDirectionalAccuracy;
  const errorPenalty = 1 / (1 + record.pastAbsoluteError);
  return Math.max(0.05, Math.min(1, 0.5 * accuracy + 0.5 * errorPenalty));
}

function forecastAgeWeight(knowableAt: UtcInstant, asOf: UtcInstant, staleAgeDays: number): number {
  const ageDays = (Date.parse(asOf) - Date.parse(knowableAt)) / 86_400_000;
  if (ageDays >= staleAgeDays) return 0.15;
  return Math.exp(-ageDays / Math.max(staleAgeDays / 3, 1));
}

function horizonWeight(horizonDays: number): number {
  if (horizonDays <= 45) return 1;
  if (horizonDays <= 120) return 0.85;
  return 0.65;
}

function revisionFreshnessWeight(forecast: AnalystForecast, forecasts: readonly AnalystForecast[]): number {
  if (!forecast.revisionOf) return 0.9;
  const chain = forecasts.filter(
    (f) => f.analystId === forecast.analystId && f.fiscalPeriod.periodLabel === forecast.fiscalPeriod.periodLabel,
  );
  const latest = chain.sort((a, b) => Date.parse(b.knowableAt) - Date.parse(a.knowableAt))[0];
  if (!latest || latest.forecastId !== forecast.forecastId) return 0.5;
  return 1;
}

function outlierDownweight(
  value: number,
  center: number,
  scale: number,
  mode: 'huber' | 'student_t',
  huberDelta: number,
): number {
  const residual = value - center;
  if (mode === 'student_t') {
    const ll = studentTLogLikelihood(residual, scale);
    const ll0 = studentTLogLikelihood(0, scale);
    return Math.exp(Math.min(0, ll - ll0));
  }
  return huberWeight(residual, huberDelta);
}

function kalmanUpdate(prior: number, measurement: number, processNoise: number, measurementNoise: number): number {
  const priorVariance = processNoise;
  const gain = priorVariance / (priorVariance + measurementNoise);
  return prior + gain * (measurement - prior);
}

export function createDynamicConsensusFilter(
  options: DynamicConsensusFilterOptions = {},
): DynamicConsensusFilter {
  const residualMode = options.residualMode ?? 'huber';
  const huberDeltaMult = options.huberDeltaMadMultiplier ?? DEFAULT_HUBER_DELTA_MAD_MULTIPLIER;
  const processNoise = options.kalmanProcessNoise ?? 0.08;
  const measurementNoise = options.kalmanMeasurementNoise ?? 0.25;
  const shrinkage = options.shrinkageToRobustConsensus ?? 0.25;
  const staleAgeDays = options.staleAgeDays ?? DEFAULT_STALE_FORECAST_AGE_DAYS;
  const confidenceLevel = options.confidenceLevel ?? 0.9;

  return Object.freeze({
    update(input: DynamicConsensusFilterInput): StreetExpectationDistribution | null {
      const pit = filterKnowableForecasts(input.forecasts, input.asOf);
      const latest = latestForecastPerAnalyst(pit);
      if (latest.length === 0) return null;

      const values = latest.map((f) => f.value);
      const robustCenter = trimmedMean(values);
      const mad = medianAbsoluteDeviation(values, robustCenter);
      const scale = Math.max(mad * 1.4826, sampleStandardDeviation(values), 1e-6);
      const huberDelta = huberDeltaMult * scale;

      let weightedSum = 0;
      let weightTotal = 0;
      const weights: number[] = [];

      for (const f of latest) {
        let w = 1;
        w *= reliabilityWeight(f.analystId ? input.trackRecords.get(f.analystId) : undefined);
        w *= forecastAgeWeight(f.knowableAt, input.asOf, staleAgeDays);
        w *= horizonWeight(f.horizonDays);
        w *= revisionFreshnessWeight(f, pit);
        w *= outlierDownweight(f.value, robustCenter, scale, residualMode, huberDelta);
        if (isForecastStale(f, input.asOf, staleAgeDays)) w *= 0.5;
        weights.push(w);
        weightedSum += w * f.value;
        weightTotal += w;
      }

      const weightedMean = weightTotal > 0 ? weightedSum / weightTotal : robustCenter;
      let latent = weightedMean;
      if (input.priorLatent !== null && input.priorLatent !== undefined) {
        latent = kalmanUpdate(input.priorLatent, weightedMean, processNoise, measurementNoise);
      }
      const robustLocation = (1 - shrinkage) * latent + shrinkage * robustCenter;

      const dispersion = sampleStandardDeviation(values);
      const sorted = [...values].sort((a, b) => a - b);
      const alpha = (1 - confidenceLevel) / 2;
      const lower = quantile(sorted, alpha);
      const upper = quantile(sorted, 1 - alpha);
      const effectiveBreadth = weights.filter((w) => w >= 0.2).length / Math.max(latest.length, 1);
      const uncertainty = dispersion * (1 + Math.abs(input.revisionState.consensusMomentum));

      return Object.freeze({
        mean: weightedMean,
        median: median(values),
        robustLocation,
        dispersion,
        confidenceInterval: Object.freeze({ lower, upper, level: confidenceLevel }),
        breadth: effectiveBreadth,
        revisionState: input.revisionState,
        uncertainty,
      });
    },
  });
}
