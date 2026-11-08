import type { Alpha12ImpactModelConfig } from './types.ts';

/** Square-root participation impact (bps), capped. */
export function estimateImpactBps(participationRate: number, config: Alpha12ImpactModelConfig): number {
  if (participationRate <= 0) {
    return 0;
  }
  const temp =
    config.sqrtImpactCoeffBps * Math.sqrt(participationRate) * Math.pow(config.temporaryImpactDecay, 0.25);
  const permanent = config.permanentImpactCoeffBps * Math.pow(participationRate, 0.6);
  const raw = temp + permanent;
  return Math.min(config.maxImpactBps, Math.max(0, raw));
}

/**
 * Signal retention vs shadow backtest — sub-linear; avoids linear return extrapolation.
 * Crowding rises with participation versus ADV.
 */
export function signalRetentionFactor(participationRate: number, turnoverRatio: number): number {
  const crowding = participationRate * Math.sqrt(Math.max(0.25, turnoverRatio));
  return 1 / (1 + 2.5 * crowding + 6 * crowding * crowding);
}

export function bpsOnNotional(notionalMinor: bigint, bps: number): bigint {
  if (bps <= 0 || notionalMinor <= 0n) {
    return 0n;
  }
  const scaled = Math.round(bps * 100);
  return (notionalMinor * BigInt(scaled)) / 1_000_000n;
}

export function bpsFromMinor(deltaMinor: bigint, notionalMinor: bigint): number {
  if (notionalMinor <= 0n) {
    return 0;
  }
  const num = Number(deltaMinor) / Number(notionalMinor);
  return num * 10_000;
}
