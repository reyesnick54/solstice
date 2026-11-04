import type { EarningsForecast } from './types.ts';

export const EARN09_PROBABILISTIC_ESTIMATOR_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn09-probabilistic-estimator.ts' as const;

export function estimateEarningsDistribution(input: {
  readonly consensusEpsMinor: bigint;
  readonly consensusRevenueMinor: bigint;
  readonly surpriseHistoryBps: readonly number[];
  readonly toneBps: number;
  readonly qualityScoreBps: number;
}): EarningsForecast {
  const hist =
    input.surpriseHistoryBps.length === 0
      ? 0
      : input.surpriseHistoryBps.reduce((a, b) => a + b, 0) / input.surpriseHistoryBps.length;
  const adjBps = Math.round(hist * 0.2 + (input.toneBps - 5_000) * 0.05 + (input.qualityScoreBps - 5_000) * 0.03);
  const epsMinor = input.consensusEpsMinor + (input.consensusEpsMinor * BigInt(adjBps)) / 10_000n;
  const revenueMinor =
    input.consensusRevenueMinor +
    (input.consensusRevenueMinor * BigInt(Math.round(adjBps * 0.5))) / 10_000n;
  const beatProbabilityBps = Math.max(0, Math.min(10_000, 5_000 + adjBps));
  const band = input.consensusEpsMinor / 20n === 0n ? 1n : input.consensusEpsMinor / 20n;
  return Object.freeze({
    epsMinor,
    revenueMinor,
    beatProbabilityBps,
    intervalLowEpsMinor: epsMinor - band,
    intervalHighEpsMinor: epsMinor + band,
  });
}
