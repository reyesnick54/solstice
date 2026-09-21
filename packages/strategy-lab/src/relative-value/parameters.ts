import type { UtcInstant } from '@solstice/domain';

export type M12ParameterVersion = 'v1' | 'v2';

export type M12StrategyParameters = {
  readonly version: M12ParameterVersion;
  readonly relationshipWindowBars: number;
  readonly minHistoryBars: number;
  readonly correlationWindowBars: number;
  /** Entry when |spread z-score| >= threshold (200 = 2.00σ). */
  readonly entryZScoreThresholdScaled: bigint;
  /** Exit when |spread z-score| <= target (50 = 0.50σ). */
  readonly exitZScoreTargetScaled: bigint;
  /** Stop when |spread z-score| exceeds stop (350 = 3.50σ). */
  readonly stopZScoreThresholdScaled: bigint;
  readonly maxHoldBars: number;
  readonly minRollingCorrelationScaled: bigint;
  readonly maxSpreadBps: bigint;
  readonly maxLegSpreadBps: bigint;
  readonly maxObservationAgeMs: number;
  readonly maxTimestampSkewMs: number;
  readonly requireCointegrationSupported: boolean;
  readonly maxRecommendedExposureBps: number;
};

export const M12_PARAMETERS_V1: M12StrategyParameters = Object.freeze({
  version: 'v1',
  relationshipWindowBars: 48,
  minHistoryBars: 48,
  correlationWindowBars: 24,
  entryZScoreThresholdScaled: 200n,
  exitZScoreTargetScaled: 50n,
  stopZScoreThresholdScaled: 350n,
  maxHoldBars: 24,
  minRollingCorrelationScaled: 5_000n,
  maxSpreadBps: 40n,
  maxLegSpreadBps: 50n,
  maxObservationAgeMs: 3_600_000,
  maxTimestampSkewMs: 60_000,
  requireCointegrationSupported: false,
  maxRecommendedExposureBps: 1_500,
});

export const M12_PARAMETERS_V2: M12StrategyParameters = Object.freeze({
  ...M12_PARAMETERS_V1,
  version: 'v2',
  entryZScoreThresholdScaled: 250n,
  maxHoldBars: 18,
});

export function resolveM12Parameters(version: M12ParameterVersion): M12StrategyParameters {
  return version === 'v2' ? M12_PARAMETERS_V2 : M12_PARAMETERS_V1;
}

export function parameterFingerprint(params: M12StrategyParameters): string {
  return JSON.stringify({
    version: params.version,
    relationshipWindowBars: params.relationshipWindowBars,
    minHistoryBars: params.minHistoryBars,
    correlationWindowBars: params.correlationWindowBars,
    entryZScoreThresholdScaled: params.entryZScoreThresholdScaled.toString(),
    exitZScoreTargetScaled: params.exitZScoreTargetScaled.toString(),
    stopZScoreThresholdScaled: params.stopZScoreThresholdScaled.toString(),
    maxHoldBars: params.maxHoldBars,
    minRollingCorrelationScaled: params.minRollingCorrelationScaled.toString(),
    maxSpreadBps: params.maxSpreadBps.toString(),
    maxLegSpreadBps: params.maxLegSpreadBps.toString(),
    maxObservationAgeMs: params.maxObservationAgeMs,
    maxTimestampSkewMs: params.maxTimestampSkewMs,
    requireCointegrationSupported: params.requireCointegrationSupported,
    maxRecommendedExposureBps: params.maxRecommendedExposureBps,
  });
}

export type M12ParameterRecord = {
  readonly version: M12ParameterVersion;
  readonly parameters: M12StrategyParameters;
  readonly fingerprint: string;
  readonly effectiveFrom: UtcInstant;
};

export function freezeM12ParameterRecord(input: {
  readonly version: M12ParameterVersion;
  readonly effectiveFrom: UtcInstant;
}): M12ParameterRecord {
  const parameters = resolveM12Parameters(input.version);
  return Object.freeze({
    version: input.version,
    parameters,
    fingerprint: parameterFingerprint(parameters),
    effectiveFrom: input.effectiveFrom,
  });
}
