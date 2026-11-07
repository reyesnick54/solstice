/**
 * Robust Student-t / Kalman-style latent digital demand filter.
 */

import type { LatentDigitalDemand } from '../types.ts';
import { clamp01 } from './numeric.ts';

export type LatentDemandSignal = {
  readonly name: string;
  readonly value: number;
  readonly observationNoise: number;
  readonly reliabilityWeight: number;
};

export type RobustLatentFilterState = {
  readonly level: number;
  readonly momentum: number;
  readonly variance: number;
};

const PROCESS_NOISE = 0.02;
const STUDENT_DF = 4;

function studentTInflation(residual: number, scale: number): number {
  const z = residual / Math.max(scale, 1e-6);
  const infl = 1 + (z * z) / STUDENT_DF;
  return Math.min(infl, 25);
}

export function initRobustLatentFilter(level: number): RobustLatentFilterState {
  return Object.freeze({ level, momentum: 0, variance: 0.05 });
}

export function stepRobustLatentFilter(
  state: RobustLatentFilterState,
  signals: readonly LatentDemandSignal[],
): RobustLatentFilterState {
  if (signals.length === 0) {
    return Object.freeze({
      level: state.level + state.momentum,
      momentum: state.momentum * 0.9,
      variance: state.variance + PROCESS_NOISE,
    });
  }

  let weightedSum = 0;
  let weightTotal = 0;
  let noiseAccum = 0;
  for (const signal of signals) {
    const w = Math.max(signal.reliabilityWeight, 0);
    weightedSum += signal.value * w;
    weightTotal += w;
    noiseAccum += signal.observationNoise / Math.max(w, 1e-6);
  }
  const observation = weightTotal > 0 ? weightedSum / weightTotal : state.level;
  const obsVar = noiseAccum / signals.length;

  const predictedLevel = state.level + state.momentum;
  const predictedVar = state.variance + PROCESS_NOISE;
  const residual = observation - predictedLevel;
  const infl = studentTInflation(residual, Math.sqrt(obsVar));
  const adjustedObsVar = obsVar * infl;

  const kalmanGain = predictedVar / (predictedVar + adjustedObsVar);
  const level = predictedLevel + kalmanGain * residual;
  const variance = (1 - kalmanGain) * predictedVar;
  const momentum = level - state.level;

  return Object.freeze({ level, momentum, variance });
}

export function latentDigitalDemandFromFilter(
  state: RobustLatentFilterState,
  stateRef: string,
): LatentDigitalDemand {
  return Object.freeze({
    level: state.level,
    momentum: state.momentum,
    uncertainty: Math.sqrt(Math.max(state.variance, 0)),
    stateRef,
  });
}

export function signalsFromNormalizedFeatures(input: {
  readonly searchLevel: number | null;
  readonly webVisitGrowth: number | null;
  readonly appUsageGrowth: number | null;
  readonly engagement: number | null;
  readonly searchReliabilityBps: number | null;
}): readonly LatentDemandSignal[] {
  const rel = (bps: number | null) => clamp01((bps ?? 5000) / 10_000);
  const rows: LatentDemandSignal[] = [];
  if (input.searchLevel !== null) {
    rows.push(
      Object.freeze({
        name: 'search_level',
        value: input.searchLevel,
        observationNoise: 0.08 / rel(input.searchReliabilityBps),
        reliabilityWeight: rel(input.searchReliabilityBps),
      }),
    );
  }
  if (input.webVisitGrowth !== null) {
    rows.push(
      Object.freeze({
        name: 'web_growth',
        value: input.webVisitGrowth,
        observationNoise: 0.12,
        reliabilityWeight: 0.7,
      }),
    );
  }
  if (input.appUsageGrowth !== null) {
    rows.push(
      Object.freeze({
        name: 'app_growth',
        value: input.appUsageGrowth,
        observationNoise: 0.15,
        reliabilityWeight: 0.65,
      }),
    );
  }
  if (input.engagement !== null) {
    rows.push(
      Object.freeze({
        name: 'engagement',
        value: input.engagement,
        observationNoise: 0.1,
        reliabilityWeight: 0.55,
      }),
    );
  }
  return Object.freeze(rows);
}
