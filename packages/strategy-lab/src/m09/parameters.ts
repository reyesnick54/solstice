import type { UtcInstant } from '../../../domain/src/time.ts';

/** Fixed-point scale for z-score comparisons (100 = 1.00 standard deviation). */
export const M09_Z_SCORE_SCALE = 100n;

export type M09ParameterVersion = 'v1' | 'v2';

export type M09StrategyParameters = {
  readonly version: M09ParameterVersion;
  readonly rollingWindowBars: number;
  readonly volWindowBars: number;
  readonly minHistoryBars: number;
  /** Entry when z-score <= -entryZScoreThresholdScaled (e.g. 200 = 2.00σ below mean). */
  readonly entryZScoreThresholdScaled: bigint;
  /** Exit when z-score >= -exitZScoreTargetScaled (mean reversion target). */
  readonly exitZScoreTargetScaled: bigint;
  /** Maximum bars to hold before time stop. */
  readonly maxHoldBars: number;
  /** Realized volatility ceiling in bps (e.g. 500 = 5%). */
  readonly maxRealizedVolBps: bigint;
  /** Minimum realized volatility floor in bps to avoid division by zero. */
  readonly minRealizedVolBps: bigint;
  /** Maximum acceptable spread in bps. */
  readonly maxSpreadBps: bigint;
  /** Maximum observation age for fresh data (ms). */
  readonly maxObservationAgeMs: number;
  /** End-of-session flat rule when true. */
  readonly endOfSessionFlat: boolean;
  /** Maximum recommended normalized exposure in bps (Meta Allocator may narrow). */
  readonly maxRecommendedExposureBps: number;
};

export const M09_PARAMETERS_V1: M09StrategyParameters = Object.freeze({
  version: 'v1',
  rollingWindowBars: 20,
  volWindowBars: 20,
  minHistoryBars: 20,
  entryZScoreThresholdScaled: 200n,
  exitZScoreTargetScaled: 50n,
  maxHoldBars: 8,
  maxRealizedVolBps: 500n,
  minRealizedVolBps: 10n,
  maxSpreadBps: 30n,
  maxObservationAgeMs: 900_000,
  endOfSessionFlat: true,
  maxRecommendedExposureBps: 2_000,
});

/** v2 tightens entry threshold and shortens hold — fingerprint/version tests only. */
export const M09_PARAMETERS_V2: M09StrategyParameters = Object.freeze({
  ...M09_PARAMETERS_V1,
  version: 'v2',
  entryZScoreThresholdScaled: 250n,
  maxHoldBars: 6,
});

export function resolveM09Parameters(version: M09ParameterVersion): M09StrategyParameters {
  if (version === 'v2') {
    return M09_PARAMETERS_V2;
  }
  return M09_PARAMETERS_V1;
}

export function parameterFingerprint(params: M09StrategyParameters): string {
  return JSON.stringify({
    version: params.version,
    rollingWindowBars: params.rollingWindowBars,
    volWindowBars: params.volWindowBars,
    minHistoryBars: params.minHistoryBars,
    entryZScoreThresholdScaled: params.entryZScoreThresholdScaled.toString(),
    exitZScoreTargetScaled: params.exitZScoreTargetScaled.toString(),
    maxHoldBars: params.maxHoldBars,
    maxRealizedVolBps: params.maxRealizedVolBps.toString(),
    minRealizedVolBps: params.minRealizedVolBps.toString(),
    maxSpreadBps: params.maxSpreadBps.toString(),
    maxObservationAgeMs: params.maxObservationAgeMs,
    endOfSessionFlat: params.endOfSessionFlat,
    maxRecommendedExposureBps: params.maxRecommendedExposureBps,
  });
}

export type M09ParameterRecord = {
  readonly version: M09ParameterVersion;
  readonly parameters: M09StrategyParameters;
  readonly fingerprint: string;
  readonly effectiveFrom: UtcInstant;
};

export function freezeM09ParameterRecord(input: {
  readonly version: M09ParameterVersion;
  readonly effectiveFrom: UtcInstant;
}): M09ParameterRecord {
  const parameters = resolveM09Parameters(input.version);
  return Object.freeze({
    version: input.version,
    parameters,
    fingerprint: parameterFingerprint(parameters),
    effectiveFrom: input.effectiveFrom,
  });
}
