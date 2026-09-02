/**
 * Explainable, versioned source reputation.
 *
 * Reputation is operational trustworthiness — not truth. Popularity does
 * not equal correctness.
 */

import type { NormalizedEconomicObservation } from '../types.ts';
import type { ReputationSummary } from './types.ts';

export const REPUTATION_MODEL_VERSION = 'sunrey.source-reputation.v1' as const;

export type ReputationRecord = {
  readonly providerId: string;
  readonly historicalAvailability: number;
  readonly schemaStability: number;
  readonly integrityHistory: number;
  readonly correctionFrequency: number;
  readonly knownUpstreamLineage: number;
  readonly verificationPerformance: number;
  readonly timeliness: number;
  readonly disputeHistory: number;
};

export type ReputationWeights = {
  readonly historicalAvailability: number;
  readonly schemaStability: number;
  readonly integrityHistory: number;
  readonly correctionFrequency: number;
  readonly knownUpstreamLineage: number;
  readonly verificationPerformance: number;
  readonly timeliness: number;
  readonly disputeHistory: number;
};

export const DEFAULT_REPUTATION_WEIGHTS: ReputationWeights = Object.freeze({
  historicalAvailability: 0.15,
  schemaStability: 0.1,
  integrityHistory: 0.2,
  verificationPerformance: 0.2,
  timeliness: 0.1,
  knownUpstreamLineage: 0.1,
  correctionFrequency: 0.05,
  disputeHistory: 0.1,
});

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function computeReputationScore(
  record: ReputationRecord,
  weights: ReputationWeights = DEFAULT_REPUTATION_WEIGHTS,
): { readonly score: number; readonly factors: readonly { readonly factor: string; readonly value: number; readonly explanation: string }[] } {
  const factors = [
    {
      factor: 'historicalAvailability',
      value: clamp01(record.historicalAvailability),
      explanation: 'Uptime and successful delivery history',
    },
    {
      factor: 'schemaStability',
      value: clamp01(record.schemaStability),
      explanation: 'Schema version stability over time',
    },
    {
      factor: 'integrityHistory',
      value: clamp01(record.integrityHistory),
      explanation: 'Past integrity verification outcomes',
    },
    {
      factor: 'correctionFrequency',
      value: clamp01(1 - record.correctionFrequency),
      explanation: 'Lower correction frequency is better',
    },
    {
      factor: 'knownUpstreamLineage',
      value: clamp01(record.knownUpstreamLineage),
      explanation: 'Transparency of upstream lineage',
    },
    {
      factor: 'verificationPerformance',
      value: clamp01(record.verificationPerformance),
      explanation: 'Successful verification pass rate',
    },
    {
      factor: 'timeliness',
      value: clamp01(record.timeliness),
      explanation: 'Delivery within expected freshness windows',
    },
    {
      factor: 'disputeHistory',
      value: clamp01(1 - record.disputeHistory),
      explanation: 'Lower dispute rate is better',
    },
  ] as const;

  const score = factors.reduce((sum, row) => {
    const weight = weights[row.factor as keyof ReputationWeights];
    return sum + row.value * weight;
  }, 0);

  return Object.freeze({ score: clamp01(score), factors: Object.freeze([...factors]) });
}

export function summarizeReputation(
  observations: readonly NormalizedEconomicObservation[],
  records: Readonly<Record<string, ReputationRecord>>,
): ReputationSummary {
  const providerIds = [...new Set(observations.map((row) => row.providerId))].sort();
  const scores = providerIds.map((providerId) => {
    const record = records[providerId];
    if (!record) {
      return Object.freeze({
        providerId,
        score: 0,
        factors: Object.freeze([
          Object.freeze({
            factor: 'unknown_provider',
            value: 0,
            explanation: 'No reputation record available',
          }),
        ]),
      });
    }
    const computed = computeReputationScore(record);
    return Object.freeze({
      providerId,
      score: computed.score,
      factors: computed.factors,
    });
  });
  return Object.freeze({
    version: REPUTATION_MODEL_VERSION,
    scores: Object.freeze(scores),
  });
}

export function reputationMeetsThreshold(summary: ReputationSummary, threshold: number): boolean {
  if (summary.scores.length === 0) {
    return false;
  }
  return summary.scores.every((row) => row.score >= threshold);
}
