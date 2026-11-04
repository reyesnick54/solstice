import type { EarningsForecast } from './types.ts';

export const EARN10_AGENT_COMMITTEE_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn10-agent-committee.ts' as const;

export type CommitteeVote = {
  readonly agentId: string;
  readonly weightBps: number;
  readonly forecast: EarningsForecast;
};

export function aggregateCommitteeForecast(votes: readonly CommitteeVote[]): EarningsForecast {
  if (votes.length === 0) {
    throw new Error('committee requires at least one vote');
  }
  let eps = 0n;
  let revenue = 0n;
  let beat = 0;
  let low = 0n;
  let high = 0n;
  let weightSum = 0;
  for (const vote of votes) {
    weightSum += vote.weightBps;
    eps += (vote.forecast.epsMinor * BigInt(vote.weightBps)) / 10_000n;
    revenue += (vote.forecast.revenueMinor * BigInt(vote.weightBps)) / 10_000n;
    beat += Math.round((vote.forecast.beatProbabilityBps * vote.weightBps) / 10_000);
    low += (vote.forecast.intervalLowEpsMinor * BigInt(vote.weightBps)) / 10_000n;
    high += (vote.forecast.intervalHighEpsMinor * BigInt(vote.weightBps)) / 10_000n;
  }
  if (weightSum === 0) {
    throw new Error('committee weight sum must be positive');
  }
  const scale = 10_000 / weightSum;
  return Object.freeze({
    epsMinor: (eps * BigInt(scale)) / 10_000n,
    revenueMinor: (revenue * BigInt(scale)) / 10_000n,
    beatProbabilityBps: Math.round(beat * scale),
    intervalLowEpsMinor: (low * BigInt(scale)) / 10_000n,
    intervalHighEpsMinor: (high * BigInt(scale)) / 10_000n,
  });
}
